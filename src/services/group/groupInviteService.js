// services/group/groupInviteService.js
const mongoose = require("mongoose");

const Group = require("../../models/group/group");
const GroupMember = require("../../models/group/groupMember");
const GroupInvite = require("../../models/group/groupInvite");
const User = require("../../models/user");
const Notification = require("../../models/notification");

const { requireManageRole } = require("./groupService");
const { httpError } = require("./_errors");

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

const toObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

const normEmail = (email) => (email ? String(email).toLowerCase().trim() : null);

async function createGroupNotification({
  userId,
  level = "info",
  title,
  message,
  event,
  link = "",
  entityKind = "group",
  entityId = null,
  dedupeKey = null,
  data = {},
  expiresAt = null,
}) {
  if (!userId) return null;

  try {
    return await Notification.create({
      userId: toObjectId(userId),
      type: "group", // ✅ MUST match enum
      level,
      title,
      message,

      isRead: false,
      readAt: null,

      event: event || "",
      link: link || "",
      entity: {
        kind: entityKind || "",
        id: entityId ? toObjectId(entityId) : null,
      },

      // ✅ schema bạn đang unique (userId + dedupeKey)
      // -> nên dùng dedupeKey theo inviteId để không bị chặn vĩnh viễn
      dedupeKey: dedupeKey || null,

      data: data || {},
      deliveredChannels: { inApp: true, email: false, push: false },
      expiresAt: expiresAt || null,
    });
  } catch (e) {
    // ✅ Nếu trùng dedupeKey -> bỏ qua
    if (e?.code === 11000) return null;

    // ✅ Nếu type/event sai schema -> bạn sẽ thấy lỗi ở đây
    console.error("[GROUP NOTIFICATION] create failed:", e?.message || e);
    return null;
  }
}

async function createInvite({ groupId, inviterId, userId, email, expireDays = 7 }) {
  const group = await Group.findById(groupId).lean();
  if (!group || !group.isActive) throw httpError(404, "GROUP_NOT_FOUND");

  await requireManageRole(groupId, inviterId);

  let inviteeUserId = null;
  let inviteeEmail = null;

  if (userId) {
    const u = await User.findById(userId).select("_id email name").lean();
    if (!u) throw httpError(404, "USER_NOT_FOUND");

    inviteeUserId = u._id;
    inviteeEmail = normEmail(u.email);
  } else if (email) {
    inviteeEmail = normEmail(email);
    const u = await User.findOne({ email: inviteeEmail }).select("_id email name").lean();
    if (u) inviteeUserId = u._id;
  } else {
    throw httpError(400, "MISSING_INVITEE");
  }

  if (inviteeUserId) {
    const existsMember = await GroupMember.findOne({ groupId, userId: inviteeUserId }).lean();
    if (existsMember) throw httpError(400, "ALREADY_MEMBER");
  }

  const orConditions = [];
  if (inviteeUserId) orConditions.push({ inviteeUserId });
  if (inviteeEmail) orConditions.push({ inviteeEmail });

  const now = new Date();

  const dup = await GroupInvite.findOne({
    groupId,
    status: "pending",
    expiresAt: { $gt: now },
    $or: orConditions,
  }).lean();

  if (dup) throw httpError(400, "INVITE_ALREADY_SENT");

  const token = GroupInvite.newToken();
  const expiresAt = addDays(now, expireDays);

  let invite;
  try {
    invite = await GroupInvite.create({
      groupId,
      inviterId,
      inviteeUserId,
      inviteeEmail,
      token,
      expiresAt,
    });
  } catch (e) {
    if (e?.code === 11000) throw httpError(400, "INVITE_ALREADY_SENT");
    throw e;
  }

  // ✅ NOTIFICATION (chỉ tạo nếu inviteeUserId tồn tại -> có account trong hệ thống)
  if (inviteeUserId) {
    const inviter = await User.findById(inviterId).select("name email").lean();

    await createGroupNotification({
      userId: inviteeUserId,
      level: "info",
      title: "Bạn có lời mời vào nhóm",
      message: `${inviter?.name || inviter?.email || "Ai đó"} đã mời bạn vào nhóm "${group.name}".`,
      event: "group.invite.received",
      link: `/groups/invites`, // FE đổi link theo routing của bạn
      entityKind: "groupInvite",
      entityId: invite._id,
      // ✅ unique theo inviteId để không block những lần mời khác
      dedupeKey: `group.invite.received:${invite._id}`,
      data: {
        groupId: group._id,
        groupName: group.name,
        inviteId: invite._id,
        token: invite.token,
        inviterId: inviterId,
        expiresAt: invite.expiresAt,
      },
      // optional: hết hạn cùng invite
      expiresAt: invite.expiresAt,
    });
  }

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

async function listMyInvites({ userId, email }) {
  const q = { status: "pending", expiresAt: { $gt: new Date() } };

  let emailNorm = normEmail(email);

  // ✅ nếu controller không truyền email, tự lấy theo userId
  if (userId && !emailNorm) {
    const u = await User.findById(userId).select("email").lean();
    if (u?.email) emailNorm = normEmail(u.email);
  }

  const ors = [];
  if (userId) ors.push({ inviteeUserId: userId });
  if (emailNorm) ors.push({ inviteeEmail: emailNorm });
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

  const emailNorm = normEmail(userEmail);
  const matchesUserId = invite.inviteeUserId && String(invite.inviteeUserId) === String(userId);
  const matchesEmail = invite.inviteeEmail && emailNorm && invite.inviteeEmail === emailNorm;
  if (!matchesUserId && !matchesEmail) throw httpError(403, "INVITE_NOT_FOR_YOU");

  await GroupMember.updateOne(
    { groupId: invite.groupId, userId },
    { $setOnInsert: { role: "member", joinedAt: new Date() } },
    { upsert: true }
  );

  invite.status = "accepted";
  invite.inviteeUserId = toObjectId(userId);
  invite.inviteeEmail = emailNorm || invite.inviteeEmail;
  await invite.save();

  // ✅ NOTIFICATION: báo cho inviter (và owner nếu khác)
  const [group, joiner] = await Promise.all([
    Group.findById(invite.groupId).select("name ownerId").lean(),
    User.findById(userId).select("name email").lean(),
  ]);

  if (invite.inviterId) {
    await createGroupNotification({
      userId: invite.inviterId,
      level: "success",
      title: "Lời mời đã được chấp nhận",
      message: `${joiner?.name || joiner?.email || "Ai đó"} đã chấp nhận lời mời vào nhóm "${group?.name || "nhóm"}".`,
      event: "group.invite.accepted",
      link: `/groups/${invite.groupId}`,
      entityKind: "groupInvite",
      entityId: invite._id,
      dedupeKey: `group.invite.accepted:${invite._id}`,
      data: {
        groupId: invite.groupId,
        groupName: group?.name,
        inviteId: invite._id,
        inviteeId: userId,
      },
    });
  }

  if (group?.ownerId && String(group.ownerId) !== String(invite.inviterId)) {
    await createGroupNotification({
      userId: group.ownerId,
      level: "info",
      title: "Có thành viên mới",
      message: `${joiner?.name || joiner?.email || "Ai đó"} đã tham gia nhóm "${group?.name || "nhóm"}".`,
      event: "group.member.joined",
      link: `/groups/${invite.groupId}`,
      entityKind: "group",
      entityId: invite.groupId,
      dedupeKey: `group.member.joined:${invite.groupId}:${userId}`,
      data: {
        groupId: invite.groupId,
        groupName: group?.name,
        memberId: userId,
      },
    });
  }

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

async function declineInvite({ token, userId, userEmail }) {
  const invite = await GroupInvite.findOne({ token });
  if (!invite) throw httpError(404, "INVITE_NOT_FOUND");
  if (invite.status !== "pending") throw httpError(400, "INVITE_NOT_PENDING");

  const emailNorm = normEmail(userEmail);
  const matchesUserId = invite.inviteeUserId && String(invite.inviteeUserId) === String(userId);
  const matchesEmail = invite.inviteeEmail && emailNorm && invite.inviteeEmail === emailNorm;
  if (!matchesUserId && !matchesEmail) throw httpError(403, "INVITE_NOT_FOR_YOU");

  invite.status = "declined";
  await invite.save();

  // ✅ NOTIFICATION: báo cho inviter
  const [group, decliner] = await Promise.all([
    Group.findById(invite.groupId).select("name").lean(),
    User.findById(userId).select("name email").lean(),
  ]);

  if (invite.inviterId) {
    await createGroupNotification({
      userId: invite.inviterId,
      level: "warning",
      title: "Lời mời bị từ chối",
      message: `${decliner?.name || decliner?.email || "Ai đó"} đã từ chối lời mời vào nhóm "${group?.name || "nhóm"}".`,
      event: "group.invite.declined",
      link: `/groups/${invite.groupId}`,
      entityKind: "groupInvite",
      entityId: invite._id,
      dedupeKey: `group.invite.declined:${invite._id}`,
      data: {
        groupId: invite.groupId,
        groupName: group?.name,
        inviteId: invite._id,
        inviteeId: userId,
      },
    });
  }

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

  // ✅ NOTIFICATION: báo cho invitee (nếu có user)
  if (invite.inviteeUserId) {
    const [group, actor] = await Promise.all([
      Group.findById(invite.groupId).select("name").lean(),
      User.findById(actorId).select("name email").lean(),
    ]);

    await createGroupNotification({
      userId: invite.inviteeUserId,
      level: "warning",
      title: "Lời mời đã bị thu hồi",
      message: `${actor?.name || actor?.email || "Ai đó"} đã thu hồi lời mời vào nhóm "${group?.name || "nhóm"}".`,
      event: "group.invite.revoked",
      link: `/groups/invites`,
      entityKind: "groupInvite",
      entityId: invite._id,
      dedupeKey: `group.invite.revoked:${invite._id}`,
      data: {
        groupId: invite.groupId,
        groupName: group?.name,
        inviteId: invite._id,
        actorId,
      },
    });
  }

  return GroupInvite.findById(invite._id)
    .populate("groupId", "name avatar ownerId")
    .populate("inviterId", "name email avatar")
    .lean();
}

module.exports = { createInvite, listMyInvites, acceptInvite, declineInvite, revokeInvite };
