exports.ok = (res, data) => res.json({ ok: true, data });
exports.fail = (res, err) => {
  const isDup = err?.code === 11000;
  const status = isDup ? 409 : (err.status || 500);

  res.status(status).json({
    ok: false,
    message: isDup ? "Already exists in this group" : (err.message || "ERROR"),
    code: err.code,
    fields: isDup ? err.keyValue : undefined,
  });
};
