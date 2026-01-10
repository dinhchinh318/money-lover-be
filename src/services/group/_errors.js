exports.httpError = (status, message, code) => {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
};
