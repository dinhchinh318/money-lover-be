const reportSvc = require("../../services/group/groupReportService");
const { ok, fail } = require("./_respond");

exports.summary = async (req, res) => {
  try {
    const data = await reportSvc.summary({
      groupId: req.params.groupId,
      userId: req.user._id,
      from: req.query.from,
      to: req.query.to,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.byCategory = async (req, res) => {
  try {
    const data = await reportSvc.byCategory({
      groupId: req.params.groupId,
      userId: req.user._id,
      from: req.query.from,
      to: req.query.to,
      type: req.query.type || "expense",
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.byWallet = async (req, res) => {
  try {
    const data = await reportSvc.byWallet({
      groupId: req.params.groupId,
      userId: req.user._id,
      from: req.query.from,
      to: req.query.to,
      type: req.query.type,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};
