const catSvc = require("../../services/group/groupCategoryService");
const { ok, fail } = require("./_respond");

exports.list = async (req, res) => {
  try {
    const data = await catSvc.list({ groupId: req.params.groupId, userId: req.user._id, type: req.query.type });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.create = async (req, res) => {
  try {
    const data = await catSvc.create({ groupId: req.params.groupId, userId: req.user._id, body: req.body });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.update = async (req, res) => {
  try {
    const data = await catSvc.update({
      groupId: req.params.groupId,
      userId: req.user._id,
      categoryId: req.params.categoryId,
      body: req.body,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.disable = async (req, res) => {
  try {
    const data = await catSvc.disable({ groupId: req.params.groupId, userId: req.user._id, categoryId: req.params.categoryId });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};
