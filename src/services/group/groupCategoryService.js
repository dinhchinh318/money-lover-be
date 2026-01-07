const GroupCategory = require("../../models/group/groupCategory");
const { requireMembership, requireManageRole } = require("./groupService");
const { httpError } = require("./_errors");

exports.list = async ({ groupId, userId, type }) => {
  await requireMembership(groupId, userId);
  const q = { groupId, isActive: true };
  if (type) q.type = type;
  return GroupCategory.find(q).sort({ createdAt: -1 }).lean();
};

exports.create = async ({ groupId, userId, body }) => {
  await requireManageRole(groupId, userId);
  const { name, type, icon } = body;

  if (!["income", "expense"].includes(type)) throw httpError(400, "INVALID_TYPE");
  if (!String(name || "").trim()) throw httpError(400, "NAME_REQUIRED");

  const cat = await GroupCategory.create({
    groupId,
    createdBy: userId,
    name: String(name).trim(),
    type,
    isActive: true,
  });

  return cat.toObject();
};

exports.update = async ({ groupId, userId, categoryId, body }) => {
  await requireManageRole(groupId, userId);

  const doc = await GroupCategory.findOne({ _id: categoryId, groupId, isActive: true });
  if (!doc) throw httpError(404, "CATEGORY_NOT_FOUND");

  if (body.name != null) doc.name = String(body.name).trim();

  if (body.type != null) {
    const t = String(body.type).trim();
    if (!["expense", "income"].includes(t)) throw httpError(400, "TYPE_INVALID");
    doc.type = t;
  }

  await doc.save();
  return doc.toObject();
};


exports.disable = async ({ groupId, userId, categoryId }) => {
  await requireManageRole(groupId, userId);
  await GroupCategory.updateOne({ _id: categoryId, groupId }, { $set: { isActive: false } });
  return { ok: true };
};
