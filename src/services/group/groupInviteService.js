const Group = require("../../models/group/group");
const GroupMember = require("../../models/group/groupMember");
const GroupInvite = require("../../models/group/groupInvite");
const User = require("../../models/user");
const { requireManageRole } = require("./groupService");
const { httpError } = require("./_errors");

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

async function createInvite({ groupId, inviterId, userId, email, expireDays = 7 }) {
  const group = await Group.findById(groupId).lean();
  if (!group || !group.isActive) throw httpError(404, "GROUP_NOT_FOUND");

  await requireManageRole(groupId, inviterId);

  let inviteeUserId = null;
  let inviteeEmail = null;

  if (userId) {
    const u = await User.findById(userId).select("_id email").lean();
    if (!u) throw httpError(404, "USER_NOT_FOUND");
    inviteeUserId = u._id;
    inviteeEmail = u.email;
  } else if (email) {
    inviteeEmail = String(email).toLowerCase().trim();
    const u = await User.findOne({ email: inviteeEmail }).select("_id email").lean();
    if (u) inviteeUserId = u._id;
  } else {
    throw httpError(400, "MISSING_INVITEE");
  }

  if (inviteeUserId) {
    const existsMember = await GroupMember.findOne({ groupId, userId: inviteeUserId }).lean();
    if (existsMember) throw httpError(400, "ALREADY_MEMBER");
  }

  const dup = await GroupInvite.findOne({
    groupId,
    status: "pending",
    expiresAt: { $gt: new Date() },
    $or: [
      ...(inviteeUserId ? [{ inviteeUserId }] : []),
      ...(inviteeEmail ? [{ inviteeEmail }] : []),
    ],
  }).lean();
  if (dup) throw httpError(400, "INVITE_ALREADY_SENT");

  const token = GroupInvite.newToken();
  const expiresAt = addDays(new Date(), expireDays);

  const invite = await GroupInvite.create({
    groupId,
    inviterId,
    inviteeUserId,
    inviteeEmail,
    token,
    expiresAt,
  });

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

async function listMyInvites({ userId, email }) {
  const q = { status: "pending", expiresAt: { $gt: new Date() } };
  const ors = [];
  if (userId) ors.push({ inviteeUserId: userId });
  if (email) ors.push({ inviteeEmail: String(email).toLowerCase().trim() });
  if (!ors.length) return [];

  return GroupInvite.find({ ...q, $or: ors })
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .sort({ createdAt: -1 })
    .lean();
}

async function acceptInvite({ token, userId, userEmail }) {
  const invite = await GroupInvite.findOne({ token });
  if (!invite) throw httpError(404, "INVITE_NOT_FOUND");

  if (invite.status !== "pending") throw httpError(400, "INVITE_NOT_PENDING");
  if (invite.expiresAt <= new Date()) {
    invite.status = "expired";
    await invite.save();
    throw httpError(400, "INVITE_EXPIRED");
  }

  const emailNorm = userEmail ? String(userEmail).toLowerCase().trim() : null;
  const matchesUserId = invite.inviteeUserId && String(invite.inviteeUserId) === String(userId);
  const matchesEmail = invite.inviteeEmail && emailNorm && invite.inviteeEmail === emailNorm;
  if (!matchesUserId && !matchesEmail) throw httpError(403, "INVITE_NOT_FOR_YOU");

  await GroupMember.updateOne(
    { groupId: invite.groupId, userId },
    { $setOnInsert: { role: "member", joinedAt: new Date() } },
    { upsert: true }
  );

  invite.status = "accepted";
  invite.inviteeUserId = userId;
  invite.inviteeEmail = emailNorm || invite.inviteeEmail;
  await invite.save();

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

async function declineInvite({ token, userId, userEmail }) {
  const invite = await GroupInvite.findOne({ token });
  if (!invite) throw httpError(404, "INVITE_NOT_FOUND");
  if (invite.status !== "pending") throw httpError(400, "INVITE_NOT_PENDING");

  const emailNorm = userEmail ? String(userEmail).toLowerCase().trim() : null;
  const matchesUserId = invite.inviteeUserId && String(invite.inviteeUserId) === String(userId);
  const matchesEmail = invite.inviteeEmail && emailNorm && invite.inviteeEmail === emailNorm;
  if (!matchesUserId && !matchesEmail) throw httpError(403, "INVITE_NOT_FOR_YOU");

  invite.status = "declined";
  await invite.save();

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

async function revokeInvite({ inviteId, actorId }) {
  const invite = await GroupInvite.findById(inviteId);
  if (!invite) return null;

  await requireManageRole(invite.groupId, actorId);

  if (invite.status !== "pending") return invite.toObject();

  invite.status = "revoked";
  await invite.save();

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

module.exports = { createInvite, listMyInvites, acceptInvite, declineInvite, revokeInvite };
