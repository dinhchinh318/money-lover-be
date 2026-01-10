// services/savingGoalService.js
const SavingGoal = require("../models/savingGoal");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const { createTransaction } = require("./transactionService");

// ✅ Notification
const { createNotification } = require("./notificationService");

/**
 * Helpers
 */
const safeNotify = async (userId, payload) => {
  try {
    await createNotification(userId, payload);
  } catch (e) {
    console.error("❌ [SavingGoal notify] Error:", e?.message || e);
  }
};

const dayKey = () => new Date().toISOString().slice(0, 10);

const estimateGoalExpiresAt = (goal) => {
  // expire sau target_date 30 ngày nếu có, không thì 60 ngày
  if (goal?.target_date) {
    const d = new Date(goal.target_date);
    d.setDate(d.getDate() + 30);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d;
};

const mapSavingGoalWithProgress = (goalDoc) => {
  const goal = goalDoc?.toObject ? goalDoc.toObject() : goalDoc;
  const current = goal.current_amount || 0;
  const target = goal.target_amount || 0;

  return {
    ...goal,
    progress: target > 0 ? Math.min((current / target) * 100, 100) : 0,
  };
};

const getOtherCategoryId = async (userId, type) => {
  const category = await Category.findOne({
    userId,
    name: "Khác",
    type,
  });

  if (!category) {
    throw new Error(`Category 'Khác' (${type}) not found`);
  }

  return category._id;
};

/**
 * Create Saving Goal
 */
const createSavingGoal = async (userId, data) => {
  try {
    const { name, walletId, target_amount, target_date, description } = data;

    if (!name || !walletId || target_amount == null) {
      return { status: false, error: 1, message: "Missing required fields", data: null };
    }

    const wallet = await Wallet.findOne({ _id: walletId, userId }).lean();
    if (!wallet) {
      return { status: false, error: 1, message: "Wallet not found", data: null };
    }

    const savingGoal = await SavingGoal.create({
      userId,
      name: String(name).trim(),
      wallet: walletId,
      target_amount: Number(target_amount),
      current_amount: 0,
      target_date: target_date ? new Date(target_date) : null,
      description: description || "",
      is_active: true,
      is_completed: false,
    });

    // ✅ NOTI: created
    await safeNotify(userId, {
      type: "saving_goal",
      level: "success",
      event: "saving_goal.created",
      title: "Tạo mục tiêu tiết kiệm",
      message: `Đã tạo mục tiêu "${savingGoal.name}".`,
      link: `/saving-goals/${savingGoal._id}`,
      entity: { kind: "saving_goal", id: savingGoal._id },
      dedupeKey: `saving_goal.created:${savingGoal._id}`,
      expiresAt: estimateGoalExpiresAt(savingGoal),
      data: {
        savingGoalId: savingGoal._id,
        targetAmount: savingGoal.target_amount,
        walletId,
      },
    });

    return { status: true, error: 0, message: "Saving goal created successfully", data: savingGoal };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Deposit to Saving Goal
 * - tạo transaction expense (tiền ra khỏi ví để “bỏ vào mục tiêu”)
 * - update current_amount
 * - nếu đạt target -> completed + noti completed
 */
const depositToSavingGoal = async (userId, goalId, amount) => {
  try {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      return { status: false, error: 1, message: "Amount must be greater than 0", data: null };
    }

    const goal = await SavingGoal.findOne({ _id: goalId, userId });
    if (!goal) return { status: false, error: 1, message: "SavingGoal not found", data: null };

    const categoryId = await getOtherCategoryId(userId, "expense");

    const txResult = await createTransaction(userId, {
      walletId: goal.wallet,
      amount: v,
      type: "expense",
      categoryId,
      note: `Thêm tiền vào mục tiêu: ${goal.name}`,
      ref_id: goal._id,
    });

    if (!txResult?.status) {
      return { status: false, error: 1, message: txResult?.message || "Create transaction failed", data: null };
    }

    goal.current_amount = Number(goal.current_amount || 0) + v;

    let justCompleted = false;
    if (goal.current_amount >= Number(goal.target_amount || 0) && Number(goal.target_amount || 0) > 0) {
      if (!goal.is_completed) justCompleted = true;
      goal.is_completed = true;
      goal.is_active = false;
    }

    await goal.save();

    // ✅ NOTI: deposit
    await safeNotify(userId, {
      type: "saving_goal",
      level: "info",
      event: "saving_goal.deposit",
      title: "Nạp vào mục tiêu",
      message: `Bạn đã nạp ${v} vào "${goal.name}". Hiện tại: ${goal.current_amount}/${goal.target_amount}.`,
      link: `/saving-goals/${goal._id}`,
      entity: { kind: "saving_goal", id: goal._id },
      dedupeKey: `saving_goal.deposit:${goal._id}:${dayKey()}`,
      expiresAt: estimateGoalExpiresAt(goal),
      data: {
        savingGoalId: goal._id,
        amount: v,
        currentAmount: goal.current_amount,
        targetAmount: goal.target_amount,
      },
    });

    // ✅ NOTI: completed (nếu vừa đạt)
    if (justCompleted) {
      await safeNotify(userId, {
        type: "saving_goal",
        level: "success",
        event: "saving_goal.completed",
        title: "Hoàn thành mục tiêu 🎉",
        message: `Chúc mừng! Bạn đã hoàn thành mục tiêu "${goal.name}".`,
        link: `/saving-goals/${goal._id}`,
        entity: { kind: "saving_goal", id: goal._id },
        dedupeKey: `saving_goal.completed:${goal._id}`,
        expiresAt: estimateGoalExpiresAt(goal),
        data: { savingGoalId: goal._id },
      });
    }

    return { status: true, error: 0, message: "Deposit successfully", data: mapSavingGoalWithProgress(goal) };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Withdraw from Saving Goal
 * - tạo transaction income (tiền “rút” về ví)
 * - update current_amount
 */
const withdrawFromSavingGoal = async (userId, goalId, amount) => {
  try {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      return { status: false, error: 1, message: "Amount must be greater than 0", data: null };
    }

    const goal = await SavingGoal.findOne({ _id: goalId, userId });
    if (!goal) return { status: false, error: 1, message: "SavingGoal not found", data: null };

    const cur = Number(goal.current_amount || 0);
    if (cur < v) {
      return { status: false, error: 1, message: "SavingGoal balance not enough", data: null };
    }

    const categoryId = await getOtherCategoryId(userId, "income");

    const txResult = await createTransaction(userId, {
      walletId: goal.wallet,
      amount: v,
      type: "income",
      categoryId,
      note: `Rút tiền từ mục tiêu: ${goal.name}`,
      ref_id: goal._id,
    });

    if (!txResult?.status) {
      return { status: false, error: 1, message: txResult?.message || "Create transaction failed", data: null };
    }

    goal.current_amount = cur - v;

    if (Number(goal.target_amount || 0) > 0 && goal.current_amount < Number(goal.target_amount || 0)) {
      goal.is_completed = false;
      goal.is_active = true;
    }

    await goal.save();

    // ✅ NOTI: withdraw
    await safeNotify(userId, {
      type: "saving_goal",
      level: "warning",
      event: "saving_goal.withdraw",
      title: "Rút khỏi mục tiêu",
      message: `Bạn đã rút ${v} từ "${goal.name}". Hiện tại: ${goal.current_amount}/${goal.target_amount}.`,
      link: `/saving-goals/${goal._id}`,
      entity: { kind: "saving_goal", id: goal._id },
      dedupeKey: `saving_goal.withdraw:${goal._id}:${dayKey()}`,
      expiresAt: estimateGoalExpiresAt(goal),
      data: {
        savingGoalId: goal._id,
        amount: v,
        currentAmount: goal.current_amount,
        targetAmount: goal.target_amount,
      },
    });

    return { status: true, error: 0, message: "Withdraw successfully", data: mapSavingGoalWithProgress(goal) };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Get all saving goals
 */
const getAllSavingGoals = async (userId, options = {}) => {
  try {
    const query = { userId };
    if (options.is_active !== undefined) query.is_active = options.is_active === "true";

    const savingGoals = await SavingGoal.find(query)
      .populate("wallet", "name balance type")
      .sort({ createdAt: -1 });

    const data = savingGoals.map(mapSavingGoalWithProgress);

    return { status: true, error: 0, message: "Get saving goals successfully", data };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Get saving goal by id
 */
const getSavingGoalById = async (userId, id) => {
  try {
    const savingGoal = await SavingGoal.findOne({ _id: id, userId }).populate("wallet", "name balance type");
    if (!savingGoal) return { status: false, error: 1, message: "Saving goal not found", data: null };

    return { status: true, error: 0, message: "Get saving goal successfully", data: mapSavingGoalWithProgress(savingGoal) };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Update saving goal
 */
const updateSavingGoal = async (userId, id, data) => {
  try {
    const savingGoal = await SavingGoal.findOne({ _id: id, userId });
    if (!savingGoal) return { status: false, error: 1, message: "Saving goal not found", data: null };

    if (data.walletId) {
      const wallet = await Wallet.findOne({ _id: data.walletId, userId }).lean();
      if (!wallet) return { status: false, error: 1, message: "Wallet not found", data: null };
      savingGoal.wallet = data.walletId;
    }

    if (data.name !== undefined) savingGoal.name = String(data.name).trim();
    if (data.target_amount !== undefined) savingGoal.target_amount = Number(data.target_amount);
    if (data.target_date !== undefined) savingGoal.target_date = data.target_date ? new Date(data.target_date) : null;
    if (data.description !== undefined) savingGoal.description = data.description;
    if (data.is_active !== undefined) savingGoal.is_active = !!data.is_active;

    await savingGoal.save();

    // ✅ NOTI: updated
    await safeNotify(userId, {
      type: "saving_goal",
      level: "info",
      event: "saving_goal.updated",
      title: "Cập nhật mục tiêu",
      message: `Đã cập nhật mục tiêu "${savingGoal.name}".`,
      link: `/saving-goals/${savingGoal._id}`,
      entity: { kind: "saving_goal", id: savingGoal._id },
      dedupeKey: `saving_goal.updated:${savingGoal._id}:${dayKey()}`,
      expiresAt: estimateGoalExpiresAt(savingGoal),
      data: { savingGoalId: savingGoal._id },
    });

    return { status: true, error: 0, message: "Saving goal updated successfully", data: savingGoal };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Delete saving goal
 */
const deleteSavingGoal = async (userId, id) => {
  try {
    const savingGoal = await SavingGoal.findOne({ _id: id, userId });
    if (!savingGoal) return { status: false, error: 1, message: "Saving goal not found", data: null };

    // nếu dùng mongoose-delete plugin
    if (typeof savingGoal.delete === "function") await savingGoal.delete();
    else await savingGoal.deleteOne();

    // ✅ NOTI: deleted
    await safeNotify(userId, {
      type: "saving_goal",
      level: "warning",
      event: "saving_goal.deleted",
      title: "Đã xóa mục tiêu",
      message: `Đã xóa mục tiêu "${savingGoal.name}".`,
      dedupeKey: `saving_goal.deleted:${savingGoal._id}:${dayKey()}`,
      data: { savingGoalId: savingGoal._id },
    });

    return { status: true, error: 0, message: "Saving goal deleted successfully", data: null };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
};

/**
 * Complete saving goal (manual)
 */
const completeSavingGoal = async (userId, id) => {
  try {
    const goal = await SavingGoal.findOne({ _id: id, userId });
    if (!goal) return { status: false, error: 1, message: "SavingGoal not found", data: null };

    goal.is_completed = true;
    goal.is_active = false;
    goal.target_date = new Date();
    await goal.save();

    // ✅ NOTI: completed
    await safeNotify(userId, {
      type: "saving_goal",
      level: "success",
      event: "saving_goal.completed",
      title: "Hoàn thành mục tiêu 🎉",
      message: `Bạn đã đánh dấu hoàn thành mục tiêu "${goal.name}".`,
      link: `/saving-goals/${goal._id}`,
      entity: { kind: "saving_goal", id: goal._id },
      dedupeKey: `saving_goal.completed:${goal._id}`,
      expiresAt: estimateGoalExpiresAt(goal),
      data: { savingGoalId: goal._id },
    });

    return { status: true, error: 0, message: "Completed successfully", data: goal };
  } catch (err) {
    return { status: false, error: -1, message: err.message || "Server error", data: null };
  }
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
