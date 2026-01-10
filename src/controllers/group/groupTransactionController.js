const txSvc = require("../../services/group/groupTransactionService");
const { ok, fail } = require("./_respond");

exports.list = async (req, res) => {
  try {
    const data = await txSvc.list({ groupId: req.params.groupId, userId: req.user._id, query: req.query });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.create = async (req, res) => {
  try {
    const data = await txSvc.create({ groupId: req.params.groupId, userId: req.user._id, body: req.body });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.update = async (req, res) => {
  try {
    const data = await txSvc.update({ groupId: req.params.groupId, userId: req.user._id, txId: req.params.txId, body: req.body });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.remove = async (req, res) => {
  try {
    const data = await txSvc.remove({ groupId: req.params.groupId, userId: req.user._id, txId: req.params.txId });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};
