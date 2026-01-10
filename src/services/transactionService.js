// services/transactionService.js
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const Budget = require("../models/budget");
const mongoose = require("mongoose");

// ✅ Notification
const { createNotification } = require("./notificationService");

/**
 * Helpers
 */
const assertPositiveNumber = (n, msg = "Amount must be a positive number") => {
  if (!Number.isFinite(n) || n <= 0) throw new Error(msg);
};

const assertNonNegativeNumber = (n, msg = "Value must be a non-negative number") => {
  if (!Number.isFinite(n) || n < 0) throw new Error(msg);
};

const updateWalletBalance = async (walletId, toWalletId, amount, type, session, extra = {}) => {
  switch (type) {
    case "income":
    case "loan":
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: amount } }, { session });
      break;

    case "expense":
    case "debt":
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
      break;

    case "transfer":
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
      await Wallet.findByIdAndUpdate(toWalletId, { $inc: { balance: amount } }, { session });
      break;

    case "adjust":
      // SET balance = số dư mới
      await Wallet.findByIdAndUpdate(walletId, { $set: { balance: extra.adjustTo } }, { session });
      break;
  }
};

const revertWalletBalance = async (walletId, toWalletId, amount, type, session, extra = {}) => {
  switch (type) {
    case "income":
    case "loan":
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: -amount } }, { session });
      break;

    case "expense":
    case "debt":
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: amount } }, { session });
      break;

    case "transfer":
      await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: amount } }, { session });
      await Wallet.findByIdAndUpdate(toWalletId, { $inc: { balance: -amount } }, { session });
      break;

    case "adjust":
      // SET balance về số cũ
      await Wallet.findByIdAndUpdate(walletId, { $set: { balance: extra.adjustFrom } }, { session });
      break;
  }
};

// -------------------------
// ✅ Budget notification helpers (FIXED: populate object + yearly)
// -------------------------

const toObjectId = (v) => {
  if (!v) return null;
  if (typeof v === "string") return new mongoose.Types.ObjectId(v);
  if (v?._id) return new mongoose.Types.ObjectId(v._id);
  return v; // ObjectId rồi
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const computePeriodRange = (budget, refDate) => {
  const period = budget?.period || "monthly";
  const ref = refDate ? new Date(refDate) : new Date();

  // nếu budget có start/end cụ thể => dùng nguyên range đó (custom cũng rơi vào đây)
  if (budget?.start_date || budget?.end_date) {
    const from = budget?.start_date ? startOfDay(budget.start_date) : null;
    const to = budget?.end_date ? endOfDay(budget.end_date) : null;
    return { from, to };
  }

  if (period === "weekly") {
    const d = startOfDay(ref);
    const day = d.getDay(); // 0..6 (CN..T7)
    const diffToMon = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diffToMon);
    const from = startOfDay(d);

    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from, to: endOfDay(to) };
  }

  if (period === "yearly") {
    const from = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { from, to };
  }

  // monthly default
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
};

const rangeKey = ({ from, to }) => {
  const f = from ? new Date(from).toISOString().slice(0, 10) : "null";
  const t = to ? new Date(to).toISOString().slice(0, 10) : "null";
  return `${f}:${t}`;
};

const estimateExpiresAtFromRange = ({ to }) => {
  // expire sau khi kỳ kết thúc 30 ngày
  if (to) {
    const d = new Date(to);
    d.setDate(d.getDate() + 30);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d;
};

const calcSpentForBudget = async ({ userId, budget, refDate }) => {
  const userIdObj = toObjectId(userId);
  const { from, to } = computePeriodRange(budget, refDate);

  const match = {
    userId: userIdObj,
    type: "expense",
    // ✅ FIX: budget.category có thể là object đã populate
    categoryId: toObjectId(budget.category),
  };

  // budget.wallet null => áp dụng cho mọi ví
  if (budget.wallet) {
    // ✅ FIX: budget.wallet có thể là object đã populate
    match.walletId = toObjectId(budget.wallet);
  }

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lte = to;
  }

  const result = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
  ]);

  const spent = result?.[0]?.totalSpent ? Number(result[0].totalSpent) : 0;
  return { spent, range: { from, to } };
};

const notifyBudgetThresholds = async ({ userId, budget, spent, range }) => {
  try {
    const limit = Number(budget?.limit_amount || 0);
    if (!limit || limit <= 0) return;

    const percentRaw = (Number(spent) / limit) * 100;
    const percent = Math.floor(percentRaw);

    const periodKey = `${budget?.period || "monthly"}:${rangeKey(range)}`; // ✅ add period
    const expiresAt = estimateExpiresAtFromRange(range);

    const budgetName = budget?.name || "Ngân sách";
    const catName = budget?.category?.name || budget?.categoryName || "Danh mục";
    const walletName = budget?.wallet?.name || budget?.walletName || "";

    const base = {
      type: "budget",
      link: `/budgets/${budget._id}`,
      entity: { kind: "budget", id: budget._id },
      data: {
        budgetId: budget._id,
        spent,
        limit,
        percent,
        periodKey,
        range,
      },
      expiresAt,
    };

    if (percentRaw >= 80) {
      await createNotification(userId, {
        ...base,
        event: "budget.warning80",
        level: "warning",
        title: "Sắp chạm giới hạn ngân sách",
        message: `Bạn đã dùng ${percent}% ngân sách "${budgetName}" (${catName}${walletName ? ` • ${walletName}` : ""}).`,
        dedupeKey: `budget.warning80:${budget._id}:${periodKey}`,
      });
    }

    if (percentRaw >= 90) {
      await createNotification(userId, {
        ...base,
        event: "budget.warning90",
        level: "warning",
        title: "Ngân sách gần cạn",
        message: `Bạn đã dùng ${percent}% ngân sách "${budgetName}" (${catName}${walletName ? ` • ${walletName}` : ""}).`,
        dedupeKey: `budget.warning90:${budget._id}:${periodKey}`,
      });
    }

    if (percentRaw >= 100) {
      await createNotification(userId, {
        ...base,
        event: "budget.exceeded",
        level: "error",
        title: "Vượt ngân sách",
        message: `Bạn đã vượt ngân sách "${budgetName}" (${catName}${walletName ? ` • ${walletName}` : ""}). Hiện tại: ${percent}%`,
        dedupeKey: `budget.exceeded:${budget._id}:${periodKey}`,
      });
    }
  } catch (e) {
    console.error("❌ [notifyBudgetThresholds] Error:", e?.message || e);
  }
};

const checkBudgetsAfterExpenseChange = async ({ userId, categoryId, walletId, date }) => {
  try {
    if (!userId || !categoryId) return;

    const userIdObj = toObjectId(userId);
    const catObj = toObjectId(categoryId);
    const wObj = walletId ? toObjectId(walletId) : null;

    // query budgets theo category trước
    const budgets = await Budget.find({ userId: userIdObj, category: catObj })
      .populate("category", "name")
      .populate("wallet", "name")
      .lean();

    if (!budgets?.length) return;

    const txDate = date ? new Date(date) : new Date();

    // filter theo wallet + date range budget (nếu có)
    const applicable = budgets.filter((b) => {
      // wallet match: nếu budget.wallet có => tx.wallet phải đúng
      if (b.wallet) {
        if (!wObj) return false;
        const bw = b.wallet?._id || b.wallet;
        if (String(bw) !== String(wObj)) return false;
      }
      // date must be within budget range if start/end exists
      if (b.start_date && txDate < new Date(b.start_date)) return false;
      if (b.end_date && txDate > new Date(b.end_date)) return false;
      return true;
    });

    for (const b of applicable) {
      const { spent, range } = await calcSpentForBudget({ userId, budget: b, refDate: txDate });
      await notifyBudgetThresholds({ userId, budget: b, spent, range });
    }
  } catch (e) {
    console.error("❌ [checkBudgetsAfterExpenseChange] Error:", e?.message || e);
  }
};

// helper tránh check trùng (old/new giống nhau)
const buildExpenseCheckKey = ({ categoryId, walletId, date }) =>
  `${String(categoryId || "")}:${String(walletId || "")}:${date ? new Date(date).toISOString().slice(0, 10) : ""}`;

// -------------------------
// Create
// -------------------------
const createTransaction = async (userId, data) => {
  const session = await mongoose.startSession();
  try {
    let result;
    let createdSnapshot = null;

    await session.withTransaction(async () => {
      const {
        walletId,
        categoryId,
        amount,
        type,
        toWalletId,
        counterpartyName,
        counterpartyContact,
        dueDate,
        adjustReason,
        adjustTo,
        date,
        note,
        imageUrl,
        isRecurring,
        recurringType,
      } = data;

      const wallet = await Wallet.findOne({ _id: walletId, userId }).session(session);
      if (!wallet) throw new Error("Wallet not found or does not belong to you");

      if (categoryId) {
        const category = await Category.findOne({ _id: categoryId, userId }).session(session);
        if (!category) throw new Error("Category not found or does not belong to you");
        if (
          (type === "income" && category.type !== "income") ||
          (type === "expense" && category.type !== "expense")
        ) {
          throw new Error("Category type mismatch");
        }
      }

      if (type === "transfer") {
        if (!toWalletId) throw new Error("Transfer requires toWalletId");
        if (String(toWalletId) === String(walletId)) throw new Error("Không thể chuyển trong cùng 1 ví");

        const toWallet = await Wallet.findOne({ _id: toWalletId, userId }).session(session);
        if (!toWallet) throw new Error("Destination wallet not found or does not belong to you");
      }

      if (type !== "adjust") assertPositiveNumber(amount);

      let adjustFromValue = null;
      let adjustToValue = null;
      if (type === "adjust") {
        if (!adjustReason || String(adjustReason).trim().length === 0) throw new Error("Adjust cần lý do");
        assertNonNegativeNumber(adjustTo, "Adjust requires a valid adjustTo (new balance)");
        adjustFromValue = wallet.balance;
        adjustToValue = adjustTo;
      }

      const transaction = new Transaction({
        userId,
        walletId,
        categoryId: categoryId || null,
        amount: type === "adjust" ? 0 : amount,
        type,
        toWalletId: type === "transfer" ? toWalletId : null,
        counterpartyName: counterpartyName || "",
        counterpartyContact: counterpartyContact || "",
        dueDate: dueDate || null,
        adjustReason: adjustReason || "",
        adjustFrom: adjustFromValue,
        adjustTo: adjustToValue,
        date: date || new Date(),
        note: note || "",
        imageUrl: imageUrl || "",
        isRecurring: !!isRecurring,
        recurringType: recurringType || null,
      });

      await transaction.save({ session });

      if (type === "adjust") {
        await updateWalletBalance(walletId, null, 0, "adjust", session, { adjustTo: adjustToValue });
      } else {
        await updateWalletBalance(walletId, toWalletId, amount, type, session);
      }

      result = await Transaction.findById(transaction._id)
        .populate("walletId", "name type balance")
        .populate("categoryId", "name type icon")
        .populate("toWalletId", "name type balance")
        .session(session);

      // snapshot để check budgets sau commit
      createdSnapshot = {
        type: transaction.type,
        categoryId: transaction.categoryId,
        walletId: transaction.walletId,
        date: transaction.date,
      };
    });

    // ✅ AFTER COMMIT: check budgets nếu expense
    if (createdSnapshot?.type === "expense" && createdSnapshot.categoryId && createdSnapshot.walletId) {
      await checkBudgetsAfterExpenseChange({
        userId,
        categoryId: createdSnapshot.categoryId,
        walletId: createdSnapshot.walletId,
        date: createdSnapshot.date,
      });
    }

    return { status: true, error: 0, message: "Created successfully", data: result.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  } finally {
    session.endSession();
  }
};

// -------------------------
// Update
// -------------------------
const updateTransaction = async (userId, transactionId, data) => {
  const session = await mongoose.startSession();
  try {
    let result;
    let oldSnap = null;
    let newSnap = null;

    await session.withTransaction(async () => {
      const transaction = await Transaction.findOne({ _id: transactionId, userId }).session(session);
      if (!transaction) throw new Error("Transaction not found");

      // snapshot OLD trước khi revert
      oldSnap = {
        type: transaction.type,
        categoryId: transaction.categoryId,
        walletId: transaction.walletId,
        date: transaction.date,
      };

      // 1) Revert OLD
      if (transaction.type === "adjust") {
        if (transaction.adjustFrom == null) throw new Error("Old adjust transaction missing adjustFrom");
        await revertWalletBalance(transaction.walletId, null, 0, "adjust", session, {
          adjustFrom: transaction.adjustFrom,
        });
      } else {
        await revertWalletBalance(
          transaction.walletId,
          transaction.toWalletId,
          transaction.amount,
          transaction.type,
          session
        );
      }

      // 2) Prepare NEW values
      const nextType = data.type ?? transaction.type;
      const nextWalletId = data.walletId ?? transaction.walletId;
      const nextToWalletId = data.toWalletId ?? transaction.toWalletId;

      const wallet = await Wallet.findOne({ _id: nextWalletId, userId }).session(session);
      if (!wallet) throw new Error("Wallet not found or does not belong to you");

      const nextCategoryId = data.categoryId ?? transaction.categoryId;
      if (nextCategoryId) {
        const category = await Category.findOne({ _id: nextCategoryId, userId }).session(session);
        if (!category) throw new Error("Category not found or does not belong to you");
        if (
          (nextType === "income" && category.type !== "income") ||
          (nextType === "expense" && category.type !== "expense")
        ) {
          throw new Error("Category type mismatch");
        }
      }

      if (nextType === "transfer") {
        if (!nextToWalletId) throw new Error("Transfer requires toWalletId");
        if (String(nextToWalletId) === String(nextWalletId)) throw new Error("Không thể chuyển trong cùng 1 ví");

        const toWallet = await Wallet.findOne({ _id: nextToWalletId, userId }).session(session);
        if (!toWallet) throw new Error("Destination wallet not found or does not belong to you");
      }

      Object.assign(transaction, data);

      if (nextType === "adjust") {
        const nextAdjustTo = data.adjustTo ?? transaction.adjustTo;
        const nextAdjustReason = data.adjustReason ?? transaction.adjustReason;

        if (!nextAdjustReason || String(nextAdjustReason).trim().length === 0) throw new Error("Adjust cần lý do");
        assertNonNegativeNumber(nextAdjustTo, "Adjust requires a valid adjustTo (new balance)");

        transaction.amount = 0;
        transaction.toWalletId = null;

        transaction.adjustFrom = wallet.balance;
        transaction.adjustTo = nextAdjustTo;
      } else {
        const nextAmount = data.amount ?? transaction.amount;
        assertPositiveNumber(nextAmount);
        transaction.amount = nextAmount;

        if (nextType !== "transfer") transaction.toWalletId = null;

        transaction.adjustFrom = null;
        transaction.adjustTo = null;
        transaction.adjustReason = "";
      }

      await transaction.save({ session });

      // 3) Apply NEW wallet balance
      if (transaction.type === "adjust") {
        await updateWalletBalance(transaction.walletId, null, 0, "adjust", session, { adjustTo: transaction.adjustTo });
      } else {
        await updateWalletBalance(
          transaction.walletId,
          transaction.toWalletId,
          transaction.amount,
          transaction.type,
          session
        );
      }

      result = await Transaction.findById(transaction._id)
        .populate("walletId", "name type balance")
        .populate("categoryId", "name type icon")
        .populate("toWalletId", "name type balance")
        .session(session);

      // snapshot NEW để check budgets sau commit
      newSnap = {
        type: transaction.type,
        categoryId: transaction.categoryId,
        walletId: transaction.walletId,
        date: transaction.date,
      };
    });

    // ✅ AFTER COMMIT: check budgets affected (old + new)
    const keys = new Set();

    if (oldSnap?.type === "expense" && oldSnap.categoryId && oldSnap.walletId) {
      keys.add(buildExpenseCheckKey(oldSnap));
      await checkBudgetsAfterExpenseChange({
        userId,
        categoryId: oldSnap.categoryId,
        walletId: oldSnap.walletId,
        date: oldSnap.date,
      });
    }

    if (newSnap?.type === "expense" && newSnap.categoryId && newSnap.walletId) {
      const k = buildExpenseCheckKey(newSnap);
      if (!keys.has(k)) {
        await checkBudgetsAfterExpenseChange({
          userId,
          categoryId: newSnap.categoryId,
          walletId: newSnap.walletId,
          date: newSnap.date,
        });
      }
    }

    return { status: true, error: 0, message: "Updated successfully", data: result.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  } finally {
    session.endSession();
  }
};

// -------------------------
// Delete (soft delete) + rollback balance
// -------------------------
const deleteTransaction = async (userId, transactionId) => {
  const session = await mongoose.startSession();
  try {
    let snap = null;

    await session.withTransaction(async () => {
      const transaction = await Transaction.findOne({ _id: transactionId, userId }).session(session);
      if (!transaction) throw new Error("Transaction not found");

      snap = {
        type: transaction.type,
        categoryId: transaction.categoryId,
        walletId: transaction.walletId,
        date: transaction.date,
      };

      if (transaction.type === "adjust") {
        if (transaction.adjustFrom == null) throw new Error("Adjust transaction missing adjustFrom");
        await revertWalletBalance(transaction.walletId, null, 0, "adjust", session, { adjustFrom: transaction.adjustFrom });
      } else {
        await revertWalletBalance(transaction.walletId, transaction.toWalletId, transaction.amount, transaction.type, session);
      }

      await transaction.delete({ session });
    });

    // ✅ AFTER COMMIT: budget re-check (optional)
    if (snap?.type === "expense" && snap.categoryId && snap.walletId) {
      await checkBudgetsAfterExpenseChange({
        userId,
        categoryId: snap.categoryId,
        walletId: snap.walletId,
        date: snap.date,
      });
    }

    return { status: true, error: 0, message: "Deleted successfully", data: null };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  } finally {
    session.endSession();
  }
};

// -------------------------
// Restore + apply lại balance
// -------------------------
const restoreTransaction = async (userId, transactionId) => {
  const session = await mongoose.startSession();
  try {
    let restored;
    let snap = null;

    await session.withTransaction(async () => {
      const transaction = await Transaction.findOneDeleted({ _id: transactionId, userId }).session(session);
      if (!transaction) throw new Error("Transaction not found or not deleted");

      await transaction.restore({ session });

      if (transaction.type === "adjust") {
        if (transaction.adjustTo == null) throw new Error("Adjust transaction missing adjustTo");
        await updateWalletBalance(transaction.walletId, null, 0, "adjust", session, { adjustTo: transaction.adjustTo });
      } else {
        await updateWalletBalance(transaction.walletId, transaction.toWalletId, transaction.amount, transaction.type, session);
      }

      restored = transaction;

      snap = {
        type: transaction.type,
        categoryId: transaction.categoryId,
        walletId: transaction.walletId,
        date: transaction.date,
      };
    });

    // ✅ AFTER COMMIT: budget re-check
    if (snap?.type === "expense" && snap.categoryId && snap.walletId) {
      await checkBudgetsAfterExpenseChange({
        userId,
        categoryId: snap.categoryId,
        walletId: snap.walletId,
        date: snap.date,
      });
    }

    return { status: true, error: 0, message: "Restored successfully", data: restored.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  } finally {
    session.endSession();
  }
};

// -------------------------
// Get all / Get by id / other utils (giữ nguyên)
// -------------------------
const getAllTransactions = async (userId, options = {}) => {
  try {
    const {
      walletId,
      categoryId,
      type,
      startDate,
      endDate,
      isRecurring,
      isSettled,
      page = 1,
      limit = 20,
      sortBy = "-date",
    } = options;

    const query = { userId };

    if (walletId) query.walletId = walletId;
    if (categoryId) query.categoryId = categoryId;
    if (type) query.type = type;
    if (isRecurring !== undefined) query.isRecurring = isRecurring;
    if (isSettled !== undefined) query.isSettled = isSettled;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("walletId", "name type balance")
        .populate("categoryId", "name type icon")
        .populate("toWalletId", "name type balance")
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    return {
      status: true,
      error: 0,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getTransactionById = async (userId, transactionId) => {
  try {
    const transaction = await Transaction.findOne({ _id: transactionId, userId })
      .populate("walletId", "name type balance")
      .populate("categoryId", "name type icon")
      .populate("toWalletId", "name type balance")
      .lean();

    if (!transaction) return { status: false, error: 1, message: "Transaction not found", data: null };
    return { status: true, error: 0, data: transaction };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const settleDebtLoan = async (userId, transactionId) => {
  try {
    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) return { status: false, error: 1, message: "Transaction not found", data: null };
    if (!["debt", "loan"].includes(transaction.type)) {
      return { status: false, error: 1, message: "Only applicable for debt or loan", data: null };
    }
    transaction.isSettled = true;
    await transaction.save();
    return { status: true, error: 0, message: "Settled successfully", data: transaction.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getStatsByCategory = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type } = options;

    const matchQuery = { userId };
    if (type) matchQuery.type = type;
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      {
        $project: {
          categoryId: "$_id",
          categoryName: "$category.name",
          categoryIcon: "$category.icon",
          categoryType: "$category.type",
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return { status: true, error: 0, data: stats };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getOverviewStats = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;

    const userIdObj = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
    const matchQuery = { userId: userIdObj };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        matchQuery.date.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = e;
      }
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$type", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const transactionCount = await Transaction.countDocuments(matchQuery);

    const result = {
      totalIncome: 0,
      totalExpense: 0,
      debt: 0,
      loan: 0,
      transfer: 0,
      adjust: 0,
      transactionCount,
      netIncome: 0,
    };

    stats.forEach((stat) => {
      if (stat._id === "income") result.totalIncome = stat.totalAmount;
      else if (stat._id === "expense") result.totalExpense = stat.totalAmount;
      else result[stat._id] = stat.totalAmount;
    });

    result.netIncome = result.totalIncome - result.totalExpense;

    const wallets = await Wallet.find({ userId: userIdObj, is_archived: false }).lean();
    const totalWalletBalance = wallets.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
    result.totalWalletBalance = totalWalletBalance;

    return {
      status: true,
      error: 0,
      message: "Get overview stats successfully",
      data: result,
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getAllTransactions,
  getTransactionById,
  settleDebtLoan,
  getStatsByCategory,
  getOverviewStats,
};
