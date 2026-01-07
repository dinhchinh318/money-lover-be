const mongoose = require("mongoose");
const GroupTransaction = require("../../models/group/groupTransaction");
const GroupWallet = require("../../models/group/groupWallet");
const GroupCategory = require("../../models/group/groupCategory");
const { requireMembership } = require("./groupService");
const walletSvc = require("./groupWalletService");
const { httpError } = require("./_errors");

function toNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

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

function nextUTCDayStartFromInput(s) {
  const d = parseDateOnlyUTC(s);
  const start = startOfUTCDay(d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

async function assertWallet({ groupId, walletId, session }) {
  const opt = session ? { session } : undefined;
  const w = await GroupWallet.findOne({ _id: walletId, groupId, isActive: true }, null, opt).lean();
  if (!w) throw httpError(404, "WALLET_NOT_FOUND");
  return w;
}

async function assertCategory({ groupId, categoryId, type, session }) {
  const opt = session ? { session } : undefined;
  const q = { _id: categoryId, groupId, isActive: true };
  if (type) q.type = type; // expense -> expense category, income -> income category
  const c = await GroupCategory.findOne(q, null, opt).lean();
  if (!c) throw httpError(404, "CATEGORY_NOT_FOUND");
  return c;
}

function validateSplits(payload) {
  if (!payload.splits) return;
  if (!Array.isArray(payload.splits)) throw httpError(400, "SPLITS_INVALID");
  for (const s of payload.splits) {
    if (!s.userId) throw httpError(400, "SPLIT_USER_REQUIRED");
    if (toNumber(s.amount, -1) < 0) throw httpError(400, "SPLIT_AMOUNT_INVALID");
  }
}

function normalizePayload(payload) {
  const p = { ...payload };
  p.amount = toNumber(p.amount, 0);
  if (p.note != null) p.note = String(p.note);
  if (p.scope == null) p.scope = "group";
  return p;
}

function isMongoTxnNotSupported(err) {
  const msg = String(err?.message || "");
  return err?.code === 20 || msg.includes("Transaction numbers are only allowed on a replica set member or mongos");
}

async function runWithOptionalTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    try {
      let out;
      await session.withTransaction(async () => {
        out = await fn(session);
      });
      return out;
    } catch (e) {
      if (isMongoTxnNotSupported(e)) {
        session.endSession();
        return await fn(null);
      }
      throw e;
    }
  } finally {
    try { session.endSession(); } catch {}
  }
}

exports.list = async ({ groupId, userId, query }) => {
  await requireMembership(groupId, userId);

  const filter = { groupId, isActive: true };

  if (query.scope) filter.scope = query.scope;
  if (query.type) filter.type = query.type;
  if (query.walletId) filter.walletId = query.walletId;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.paidBy) filter.paidBy = query.paidBy;

  if (query.from || query.to) {
    filter.occurredAt = {};
    if (query.from) {
      const from = parseDateOnlyUTC(query.from);
      if (!isValidDate(from)) throw httpError(400, "INVALID_FROM_DATE");
      filter.occurredAt.$gte = from;
    }
    if (query.to) {
      const toEx = nextUTCDayStartFromInput(query.to);
      if (!isValidDate(toEx)) throw httpError(400, "INVALID_TO_DATE");
      filter.occurredAt.$lt = toEx;
    }
  }

  const limit = Math.min(Number(query.limit || 100), 500);

  const rows = await GroupTransaction.find(filter)
    .sort({ occurredAt: -1 })
    .limit(limit)
    .populate({ path: "walletId", select: "name currency" })
    .populate({ path: "categoryId", select: "name type icon" })
    .populate({ path: "fromWalletId", select: "name currency" })
    .populate({ path: "toWalletId", select: "name currency" })
    .lean();

  return rows.map((tx) => ({
    ...tx,
    wallet: tx.walletId || null,
    category: tx.categoryId || null,
    fromWallet: tx.fromWalletId || null,
    toWallet: tx.toWalletId || null,

    walletName: tx.walletId?.name || null,
    categoryName: tx.categoryId?.name || null,
    fromWalletName: tx.fromWalletId?.name || null,
    toWalletName: tx.toWalletId?.name || null,

    currency:
      tx.walletId?.currency ||
      tx.fromWalletId?.currency ||
      tx.toWalletId?.currency ||
      tx.currency ||
      "VND",
  }));
};

exports.create = async ({ groupId, userId, body }) => {
  await requireMembership(groupId, userId);

  const payload = normalizePayload(body);
  validateSplits(payload);

  const { type } = payload;
  if (!["income", "expense", "transfer"].includes(type)) throw httpError(400, "INVALID_TYPE");
  if (!(payload.amount > 0)) throw httpError(400, "AMOUNT_MUST_BE_GT_0");
  if (!payload.occurredAt) throw httpError(400, "OCCURRED_AT_REQUIRED");

  const occurredAt = parseDateOnlyUTC(payload.occurredAt);
  if (!isValidDate(occurredAt)) throw httpError(400, "INVALID_OCCURRED_AT");

  const doc = await runWithOptionalTransaction(async (session) => {
    // transfer
    if (type === "transfer") {
      if (!payload.fromWalletId || !payload.toWalletId) throw httpError(400, "TRANSFER_WALLET_REQUIRED");
      if (String(payload.fromWalletId) === String(payload.toWalletId)) throw httpError(400, "TRANSFER_WALLET_SAME");

      await assertWallet({ groupId, walletId: payload.fromWalletId, session });
      await assertWallet({ groupId, walletId: payload.toWalletId, session });

      const created = await GroupTransaction.create(
        [
          {
            groupId,
            createdBy: userId,
            scope: payload.scope,
            type: "transfer",
            fromWalletId: payload.fromWalletId,
            toWalletId: payload.toWalletId,
            amount: payload.amount,
            note: payload.note || "",
            occurredAt,
            paidBy: payload.paidBy || null,
            splits: payload.splits || [],
            isActive: true,
          },
        ],
        session ? { session } : undefined
      );

      const tx = created[0];
      await walletSvc.applyTransactionEffect({ groupId, tx, session });
      return tx.toObject();
    }

    // income/expense
    if (!payload.walletId) throw httpError(400, "WALLET_REQUIRED");
    if (!payload.categoryId) throw httpError(400, "CATEGORY_REQUIRED");

    await assertWallet({ groupId, walletId: payload.walletId, session });
    await assertCategory({ groupId, categoryId: payload.categoryId, type, session });

    const created = await GroupTransaction.create(
      [
        {
          groupId,
          createdBy: userId,
          scope: payload.scope,
          type,
          walletId: payload.walletId,
          categoryId: payload.categoryId,
          amount: payload.amount,
          note: payload.note || "",
          occurredAt,
          paidBy: payload.paidBy || null,
          splits: payload.splits || [],
          isActive: true,
        },
      ],
      session ? { session } : undefined
    );

    const tx = created[0];
    await walletSvc.applyTransactionEffect({ groupId, tx, session });
    return tx.toObject();
  });

  return doc;
};

exports.update = async ({ groupId, userId, txId, body }) => {
  await requireMembership(groupId, userId);

  const payload = normalizePayload(body);
  validateSplits(payload);

  const affectsBalance =
    payload.type != null ||
    payload.amount != null ||
    payload.walletId != null ||
    payload.fromWalletId != null ||
    payload.toWalletId != null;

  return await runWithOptionalTransaction(async (session) => {
    const opt = session ? { session } : undefined;

    const doc = await GroupTransaction.findOne({ _id: txId, groupId }, null, opt);
    if (!doc) throw httpError(404, "TX_NOT_FOUND");
    if (!doc.isActive) throw httpError(400, "TX_INACTIVE");

    if (affectsBalance) {
      await walletSvc.revertTransactionEffect({ groupId, tx: doc, session });
    }

    if (payload.type != null) {
      if (!["income", "expense", "transfer"].includes(payload.type)) throw httpError(400, "INVALID_TYPE");
      doc.type = payload.type;
    }

    if (payload.amount != null) {
      const amt = toNumber(payload.amount, -1);
      if (!(amt > 0)) throw httpError(400, "AMOUNT_MUST_BE_GT_0");
      doc.amount = amt;
    }
    if (payload.note != null) doc.note = String(payload.note);
    if (payload.scope != null) doc.scope = payload.scope;

    if (payload.occurredAt != null) {
      const d = parseDateOnlyUTC(payload.occurredAt);
      if (!isValidDate(d)) throw httpError(400, "INVALID_OCCURRED_AT");
      doc.occurredAt = d;
    }

    if (payload.paidBy !== undefined) doc.paidBy = payload.paidBy || null;
    if (payload.splits !== undefined) doc.splits = payload.splits || [];

    // type-specific fields
    if (doc.type === "transfer") {
      if (payload.fromWalletId != null) doc.fromWalletId = payload.fromWalletId;
      if (payload.toWalletId != null) doc.toWalletId = payload.toWalletId;

      doc.walletId = null;
      doc.categoryId = null;

      if (!doc.fromWalletId || !doc.toWalletId) throw httpError(400, "TRANSFER_WALLET_REQUIRED");
      if (String(doc.fromWalletId) === String(doc.toWalletId)) throw httpError(400, "TRANSFER_WALLET_SAME");

      await assertWallet({ groupId, walletId: doc.fromWalletId, session });
      await assertWallet({ groupId, walletId: doc.toWalletId, session });
    } else {
      if (payload.walletId != null) doc.walletId = payload.walletId;
      if (payload.categoryId != null) doc.categoryId = payload.categoryId;

      doc.fromWalletId = null;
      doc.toWalletId = null;

      if (!doc.walletId) throw httpError(400, "WALLET_REQUIRED");
      if (!doc.categoryId) throw httpError(400, "CATEGORY_REQUIRED");

      await assertWallet({ groupId, walletId: doc.walletId, session });
      await assertCategory({ groupId, categoryId: doc.categoryId, type: doc.type, session });
    }

    await doc.save(opt);

    if (affectsBalance) {
      await walletSvc.applyTransactionEffect({ groupId, tx: doc, session });
    }

    return doc.toObject();
  });
};

exports.remove = async ({ groupId, userId, txId }) => {
  await requireMembership(groupId, userId);

  await runWithOptionalTransaction(async (session) => {
    const opt = session ? { session } : undefined;

    const doc = await GroupTransaction.findOne({ _id: txId, groupId }, null, opt);
    if (!doc) throw httpError(404, "TX_NOT_FOUND");
    if (!doc.isActive) return;

    await walletSvc.revertTransactionEffect({ groupId, tx: doc, session });
    doc.isActive = false;
    await doc.save(opt);
  });

  return { ok: true };
};
