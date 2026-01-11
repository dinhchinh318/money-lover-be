// services/group/groupMemberService.js
const mongoose = require("mongoose");

const Group = require("../../models/group/group");
const GroupMember = require("../../models/group/groupMember");
const User = require("../../models/user");
const Notification = require("../../models/notification");

const { requireManageRole, requireMembership } = require("./groupService");
const { httpError } = require("./_errors");

const toObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

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
      type: "group",
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
      dedupeKey: dedupeKey || null,
      data: data || {},
      deliveredChannels: { inApp: true, email: false, push: false },
      expiresAt: expiresAt || null,
    });
  } catch (e) {
    // trùng dedupeKey => ignore
    if (e?.code === 11000) return null;
    console.error("[GROUP NOTIFICATION] create failed:", e?.message || e);
    return null;
  }
}

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

  const target = await GroupMember.findOne({ groupId, userId: targetUserId })
    .select("role userId groupId")
    .lean();

  if (!target) return { ok: true };
  if (target.role === "owner") throw httpError(400, "CANNOT_REMOVE_OWNER");

  await GroupMember.deleteOne({ groupId, userId: targetUserId });

  // ✅ Notification: gửi cho người bị kick
  const [group, actor, targetUser] = await Promise.all([
    Group.findById(groupId).select("name ownerId").lean(),
    User.findById(actorId).select("name email").lean(),
    User.findById(targetUserId).select("name email").lean(),
  ]);

  await createGroupNotification({
    userId: targetUserId,
    level: "warning",
    title: "Bạn đã bị xóa khỏi nhóm",
    message: `${actor?.name || actor?.email || "Ai đó"} đã xóa bạn khỏi nhóm "${group?.name || "nhóm"}".`,
    event: "group.member.kicked",
    link: `/groups`, // tùy routing FE
    entityKind: "group",
    entityId: groupId,
    // ✅ unique theo (group + target + time) để tránh spam, nhưng vẫn cho kick nhiều lần khác nhau
    dedupeKey: `group.member.kicked:${groupId}:${targetUserId}:${new Date().toISOString().slice(0, 10)}`,
    data: {
      groupId,
      groupName: group?.name,
      actorId,
      actorName: actor?.name || actor?.email,
      targetUserId,
      targetUserName: targetUser?.name || targetUser?.email,
    },
  });

  // (OPTIONAL) ✅ Notification cho owner nếu actor != owner
  // nếu bạn không cần thì xoá đoạn này
  if (group?.ownerId && String(group.ownerId) !== String(actorId)) {
    await createGroupNotification({
      userId: group.ownerId,
      level: "info",
      title: "Thành viên đã bị xóa",
      message: `${actor?.name || actor?.email || "Ai đó"} đã xóa ${
        targetUser?.name || targetUser?.email || "một thành viên"
      } khỏi nhóm "${group?.name || "nhóm"}".`,
      event: "group.member.kicked.audit",
      link: `/groups/${groupId}`,
      entityKind: "group",
      entityId: groupId,
      dedupeKey: `group.member.kicked.audit:${groupId}:${targetUserId}:${new Date()
        .toISOString()
        .slice(0, 10)}`,
      data: {
        groupId,
        groupName: group?.name,
        actorId,
        actorName: actor?.name || actor?.email,
        targetUserId,
        targetUserName: targetUser?.name || targetUser?.email,
      },
    });
  }

  return { ok: true };
};

/**
 * (BONUS) nếu bạn có API leaveGroup riêng, copy dùng.
 * Không bắt buộc.
 */
exports.leave = async ({ groupId, userId }) => {
  const m = await GroupMember.findOne({ groupId, userId }).select("role").lean();
  if (!m) return { ok: true };
  if (m.role === "owner") throw httpError(400, "OWNER_CANNOT_LEAVE");

  await GroupMember.deleteOne({ groupId, userId });

  const [group, leaver] = await Promise.all([
    Group.findById(groupId).select("name ownerId").lean(),
    User.findById(userId).select("name email").lean(),
  ]);

  if (group?.ownerId) {
    await createGroupNotification({
      userId: group.ownerId,
      level: "info",
      title: "Thành viên rời nhóm",
      message: `${leaver?.name || leaver?.email || "Ai đó"} đã rời nhóm "${group?.name || "nhóm"}".`,
      event: "group.member.left",
      link: `/groups/${groupId}`,
      entityKind: "group",
      entityId: groupId,
      dedupeKey: `group.member.left:${groupId}:${userId}:${new Date().toISOString().slice(0, 10)}`,
      data: { groupId, groupName: group?.name, userId },
    });
  }

  return { ok: true };
};

/**
 * (BONUS) đổi role => notify target
 * Không bắt buộc.
 */
exports.setRole = async ({ groupId, actorId, targetUserId, role }) => {
  await requireManageRole(groupId, actorId);
  if (!["admin", "member"].includes(role)) throw httpError(400, "INVALID_ROLE");

  const target = await GroupMember.findOne({ groupId, userId: targetUserId });
  if (!target) throw httpError(404, "MEMBER_NOT_FOUND");
  if (target.role === "owner") throw httpError(400, "CANNOT_CHANGE_OWNER_ROLE");

  target.role = role;
  await target.save();

  const [group, actor] = await Promise.all([
    Group.findById(groupId).select("name").lean(),
    User.findById(actorId).select("name email").lean(),
  ]);

  await createGroupNotification({
    userId: targetUserId,
    level: "info",
    title: "Vai trò trong nhóm đã thay đổi",
    message: `${actor?.name || actor?.email || "Ai đó"} đã đổi vai trò của bạn trong nhóm "${
      group?.name || "nhóm"
    }" thành "${role}".`,
    event: "group.member.role.changed",
    link: `/groups/${groupId}`,
    entityKind: "group",
    entityId: groupId,
    dedupeKey: `group.member.role.changed:${groupId}:${targetUserId}:${role}:${new Date()
      .toISOString()
      .slice(0, 10)}`,
    data: { groupId, groupName: group?.name, actorId, targetUserId, role },
  });

  return target.toObject();
};
