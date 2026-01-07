const GroupMember = require("../../models/group/groupMember");
const { requireManageRole, requireMembership } = require("./groupService");
const { httpError } = require("./_errors");

exports.list = async ({ groupId, userId }) => {
  await requireMembership(groupId, userId);
  return GroupMember.find({ groupId })
    .populate("userId", "name email avatar")
    .select("userId role joinedAt")
    .sort({ createdAt: 1 })
    .lean();
};

exports.kick = async ({ groupId, actorId, targetUserId }) => {
  await requireManageRole(groupId, actorId);
  const target = await GroupMember.findOne({ groupId, userId: targetUserId }).select("role").lean();
  if (!target) return { ok: true };
  if (target.role === "owner") throw httpError(400, "CANNOT_REMOVE_OWNER");
  await GroupMember.deleteOne({ groupId, userId: targetUserId });
  return { ok: true };
};
