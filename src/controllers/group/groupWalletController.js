const walletSvc = require("../../services/group/groupWalletService");
const { ok, fail } = require("./_respond");

exports.list = async (req, res) => {
  try {
    const data = await walletSvc.list({ groupId: req.params.groupId, userId: req.user._id });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.create = async (req, res) => {
  try {
    const data = await walletSvc.create({ groupId: req.params.groupId, userId: req.user._id, body: req.body });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.update = async (req, res) => {
  try {
    const data = await walletSvc.update({
      groupId: req.params.groupId,
      userId: req.user._id,
      walletId: req.params.walletId,
      body: req.body,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.disable = async (req, res) => {
  try {
    const data = await walletSvc.disable({ groupId: req.params.groupId, userId: req.user._id, walletId: req.params.walletId });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.recalc = async (req, res) => {
  try {
    const data = await walletSvc.recalcBalance({ groupId: req.params.groupId, userId: req.user._id, walletId: req.params.walletId });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};
