// services/budgetService.js
const Budget = require("../models/budget");
const Category = require("../models/category");
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const mongoose = require("mongoose");

// ✅ notification service
const { createNotification } = require("./notificationService");

/* -----------------------------
 * ✅ Period / Range helpers
 * ----------------------------- */

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

// ✅ Nếu budget có start/end => dùng range đó
// ✅ Nếu không có => weekly/monthly theo refDate (mặc định hôm nay)
const computeBudgetRange = (budget, refDate = new Date()) => {
  const period = budget?.period || "monthly";
  const ref = refDate ? new Date(refDate) : new Date();

  if (budget?.start_date || budget?.end_date) {
    const from = budget?.start_date ? startOfDay(budget.start_date) : null;
    const to = budget?.end_date ? endOfDay(budget.end_date) : null;
    return { from, to };
  }

  if (period === "weekly") {
    const d = startOfDay(ref);
    const day = d.getDay(); // 0..6 (CN..T7)
    const diffToMon = (day === 0 ? -6 : 1) - day; // đưa về Thứ 2
    d.setDate(d.getDate() + diffToMon);

    const from = startOfDay(d);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from, to: endOfDay(to) };
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

/* -----------------------------
 * ✅ Notification helpers
 * ----------------------------- */

const buildBudgetPeriodKey = (budget, range) => {
  const period = budget?.period || "monthly";
  const key = range ? rangeKey(range) : "null:null";
  return `${period}:${key}`;
};

const estimateBudgetExpiresAt = (budget, range) => {
  // ưu tiên theo to của range
  if (range?.to) {
    const d = new Date(range.to);
    d.setDate(d.getDate() + 30);
    return d;
  }

  // fallback end_date
  if (budget?.end_date) {
    const d = new Date(budget.end_date);
    d.setDate(d.getDate() + 30);
    return d;
  }

  // fallback 60 ngày
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d;
};

const maybeNotifyBudgetThresholds = async ({ userId, budget, spent, range }) => {
  try {
    const limit = Number(budget?.limit_amount || 0);
    if (!limit || limit <= 0) return;

    const percentRaw = (Number(spent) / limit) * 100;
    const percent = Math.floor(percentRaw);

    const periodKey = buildBudgetPeriodKey(budget, range);
    const expiresAt = estimateBudgetExpiresAt(budget, range);

    const budgetName = budget?.name || "Ngân sách";
    const catName = budget?.category?.name || "Danh mục";
    const walletName = budget?.wallet?.name || "";

    const base = {
      type: "budget",
      link: `/budgets/${budget._id}`,
      entity: { kind: "budget", id: budget._id },
      data: {
        budgetId: budget._id,
        spent,
        limit,
        percent,
        categoryId: budget?.category?._id || budget?.category,
        walletId: budget?.wallet?._id || budget?.wallet,
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
    console.error("❌ [budget notify] Error:", e?.message || e);
  }
};

/* -----------------------------
 * ✅ Spent calculation (fixed)
 * ----------------------------- */

const toObjectId = (v) => {
  if (!v) return null;
  if (typeof v === "string") return new mongoose.Types.ObjectId(v);
  if (typeof v === "object" && v._id) return new mongoose.Types.ObjectId(v._id);
  return v;
};

const calculateSpentAmount = async (budget, refDate = new Date()) => {
  try {
    const userIdObj = toObjectId(budget.userId);
    const categoryIdObj = toObjectId(budget.category);
    const walletIdObj = budget.wallet ? toObjectId(budget.wallet) : null;

    if (!userIdObj || !categoryIdObj) return 0;

    const range = computeBudgetRange(budget, refDate);

    const matchQuery = {
      userId: userIdObj,
      categoryId: categoryIdObj,
      type: "expense",
    };

    if (walletIdObj) matchQuery.walletId = walletIdObj;

    if (range.from || range.to) {
      matchQuery.date = {};
      if (range.from) matchQuery.date.$gte = range.from;
      if (range.to) matchQuery.date.$lte = range.to;
    }

    const result = await Transaction.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    return result?.length ? Number(result[0].totalSpent || 0) : 0;
  } catch (error) {
    console.error("❌ [calculateSpentAmount] Error:", error);
    return 0;
  }
};

/* -----------------------------
 * ✅ Service functions
 * ----------------------------- */

const createBudget = async (userId, data) => {
  try {
    if (!data || !userId) {
      return { status: false, error: 1, message: "Invalid data", data: null };
    }

    const normalized = {
      name: data.name,
      categoryId: data.categoryId || data.category,
      walletId: data.walletId || data.wallet,
      limit: data.limit ?? data.limit_amount,
      period: data.period,
      start_date: data.start_date,
      end_date: data.end_date,
      description: data.description,
    };

    const { name, categoryId, walletId, limit, period, start_date, end_date, description } = normalized;

    if (!name || !categoryId || limit == null || isNaN(Number(limit)) || Number(limit) < 0) {
      return { status: false, error: 1, message: "Invalid budget fields", data: null };
    }

    const category = await Category.findOne({ _id: categoryId, userId });
    if (!category || category.type !== "expense") {
      return { status: false, error: 1, message: "Category not found or invalid", data: null };
    }

    if (walletId) {
      const wallet = await Wallet.findOne({ _id: walletId, userId });
      if (!wallet) return { status: false, error: 1, message: "Wallet not found", data: null };
    }

    const doc = {
      userId,
      name: String(name).trim(),
      category: categoryId,
      wallet: walletId || undefined,
      limit_amount: Number(limit),
      period: period || "monthly",
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      description: description || "",
    };

    const budget = await Budget.create(doc);

    const populated = await Budget.findById(budget._id)
      .populate("category")
      .populate("wallet")
      .lean();

    return {
      status: true,
      error: 0,
      message: "Created successfully",
      data: populated || budget.toObject(),
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getBudgetTransactions = async (budgetId, userId) => {
  try {
    const budget = await Budget.findOne({ _id: budgetId, userId })
      .populate("category")
      .populate("wallet")
      .lean();

    if (!budget) return { status: false, error: 1, message: "Budget not found", data: null };

    const range = computeBudgetRange(budget, new Date());

    const query = {
      userId,
      type: "expense",
      categoryId: toObjectId(budget.category),
    };

    if (budget.wallet) query.walletId = toObjectId(budget.wallet);

    if (range.from || range.to) {
      query.date = {};
      if (range.from) query.date.$gte = range.from;
      if (range.to) query.date.$lte = range.to;
    }

    const transactions = await Transaction.find(query).sort({ date: -1 }).lean();

    return { status: true, error: 0, message: "Fetched successfully", data: transactions };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getAllBudgets = async (userId) => {
  try {
    const userIdObj = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    const budgets = await Budget.find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .populate("category")
      .populate("wallet")
      .lean();

    // ✅ spent_amount theo kỳ hiện tại
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const spentAmount = await calculateSpentAmount(budget, new Date());
        return { ...budget, spent_amount: spentAmount };
      })
    );

    return { status: true, error: 0, message: "Fetched successfully", data: budgetsWithSpent };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getBudgetById = async (budgetId, userId) => {
  try {
    const userIdObj = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    const budget = await Budget.findOne({ _id: budgetId, userId: userIdObj })
      .populate("category")
      .populate("wallet")
      .lean();

    if (!budget) return { status: false, error: 1, message: "Budget not found", data: null };

    const spentAmount = await calculateSpentAmount(budget, new Date());

    return {
      status: true,
      error: 0,
      message: "Fetched successfully",
      data: { ...budget, spent_amount: spentAmount },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const updateBudget = async (budgetId, userId, payload = {}) => {
  try {
    if (!budgetId || !userId) {
      return { status: false, error: 1, message: "budgetId and userId required", data: null };
    }

    if (!payload || Object.keys(payload).length === 0) {
      return { status: false, error: 1, message: "No update data provided", data: null };
    }

    const update = {};

    if (payload.name !== undefined) update.name = String(payload.name).trim();

    if (payload.limit !== undefined) {
      const v = Number(payload.limit);
      if (Number.isNaN(v) || v < 0) return { status: false, error: 1, message: "Invalid limit", data: null };
      update.limit_amount = v;
    }

    if (payload.limit_amount !== undefined) {
      const v = Number(payload.limit_amount);
      if (Number.isNaN(v) || v < 0) return { status: false, error: 1, message: "Invalid limit_amount", data: null };
      update.limit_amount = v;
    }

    if (payload.period !== undefined) update.period = payload.period;

    if (payload.start_date !== undefined) update.start_date = payload.start_date ? new Date(payload.start_date) : null;
    if (payload.end_date !== undefined) update.end_date = payload.end_date ? new Date(payload.end_date) : null;

    if (payload.description !== undefined) update.description = payload.description;

    if (payload.categoryId || payload.category) {
      const catId = payload.categoryId || payload.category;
      const cat = await Category.findOne({ _id: catId, userId });
      if (!cat) return { status: false, error: 1, message: "Category invalid or not yours", data: null };
      if (cat.type !== "expense") return { status: false, error: 1, message: "Category must be expense type", data: null };
      update.category = catId;
    }

    if (payload.walletId || payload.wallet) {
      const wId = payload.walletId || payload.wallet;
      if (wId) {
        const w = await Wallet.findOne({ _id: wId, userId });
        if (!w) return { status: false, error: 1, message: "Wallet invalid or not yours", data: null };
        update.wallet = wId;
      } else {
        update.wallet = null;
      }
    }

    const updated = await Budget.findOneAndUpdate({ _id: budgetId, userId }, update, {
      new: true,
      runValidators: true,
    })
      .populate("category")
      .populate("wallet")
      .lean();

    if (!updated) return { status: false, error: 1, message: "Budget not found", data: null };

    // ✅ spent theo kỳ hiện tại + notify theo kỳ hiện tại
    const range = computeBudgetRange(updated, new Date());
    const spentAmount = await calculateSpentAmount(updated, new Date());

    await maybeNotifyBudgetThresholds({
      userId,
      budget: updated,
      spent: spentAmount,
      range,
    });

    return { status: true, error: 0, message: "Updated successfully", data: updated };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const deleteBudget = async (budgetId, userId) => {
  try {
    if (!budgetId || !userId) {
      return { status: false, error: 1, message: "budgetId and userId required", data: null };
    }

    const budget = await Budget.findOne({ _id: budgetId, userId });
    if (!budget) return { status: false, error: 1, message: "Budget not found", data: null };

    if (typeof budget.delete === "function") await budget.delete();
    else await Budget.findByIdAndDelete(budgetId);

    return { status: true, error: 0, message: "Deleted successfully", data: null };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getBudgetStatistics = async (budgetId, userId) => {
  try {
    const budget = await Budget.findOne({ _id: budgetId, userId })
      .populate("category")
      .populate("wallet")
      .lean();

    if (!budget) return { status: false, error: 1, message: "Budget not found", data: null };

    const range = computeBudgetRange(budget, new Date());
    const spent = await calculateSpentAmount(budget, new Date());
    const limit = Number(budget.limit_amount || 0);

    const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const remaining = Math.max(0, limit - spent);

    const matchQuery = {
      userId: toObjectId(userId),
      type: "expense",
      categoryId: toObjectId(budget.category),
    };

    if (budget.wallet) matchQuery.walletId = toObjectId(budget.wallet);

    if (range.from || range.to) {
      matchQuery.date = {};
      if (range.from) matchQuery.date.$gte = range.from;
      if (range.to) matchQuery.date.$lte = range.to;
    }

    const byDate = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      status: true,
      error: 0,
      data: {
        limit,
        spent,
        remaining,
        percent,
        range,
        byDate: byDate.map((i) => ({ date: i._id, amount: i.amount })),
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  createBudget,
  getAllBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
  getBudgetTransactions,
  getBudgetStatistics,
};
