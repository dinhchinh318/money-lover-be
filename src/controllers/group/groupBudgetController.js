const budgetSvc = require("../../services/group/groupBudgetService");
const { ok, fail } = require("./_respond");

exports.list = async (req, res) => {
  try {
    const data = await budgetSvc.list({ groupId: req.params.groupId, userId: req.user._id });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.create = async (req, res) => {
  try {
    const data = await budgetSvc.create({ groupId: req.params.groupId, userId: req.user._id, body: req.body });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.disable = async (req, res) => {
  try {
    const data = await budgetSvc.disable({ groupId: req.params.groupId, userId: req.user._id, budgetId: req.params.budgetId });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.progress = async (req, res) => {
  try {
    const data = await budgetSvc.progress({ groupId: req.params.groupId, userId: req.user._id, budgetId: req.params.budgetId });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};
