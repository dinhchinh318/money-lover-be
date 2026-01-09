// services/budgetService.js
const Budget = require("../models/budget");
const Category = require("../models/category");
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const mongoose = require("mongoose");

const createBudget = async (userId, data) => {
  try {
    if (!data || !userId) {
      return {
        status: false,
        error: 1,
        message: "Invalid data",
        data: null,
      };
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
    const {
      name,
      categoryId,
      walletId,
      limit,
      period,
      start_date,
      end_date,
      description,
    } = normalized;

    if (
      !name ||
      !categoryId ||
      limit == null ||
      isNaN(Number(limit)) ||
      Number(limit) < 0
    ) {
      return {
        status: false,
        error: 1,
        message: "Invalid budget fields",
        data: null,
      };
    }

    // validate category
    const category = await Category.findOne({ _id: categoryId, userId });
    if (!category || category.type !== "expense") {
      return {
        status: false,
        error: 1,
        message: "Category not found or invalid",
        data: null,
      };
    }

    // validate wallet
    if (walletId) {
      const wallet = await Wallet.findOne({ _id: walletId, userId });
      if (!wallet) {
        return {
          status: false,
          error: 1,
          message: "Wallet not found",
          data: null,
        };
      }
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
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};
const getBudgetTransactions = async (budgetId, userId) => {
  try {
    const budget = await Budget.findOne({ _id: budgetId, userId }).lean();
    if (!budget) {
      return {
        status: false,
        error: 1,
        message: "Budget not found",
        data: null,
      };
    }

    const query = {
      userId,
      type: "expense",
      categoryId: budget.category,
    };

    if (budget.wallet) {
      query.walletId = budget.wallet;
    }

    if (budget.start_date || budget.end_date) {
      query.date = {};
      if (budget.start_date) {
        query.date.$gte = new Date(budget.start_date);
      }
      if (budget.end_date) {
        query.date.$lte = new Date(budget.end_date);
      }
    }

    const transactions = await Transaction
      .find(query)
      .sort({ date: -1 })
      .lean();

    return {
      status: true,
      error: 0,
      message: "Fetched successfully",
      data: transactions,
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

// Helper: Tính tổng chi tiêu cho một budget
const calculateSpentAmount = async (budget) => {
  try {
    // Xử lý userId
    let userIdObj;
    if (budget.userId) {
      userIdObj = typeof budget.userId === 'string'
        ? new mongoose.Types.ObjectId(budget.userId)
        : budget.userId;
    } else {
      console.error("Budget missing userId:", budget);
      return 0;
    }

    // Xử lý categoryId
    let categoryIdObj;
    if (budget.category) {
      if (typeof budget.category === 'object' && budget.category._id) {
        categoryIdObj = budget.category._id;
      } else if (typeof budget.category === 'string') {
        categoryIdObj = new mongoose.Types.ObjectId(budget.category);
      } else {
        categoryIdObj = budget.category;
      }
    } else {
      console.error("Budget missing category:", budget);
      return 0;
    }

    // Xây dựng query filter
    const matchQuery = {
      userId: userIdObj,
      categoryId: categoryIdObj,
      type: "expense",
    };

    // Lọc theo wallet nếu có
    if (budget.wallet) {
      let walletIdObj;
      if (typeof budget.wallet === 'object' && budget.wallet._id) {
        walletIdObj = budget.wallet._id;
      } else if (typeof budget.wallet === 'string') {
        walletIdObj = new mongoose.Types.ObjectId(budget.wallet);
      } else {
        walletIdObj = budget.wallet;
      }
      matchQuery.walletId = walletIdObj;
    }

    // Lọc theo khoảng thời gian của budget
    if (budget.start_date || budget.end_date) {
      matchQuery.date = {};
      if (budget.start_date) {
        const startDate = new Date(budget.start_date);
        startDate.setHours(0, 0, 0, 0);
        matchQuery.date.$gte = startDate;
      }
      if (budget.end_date) {
        const endDate = new Date(budget.end_date);
        endDate.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = endDate;
      }
    }

    // Tính tổng chi tiêu
    const result = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$amount" },
        },
      },
    ]);

    const spentAmount = result.length > 0 ? Number(result[0].totalSpent) : 0;

    console.log(`📊 [calculateSpentAmount] Budget: ${budget.name || budget._id}, Spent: ${spentAmount}`, {
      matchQuery: JSON.stringify(matchQuery, null, 2),
      resultCount: result.length,
    });

    return spentAmount;
  } catch (error) {
    console.error("❌ [calculateSpentAmount] Error:", error);
    console.error("Budget data:", JSON.stringify(budget, null, 2));
    return 0;
  }
};

const getAllBudgets = async (userId) => {
  try {
    const userIdObj = typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const budgets = await Budget.find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .populate("category")
      .populate("wallet")
      .lean();

    // Tính spent_amount cho mỗi budget
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const spentAmount = await calculateSpentAmount(budget);
        return {
          ...budget,
          spent_amount: spentAmount,
        };
      })
    );

    return {
      status: true,
      error: 0,
      message: "Fetched successfully",
      data: budgetsWithSpent,
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

const getBudgetById = async (budgetId, userId) => {
  try {
    const userIdObj = typeof userId === 'string'
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const budget = await Budget.findOne({ _id: budgetId, userId: userIdObj })
      .populate("category")
      .populate("wallet")
      .lean();

    if (!budget) {
      return {
        status: false,
        error: 1,
        message: "Budget not found",
        data: null,
      };
    }

    // Tính spent_amount
    const spentAmount = await calculateSpentAmount(budget);

    return {
      status: true,
      error: 0,
      message: "Fetched successfully",
      data: {
        ...budget,
        spent_amount: spentAmount,
      },
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

const updateBudget = async (budgetId, userId, payload = {}) => {
  try {
    if (!budgetId || !userId) {
      return {
        status: false,
        error: 1,
        message: "budgetId and userId required",
        data: null,
      };
    }

    if (!payload || Object.keys(payload).length === 0) {
      return {
        status: false,
        error: 1,
        message: "No update data provided",
        data: null,
      };
    }

    const update = {};

    if (payload.name !== undefined) {
      update.name = String(payload.name).trim();
    }

    if (payload.limit !== undefined) {
      const v = Number(payload.limit);
      if (Number.isNaN(v) || v < 0) {
        return {
          status: false,
          error: 1,
          message: "Invalid limit",
          data: null,
        };
      }
      update.limit_amount = v;
    }

    if (payload.limit_amount !== undefined) {
      const v = Number(payload.limit_amount);
      if (Number.isNaN(v) || v < 0) {
        return {
          status: false,
          error: 1,
          message: "Invalid limit_amount",
          data: null,
        };
      }
      update.limit_amount = v;
    }

    if (payload.period !== undefined) {
      update.period = payload.period;
    }

    if (payload.start_date !== undefined) {
      update.start_date = payload.start_date ? new Date(payload.start_date) : null;
    }

    if (payload.end_date !== undefined) {
      update.end_date = payload.end_date ? new Date(payload.end_date) : null;
    }

    if (payload.description !== undefined) {
      update.description = payload.description;
    }

    if (payload.categoryId || payload.category) {
      const catId = payload.categoryId || payload.category;
      const cat = await Category.findOne({ _id: catId, userId });
      if (!cat) {
        return {
          status: false,
          error: 1,
          message: "Category invalid or not yours",
          data: null,
        };
      }
      if (cat.type !== "expense") {
        return {
          status: false,
          error: 1,
          message: "Category must be expense type",
          data: null,
        };
      }
      update.category = catId;
    }

    if (payload.walletId || payload.wallet) {
      const wId = payload.walletId || payload.wallet;
      if (wId) {
        const w = await Wallet.findOne({ _id: wId, userId });
        if (!w) {
          return {
            status: false,
            error: 1,
            message: "Wallet invalid or not yours",
            data: null,
          };
        }
        update.wallet = wId;
      } else {
        update.wallet = null;
      }
    }

    const updated = await Budget.findOneAndUpdate(
      { _id: budgetId, userId },
      update,
      { new: true, runValidators: true }
    )
      .populate("category")
      .populate("wallet")
      .lean();

    if (!updated) {
      return {
        status: false,
        error: 1,
        message: "Budget not found",
        data: null,
      };
    }

    return {
      status: true,
      error: 0,
      message: "Updated successfully",
      data: updated,
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

const deleteBudget = async (budgetId, userId) => {
  try {
    if (!budgetId || !userId) {
      return {
        status: false,
        error: 1,
        message: "budgetId and userId required",
        data: null,
      };
    }

    const budget = await Budget.findOne({ _id: budgetId, userId });
    if (!budget) {
      return {
        status: false,
        error: 1,
        message: "Budget not found",
        data: null,
      };
    }

    if (typeof budget.delete === "function") {
      await budget.delete();
    } else {
      await Budget.findByIdAndDelete(budgetId);
    }

    return {
      status: true,
      error: 0,
      message: "Deleted successfully",
      data: null,
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};
const getBudgetStatistics = async (budgetId, userId) => {
  try {
    const budget = await Budget.findOne({ _id: budgetId, userId }).lean();
    if (!budget) {
      return {
        status: false,
        error: 1,
        message: "Budget not found",
        data: null,
      };
    }

    // reuse logic cũ
    const spent = await calculateSpentAmount(budget);
    const limit = budget.limit_amount || 0;

    const percent = limit > 0
      ? Math.min(100, Math.round((spent / limit) * 100))
      : 0;

    const remaining = Math.max(0, limit - spent);

    // group theo ngày
    const matchQuery = {
      userId,
      type: "expense",
      categoryId: budget.category,
    };

    if (budget.wallet) {
      matchQuery.walletId = budget.wallet;
    }

    if (budget.start_date || budget.end_date) {
      matchQuery.date = {};
      if (budget.start_date) matchQuery.date.$gte = budget.start_date;
      if (budget.end_date) matchQuery.date.$lte = budget.end_date;
    }

    const byDate = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
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
        byDate: byDate.map(i => ({
          date: i._id,
          amount: i.amount,
        })),
      },
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
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
