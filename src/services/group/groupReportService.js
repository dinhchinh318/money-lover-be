const mongoose = require("mongoose");
const GroupTransaction = require("../../models/group/groupTransaction");
const { requireMembership } = require("./groupService");

function toObjectId(id) {
  if (!id) return null;
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

function buildOccurredAtMatch(from, to) {
  if (!from && !to) return null;

  const occurredAt = {};
  if (from) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    occurredAt.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    occurredAt.$lte = d;
  }
  return occurredAt;
}

exports.summary = async ({ groupId, userId, from, to }) => {
  await requireMembership(groupId, userId);

  const gid = toObjectId(groupId);
  const match = { groupId: gid, isActive: true };

  const occurredAt = buildOccurredAtMatch(from, to);
  if (occurredAt) match.occurredAt = occurredAt;

  const byType = await GroupTransaction.aggregate([
    { $match: match },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);

  const income = byType.find((x) => x._id === "income")?.total || 0;
  const expense = byType.find((x) => x._id === "expense")?.total || 0;

  return { income, expense, net: income - expense };
};

exports.byCategory = async ({ groupId, userId, from, to }) => {
  await requireMembership(groupId, userId);

  const gid = toObjectId(groupId);
  const match = { groupId: gid, isActive: true };

  const occurredAt = buildOccurredAtMatch(from, to);
  if (occurredAt) match.occurredAt = occurredAt;

  return GroupTransaction.aggregate([
    { $match: match },

    {
      $group: {
        _id: "$categoryId",
        total: {
          $sum: {
            $cond: [
              { $eq: ["$type", "income"] },
              "$amount",                       
              { $multiply: ["$amount", -1] },
            ],
          },
        },
      },
    },

    { $sort: { total: -1 } },
  ]);
};


exports.byWallet = async ({ groupId, userId, from, to }) => {
  await requireMembership(groupId, userId);

  const gid = toObjectId(groupId);
  const match = { groupId: gid, isActive: true };

  const occurredAt = buildOccurredAtMatch(from, to);
  if (occurredAt) match.occurredAt = occurredAt;

  return GroupTransaction.aggregate([
    { $match: match },

    {
      $group: {
        _id: "$walletId",
        total: {
          $sum: {
            $cond: [
              { $eq: ["$type", "income"] },
              "$amount",
              { $multiply: ["$amount", -1] },
            ],
          },
        },
      },
    },

    { $sort: { total: -1 } },
  ]);
};

