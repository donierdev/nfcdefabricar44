const { cmd } = require("./_db");

function conta(senha) {
  if (!senha) return 0;
  if (process.env.ADMIN_PASSWORD && senha === process.env.ADMIN_PASSWORD) return 1;
  if (process.env.ADMIN_PASSWORD_2 && senha === process.env.ADMIN_PASSWORD_2) return 2;
  return 0;
}

async function montar(P) {
  const prox = Number(await cmd(["GET", P + "cfg:next"])) || 0;
  const keys = (await cmd(["KEYS", P + "qr:*"])) || [];
  const off = P.length + 3;
  const maxid = Math.max(prox, ...keys.map(k => Number(k.slice(off)) || 0), 0);
  const ids = Array.from({ length: maxid }, (_, i) => i + 1);
  const lista = [];
  for (let i = 0; i < ids.length; i += 200) {
    const ch = ids.slice(i, i + 200);
    const ks = [];
    ch.forEach(n => ks.push(P + "qr:" + n, P + "name:" + n, P + "scans:" + n, P + "last:" + n));
    const v = await cmd(["MGET", ...ks]);
    ch.forEach((n, j) => lista.push({
      id: n,
      destino: v[j * 4] || "",
      nome: v[j * 4 + 1] || "",
      leituras: Number(v[j * 4 + 2]) || 0,
      ultima: Number(v[j * 4 + 3]) || 0,
    }));
  }
  return { lista, prox };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const b = req.body || {};
  const c = conta(b.senha);
  if (!c) { res.statusCode = 401; return res.end(JSON.stringify({ erro: "Senha incorreta" })); }
  const P = c === 1 ? "" : "c" + c + ":";
  try {
    let extra = {};
    if (b.acao === "set") {
      const id = String(b.id || "").replace(/[^0-9]/g, "");
      if (!id) throw new Error("Número inválido");
      let d = String(b.destino || "").trim();
      if (!d) await cmd(["DEL", P + "qr:" + id]);
      else {
        if (!/^https?:\/\//i.test(d)) d = "https://" + d;
        await cmd(["SET", P + "qr:" + id, d]);
      }
      const nome = String(b.nome || "").trim().slice(0, 80);
      if (nome) await cmd(["SET", P + "name:" + id, nome]);
    }
    if (b.acao === "alocar") {
      const n = Math.min(500, Math.max(1, parseInt(b.qtd) || 1));
      const ate = await cmd(["INCRBY", P + "cfg:next", n]);
      extra = { de: ate - n + 1, ate };
    }
    if (b.acao === "apagar_tudo") {
      if (b.confirmar !== "APAGAR TUDO") throw new Error("Confirmação incorreta");
      for (const p of ["qr:*", "name:*", "scans:*", "last:*"]) {
        const ks = (await cmd(["KEYS", P + p])) || [];
        for (let i = 0; i < ks.length; i += 500) await cmd(["DEL", ...ks.slice(i, i + 500)]);
      }
      await cmd(["DEL", P + "cfg:next"]);
    }
    const m = await montar(P);
    res.end(JSON.stringify({ ok: true, conta: c, rota: c === 1 ? "/r/" : "/r" + c + "/", ...m, ...extra }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erro: String(e.message || e) })); }
};
