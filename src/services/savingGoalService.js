const SavingGoal = require("../models/savingGoal");
const Wallet = require("../models/wallet");


const createSavingGoal = async (userId, data) => {
  try {
    const { name, walletId, target_amount, target_date, description } = data;

    if (!name || !walletId || !target_amount) {
      return {
        status: false,
        error: 1,
        message: "Missing required fields",
        data: null,
      };
    }

    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) {
      return {
        status: false,
        error: 1,
        message: "Wallet not found",
        data: null,
      };
    }

    const savingGoal = await SavingGoal.create({
      userId,
      name,
      wallet: walletId,
      target_amount: Number(target_amount),
      current_amount: 0,          // 👈 CHỈ DÒNG NÀY
      target_date: target_date ? new Date(target_date) : null,
      description: description || "",
      is_active: true,
      is_completed: false
    });

    return {
      status: true,
      error: 0,
      message: "Saving goal created successfully",
      data: savingGoal,
    };
  } catch (err) {
    return {
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    };
  }
};
const depositToSavingGoal = async (userId, goalId, amount) => {
  if (!amount || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  // 1️⃣ Lấy goal
  const goal = await SavingGoal.findOne({ _id: goalId, userId });
  if (!goal) {
    throw new Error("SavingGoal not found");
  }

  // 2️⃣ Lấy ví
  const wallet = await Wallet.findOne({ _id: goal.wallet, userId });
  if (!wallet) {
    throw new Error("Wallet not found");
  }

  // 3️⃣ Check tiền ví
  if (wallet.balance < amount) {
    throw new Error("Wallet balance not enough");
  }

  // 4️⃣ Trừ ví – cộng goal
  wallet.balance -= amount;
  goal.current_amount += amount;

  // 5️⃣ Nếu đủ target → completed
  if (goal.current_amount >= goal.target_amount) {
    goal.is_completed = true;
    goal.is_active = false;
  }

  // 6️⃣ Save
  await wallet.save();
  await goal.save();

  return goal;
};
const withdrawFromSavingGoal = async (userId, goalId, amount) => {
  if (!amount || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  // 1️⃣ Lấy goal
  const goal = await SavingGoal.findOne({ _id: goalId, userId });
  if (!goal) {
    throw new Error("SavingGoal not found");
  }

  // 2️⃣ Check tiền goal
  if (goal.current_amount < amount) {
    throw new Error("SavingGoal balance not enough");
  }

  // 3️⃣ Lấy ví
  const wallet = await Wallet.findOne({ _id: goal.wallet, userId });

  // 4️⃣ Trừ goal – cộng ví
  goal.current_amount -= amount;
  wallet.balance += amount;

  // 5️⃣ Nếu rút ra < target → active lại
  if (goal.current_amount < goal.target_amount) {
    goal.is_completed = false;
    goal.is_active = true;
  }

  await goal.save();
  await wallet.save();

  return goal;
};

const mapSavingGoalWithProgress = (goal) => {
  const current = goal.current_amount || 0;
  const target = goal.target_amount || 0;

  return {
    ...goal.toObject(),
    progress:
      target > 0 ? Math.min((current / target) * 100, 100) : 0,
  };
};

const getAllSavingGoals = async (userId, options = {}) => {
  try {
    const query = { userId };
    if (options.is_active !== undefined) {
      query.is_active = options.is_active === "true";
    }

    const savingGoals = await SavingGoal.find(query)
      .populate("wallet", "name balance type")
      .sort({ createdAt: -1 });

    const data = savingGoals.map(mapSavingGoalWithProgress);

    return {
      status: true,
      error: 0,
      message: "Get saving goals successfully",
      data,
    };
  } catch (err) {
    return {
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    };
  }
};

const getSavingGoalById = async (userId, id) => {
  try {
    const savingGoal = await SavingGoal.findOne({ _id: id, userId })
      .populate("wallet", "name balance type");

    if (!savingGoal) {
      return {
        status: false,
        error: 1,
        message: "Saving goal not found",
        data: null,
      };
    }

    return {
      status: true,
      error: 0,
      message: "Get saving goal successfully",
      data: mapSavingGoalWithProgress(savingGoal),
    };
  } catch (err) {
    return {
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    };
  }
};

const updateSavingGoal = async (userId, id, data) => {
  try {
    const savingGoal = await SavingGoal.findOne({ _id: id, userId });
    if (!savingGoal) {
      return {
        status: false,
        error: 1,
        message: "Saving goal not found",
        data: null,
      };
    }

    if (data.walletId) {
      const wallet = await Wallet.findOne({ _id: data.walletId, userId });
      if (!wallet) {
        return {
          status: false,
          error: 1,
          message: "Wallet not found",
          data: null,
        };
      }
      savingGoal.wallet = data.walletId;
    }

    if (data.name) savingGoal.name = data.name;
    if (data.target_amount !== undefined)
      savingGoal.target_amount = Number(data.target_amount);
    if (data.target_date !== undefined)
      savingGoal.target_date = data.target_date
        ? new Date(data.target_date)
        : null;
    if (data.description !== undefined)
      savingGoal.description = data.description;
    if (data.is_active !== undefined)
      savingGoal.is_active = data.is_active;

    await savingGoal.save();

    return {
      status: true,
      error: 0,
      message: "Saving goal updated successfully",
      data: savingGoal,
    };
  } catch (err) {
    return {
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    };
  }
};

const deleteSavingGoal = async (userId, id) => {
  try {
    const savingGoal = await SavingGoal.findOne({ _id: id, userId });
    if (!savingGoal) {
      return {
        status: false,
        error: 1,
        message: "Saving goal not found",
        data: null,
      };
    }

    await savingGoal.deleteOne();

    return {
      status: true,
      error: 0,
      message: "Saving goal deleted successfully",
      data: null,
    };
  } catch (err) {
    return {
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    };
  }
};
const completeSavingGoal = async (userId, id) => {
  const goal = await SavingGoal.findOne({ _id: id, userId });
  if (!goal) {
    throw new Error("SavingGoal not found");
  }

  goal.is_completed = true;
  goal.is_active = false; // optional
  goal.target_date = new Date();
  await goal.save();

  return goal;
};


module.exports = {
  createSavingGoal,
  getAllSavingGoals,
  getSavingGoalById,
  updateSavingGoal,
  deleteSavingGoal,
  completeSavingGoal,
  depositToSavingGoal,
  withdrawFromSavingGoal,
};
