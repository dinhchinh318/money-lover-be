const Group = require("../../models/group/group");
const GroupMember = require("../../models/group/groupMember");
const { httpError } = require("./_errors");

async function createGroup({ ownerId, name, description, avatar }) {
  const group = await Group.create({ ownerId, name, description, avatar });
  await GroupMember.create({ groupId: group._id, userId: ownerId, role: "owner" });
  return group.toObject();
}

async function listMyGroups(userId) {
  const memberships = await GroupMember.find({ userId }).select("groupId role").lean();
  const groupIds = memberships.map((m) => m.groupId);
  if (!groupIds.length) return [];

  const groups = await Group.find({ _id: { $in: groupIds }, isActive: true }).sort({ createdAt: -1 }).lean();

  const counts = await GroupMember.aggregate([
    { $match: { groupId: { $in: groupIds } } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);

  const countByGroup = new Map(counts.map((x) => [String(x._id), x.count]));
  const roleByGroup = new Map(memberships.map((m) => [String(m.groupId), m.role]));

  return groups.map((g) => ({
    ...g,
    myRole: roleByGroup.get(String(g._id)) || "member",
    memberCount: countByGroup.get(String(g._id)) ?? 0,
  }));
}

async function requireMembership(groupId, userId) {
  const m = await GroupMember.findOne({ groupId, userId }).select("role").lean();
  if (!m) throw httpError(403, "NOT_MEMBER");
  return m;
}

async function requireManageRole(groupId, userId) {
  const m = await requireMembership(groupId, userId);
  if (m.role !== "owner" && m.role !== "admin") throw httpError(403, "NO_PERMISSION");
  return m;
}

async function getGroupDetail({ groupId, userId }) {
  const group = await Group.findById(groupId).lean();
  if (!group || !group.isActive) throw httpError(404, "GROUP_NOT_FOUND");

  const my = await requireMembership(groupId, userId);

  const members = await GroupMember.find({ groupId })
    .populate("userId", "name email avatar")
    .select("userId role joinedAt")
    .sort({ createdAt: 1 })
    .lean();

  return { group: { ...group, myRole: my.role, memberCount: members.length }, members };
}

async function leaveGroup({ groupId, userId }) {
  const m = await GroupMember.findOne({ groupId, userId }).select("role").lean();
  if (!m) return;
  if (m.role === "owner") throw httpError(400, "OWNER_CANNOT_LEAVE");
  await GroupMember.deleteOne({ groupId, userId });
}

async function removeMember({ groupId, actorId, targetUserId }) {
  await requireManageRole(groupId, actorId);
  const target = await GroupMember.findOne({ groupId, userId: targetUserId }).select("role").lean();
  if (!target) return;
  if (target.role === "owner") throw httpError(400, "CANNOT_REMOVE_OWNER");
  await GroupMember.deleteOne({ groupId, userId: targetUserId });
}

async function setMemberRole({ groupId, actorId, targetUserId, role }) {
  await requireManageRole(groupId, actorId);
  if (!["admin", "member"].includes(role)) throw httpError(400, "INVALID_ROLE");

  const target = await GroupMember.findOne({ groupId, userId: targetUserId });
  if (!target) throw httpError(404, "MEMBER_NOT_FOUND");
  if (target.role === "owner") throw httpError(400, "CANNOT_CHANGE_OWNER_ROLE");

  target.role = role;
  await target.save();
  return target.toObject();
}

async function updateGroup({ groupId, actorId, body }) {
  await requireManageRole(groupId, actorId);

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw httpError(404, "GROUP_NOT_FOUND");

  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) throw httpError(400, "INVALID_NAME");
    group.name = name;
  }
  if (body.description != null) group.description = String(body.description || "").trim();
  if (body.avatar !== undefined) group.avatar = body.avatar || null;

  await group.save();
  return group.toObject();
}

async function disableGroup({ groupId, actorId }) {
  await requireManageRole(groupId, actorId);

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) throw httpError(404, "GROUP_NOT_FOUND");

  group.isActive = false;
  await group.save();

  return { ok: true };
}

module.exports = {
  createGroup,
  listMyGroups,
  getGroupDetail,
  leaveGroup,
  removeMember,
  setMemberRole,
  requireMembership,
  requireManageRole,
  updateGroup,
  disableGroup,
};
