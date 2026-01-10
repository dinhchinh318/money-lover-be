const mongoose = require("mongoose");
const GroupWallet = require("../../models/group/groupWallet");
const GroupTransaction = require("../../models/group/groupTransaction");
const { requireMembership, requireManageRole } = require("./groupService");
const { httpError } = require("./_errors");

function toNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

exports.list = async ({ groupId, userId }) => {
  await requireMembership(groupId, userId);
  return GroupWallet.find({ groupId, isActive: true })
    .sort({ createdAt: -1 })
    .lean();
};

exports.create = async ({ groupId, userId, body }) => {
  await requireManageRole(groupId, userId);

  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "NAME_REQUIRED");

  const balance = toNumber(body.balance, 0);

  const wallet = await GroupWallet.create({
    groupId,
    createdBy: userId,
    name,
    currency: body.currency || "VND",
    balance,
  });

  return wallet.toObject();
};

exports.update = async ({ groupId, userId, walletId, body }) => {
  await requireManageRole(groupId, userId);

  const doc = await GroupWallet.findOne({ _id: walletId, groupId, isActive: true });
  if (!doc) throw httpError(404, "WALLET_NOT_FOUND");

  if (body.name != null) doc.name = String(body.name).trim();
  if (body.currency != null) doc.currency = String(body.currency).trim();

  if (body.balance != null) doc.balance = toNumber(body.balance, doc.balance);

  await doc.save();
  return doc.toObject();
};

exports.disable = async ({ groupId, userId, walletId }) => {
  await requireManageRole(groupId, userId);
  await GroupWallet.updateOne({ _id: walletId, groupId }, { $set: { isActive: false } });
  return { ok: true };
};

exports.getById = async ({ groupId, walletId, session }) => {
  const q = { _id: walletId, groupId, isActive: true };
  const opt = session ? { session } : undefined;
  return GroupWallet.findOne(q, null, opt).lean();
};

exports.incBalance = async ({ groupId, walletId, delta, session }) => {
  const d = toNumber(delta, 0);
  if (d === 0) return;

  const q = { _id: walletId, groupId, isActive: true };
  const upd = { $inc: { balance: d } };
  const opt = session ? { session } : undefined;
  await GroupWallet.updateOne(q, upd, opt);
};

exports.applyTransactionEffect = async ({ groupId, tx, session }) => {
  const amount = toNumber(tx.amount, 0);
  if (!tx?.isActive) return;

  if (tx.type === "income") {
    await exports.incBalance({ groupId, walletId: tx.walletId, delta: +amount, session });
    return;
  }

  if (tx.type === "expense") {
    await exports.incBalance({ groupId, walletId: tx.walletId, delta: -amount, session });
    return;
  }

  if (tx.type === "transfer") {
    await exports.incBalance({ groupId, walletId: tx.fromWalletId, delta: -amount, session });
    await exports.incBalance({ groupId, walletId: tx.toWalletId, delta: +amount, session });
  }
};

exports.revertTransactionEffect = async ({ groupId, tx, session }) => {
  const amount = toNumber(tx.amount, 0);
  if (!tx?.isActive) return;

  if (tx.type === "income") {
    await exports.incBalance({ groupId, walletId: tx.walletId, delta: -amount, session });
    return;
  }

  if (tx.type === "expense") {
    await exports.incBalance({ groupId, walletId: tx.walletId, delta: +amount, session });
    return;
  }

  if (tx.type === "transfer") {
    await exports.incBalance({ groupId, walletId: tx.fromWalletId, delta: +amount, session });
    await exports.incBalance({ groupId, walletId: tx.toWalletId, delta: -amount, session });
  }
};

exports.recalcBalance = async ({ groupId, userId, walletId }) => {
  await requireManageRole(groupId, userId);

  const wallet = await GroupWallet.findOne({ _id: walletId, groupId }).lean();
  if (!wallet) throw httpError(404, "WALLET_NOT_FOUND");

  const gid = new mongoose.Types.ObjectId(groupId);
  const wid = new mongoose.Types.ObjectId(walletId);

  const res = await GroupTransaction.aggregate([
    {
      $match: {
        groupId: gid,
        isActive: true,
        $or: [{ walletId: wid }, { fromWalletId: wid }, { toWalletId: wid }],
      },
    },
    {
      $group: {
        _id: null,
        income: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "income"] }, { $eq: ["$walletId", wid] }] },
              "$amount",
              0,
            ],
          },
        },
        expense: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "expense"] }, { $eq: ["$walletId", wid] }] },
              "$amount",
              0,
            ],
          },
        },
        transferOut: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "transfer"] }, { $eq: ["$fromWalletId", wid] }] },
              "$amount",
              0,
            ],
          },
        },
        transferIn: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "transfer"] }, { $eq: ["$toWalletId", wid] }] },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const sums = res?.[0] || { income: 0, expense: 0, transferOut: 0, transferIn: 0 };

  const next =
    toNumber(sums.income, 0) -
    toNumber(sums.expense, 0) -
    toNumber(sums.transferOut, 0) +
    toNumber(sums.transferIn, 0);

  await GroupWallet.updateOne({ _id: walletId, groupId }, { $set: { balance: next } });
  return { walletId, balance: next };
};
