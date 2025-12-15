// services/budgetService.js
const Budget = require("../models/budget");
const Category = require("../models/category");
const Wallet = require("../models/wallet");

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

    const {
      name,
      categoryId,
      walletId,
      limit,
      period,
      start_date,
      end_date,
      description,
    } = data;

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
      wallet: walletId || null,
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

const getAllBudgets = async (userId) => {
  try {
    const budgets = await Budget.find({ userId })
      .sort({ createdAt: -1 })
      .populate("category")
      .populate("wallet")
      .lean();

    return {
      status: true,
      error: 0,
      message: "Fetched successfully",
      data: budgets,
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
    const budget = await Budget.findOne({ _id: budgetId, userId })
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

    return {
      status: true,
      error: 0,
      message: "Fetched successfully",
      data: budget,
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

module.exports = {
  createBudget,
  getAllBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
};
