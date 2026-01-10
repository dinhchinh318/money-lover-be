const groupSvc = require("../../services/group/groupService");
const { ok, fail } = require("./_respond");

exports.create = async (req, res) => {
  try {
    const data = await groupSvc.createGroup({
      ownerId: req.user._id,
      name: req.body.name,
      description: req.body.description,
      avatar: req.body.avatar,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.myGroups = async (req, res) => {
  try {
    const data = await groupSvc.listMyGroups(req.user._id);
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.detail = async (req, res) => {
  try {
    const data = await groupSvc.getGroupDetail({ groupId: req.params.groupId, userId: req.user._id });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.leave = async (req, res) => {
  try {
    const data = await groupSvc.leaveGroup({ groupId: req.params.groupId, userId: req.user._id });
    ok(res, data || { ok: true });
  } catch (e) {
    fail(res, e);
  }
};

exports.removeMember = async (req, res) => {
  try {
    const data = await groupSvc.removeMember({
      groupId: req.params.groupId,
      actorId: req.user._id,
      targetUserId: req.params.userId,
    });
    ok(res, data || { ok: true });
  } catch (e) {
    fail(res, e);
  }
};

exports.setMemberRole = async (req, res) => {
  try {
    const data = await groupSvc.setMemberRole({
      groupId: req.params.groupId,
      actorId: req.user._id,
      targetUserId: req.params.userId,
      role: req.body.role,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.update = async (req, res) => {
  try {
    const data = await groupSvc.updateGroup({
      groupId: req.params.groupId,
      actorId: req.user._id,
      body: req.body,
    });
    return ok(res, data);
  } catch (e) {
    return fail(res, e);
  }
};

exports.disable = async (req, res) => {
  try {
    const data = await groupSvc.disableGroup({
      groupId: req.params.groupId,
      actorId: req.user._id,
    });
    return ok(res, data);
  } catch (e) {
    return fail(res, e);
  }
};