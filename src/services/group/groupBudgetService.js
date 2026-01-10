const mongoose = require("mongoose");
const GroupBudget = require("../../models/group/groupBudget");
const GroupCategory = require("../../models/group/groupCategory");
const GroupTransaction = require("../../models/group/groupTransaction");
const { requireMembership, requireManageRole } = require("./groupService");
const { httpError } = require("./_errors");

function parseDateOnlyUTC(s) {
  if (!s) return new Date(NaN);
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  return new Date(s);
}

function isValidDate(d) {
  return d instanceof Date && Number.isFinite(d.getTime());
}

function startOfUTCDay(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 0, 0, 0, 0));
}

function nextUTCDayStart(d) {
  const s = startOfUTCDay(d);
  return new Date(s.getTime() + 24 * 60 * 60 * 1000);
}

function toDateOnlyUTCString(d) {
  if (!d) return null;
  const x = new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function flattenBudget(b) {
  if (!b) return b;
  return {
    ...b,
    startDate: toDateOnlyUTCString(b.startDate),
    endDate: toDateOnlyUTCString(b.endDate),
    category: b.categoryId || null,
    categoryName: b.categoryId?.name || null,
  };
}

function toObjectId(x) {
  if (!x) return null;
  if (x instanceof mongoose.Types.ObjectId) return x;
  if (mongoose.Types.ObjectId.isValid(String(x))) return new mongoose.Types.ObjectId(String(x));
  return null;
}

exports.list = async ({ groupId, userId }) => {
  await requireMembership(groupId, userId);

  const rows = await GroupBudget.find({ groupId, isActive: true })
    .sort({ createdAt: -1 })
    .populate({ path: "categoryId", select: "name type icon" })
    .lean();

  return rows.map(flattenBudget);
};

exports.create = async ({ groupId, userId, body }) => {
  await requireManageRole(groupId, userId);

  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "NAME_REQUIRED");

  const limitAmount = Number(body.limitAmount ?? body.amount);
  if (!Number.isFinite(limitAmount) || limitAmount <= 0) throw httpError(400, "INVALID_LIMIT");

  if (!body.categoryId) throw httpError(400, "CATEGORY_REQUIRED");

  const cat = await GroupCategory.findOne({
    _id: body.categoryId,
    groupId,
    isActive: true,
    type: "expense",
  }).lean();
  if (!cat) throw httpError(404, "CATEGORY_NOT_FOUND");

  const startRaw = parseDateOnlyUTC(body.startDate);
  const endRaw = parseDateOnlyUTC(body.endDate);
  if (!isValidDate(startRaw) || !isValidDate(endRaw)) throw httpError(400, "INVALID_DATE");

  const startDate = startOfUTCDay(startRaw);
  const endDate = startOfUTCDay(endRaw);
  if (startDate > endDate) throw httpError(400, "INVALID_RANGE");

  const created = await GroupBudget.create({
    groupId,
    createdBy: userId,
    name,
    period: body.period || "custom",
    startDate,
    endDate,
    scope: "category",
    categoryId: cat._id,
    walletId: null,
    limitAmount,
    isActive: true,
  });

  const doc = await GroupBudget.findById(created._id)
    .populate({ path: "categoryId", select: "name type icon" })
    .lean();

  return flattenBudget(doc);
};

exports.disable = async ({ groupId, userId, budgetId }) => {
  await requireManageRole(groupId, userId);

  const r = await GroupBudget.updateOne(
    { _id: budgetId, groupId, isActive: true },
    { $set: { isActive: false } }
  );

  if (!r.matchedCount) throw httpError(404, "BUDGET_NOT_FOUND");
  return { ok: true };
};

exports.progress = async ({ groupId, userId, budgetId }) => {
  await requireMembership(groupId, userId);

  const b = await GroupBudget.findOne({ _id: budgetId, groupId, isActive: true })
    .populate({ path: "categoryId", select: "name type icon" })
    .lean();

  if (!b) throw httpError(404, "BUDGET_NOT_FOUND");

  const catIdRaw = b.categoryId?._id || b.categoryId;
  const groupObjId = toObjectId(groupId);
  const catObjId = toObjectId(catIdRaw);

  if (!groupObjId) throw httpError(400, "INVALID_GROUP_ID");
  if (!catObjId) throw httpError(400, "BUDGET_CATEGORY_MISSING");

  const start = startOfUTCDay(b.startDate);
  const endExclusive = nextUTCDayStart(b.endDate);

  const matchAgg = {
    groupId: groupObjId,
    isActive: true,
    type: "expense",
    categoryId: catObjId,
    occurredAt: { $gte: start, $lt: endExclusive },
  };

  const agg = await GroupTransaction.aggregate([
    { $match: matchAgg },
    {
      $group: {
        _id: null,
        spent: {
          $sum: {
            $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 },
          },
        },
      },
    },
  ]);

  const spent = agg[0]?.spent || 0;

  return {
    budget: flattenBudget(b),
    spent,
    remaining: Math.max(0, b.limitAmount - spent),
    percent: b.limitAmount > 0 ? Math.min(100, (spent / b.limitAmount) * 100) : 0,
  };
};
