const inviteSvc = require("../../services/group/groupInviteService");
const { ok, fail } = require("./_respond");

exports.create = async (req, res) => {
  try {
    const data = await inviteSvc.createInvite({
      groupId: req.params.groupId,
      inviterId: req.user._id,
      userId: req.body.userId,
      email: req.body.email,
      expireDays: req.body.expireDays || 7,
    });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.myInvites = async (req, res) => {
  try {
    const data = await inviteSvc.listMyInvites({ userId: req.user._id, email: req.user.email });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.accept = async (req, res) => {
  try {
    const data = await inviteSvc.acceptInvite({ token: req.params.token, userId: req.user._id, userEmail: req.user.email });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.decline = async (req, res) => {
  try {
    const data = await inviteSvc.declineInvite({ token: req.params.token, userId: req.user._id, userEmail: req.user.email });
    ok(res, data);
  } catch (e) {
    fail(res, e);
  }
};

exports.revoke = async (req, res) => {
  try {
    const data = await inviteSvc.revokeInvite({ inviteId: req.params.inviteId, actorId: req.user._id });
    ok(res, data || { ok: true });
  } catch (e) {
    fail(res, e);
  }
};
