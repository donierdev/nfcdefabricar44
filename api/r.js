const { cmd } = require("./_db");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.query.id || "").replace(/[^0-9]/g, "");
  const c = Number(req.query.c) === 2 ? 2 : 1;
  const P = c === 1 ? "" : "c" + c + ":";
  let dest = null;
  if (id) {
    try {
      const [d, next] = await Promise.all([cmd(["GET", P + "qr:" + id]), cmd(["GET", P + "cfg:next"])]);
      dest = d;
      if (d || Number(id) <= (Number(next) || 0)) {
        await Promise.all([cmd(["INCR", P + "scans:" + id]), cmd(["SET", P + "last:" + id, String(Date.now())])]);
      }
    } catch (e) {}
  }
  res.statusCode = 302;
  res.setHeader("Location", dest && /^https?:\/\//i.test(dest) ? dest : "/inativo.html");
  res.end();
};
