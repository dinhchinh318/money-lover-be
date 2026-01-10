function ok(res, data = null, message = "OK") {
  return res.json({ ok: true, data, message });
}
function fail(res, status = 400, message = "Error", code = "ERROR", data = null) {
  return res.status(status).json({ ok: false, message, code, data });
}
module.exports = { ok, fail };
