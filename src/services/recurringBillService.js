// services/recurringBillService.js
const RecurringBill = require("../models/recurringBill");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const Transaction = require("../models/transaction");
const mongoose = require("mongoose");
const dayjs = require("dayjs");

// ✅ Notification
const { createNotification } = require("./notificationService");

/**
 * Helpers
 */
const assertPositiveNumber = (n, msg = "Amount must be a positive number") => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error(msg);
  return v;
};

const safeObjectId = (v) => {
  if (!v) return null;
  return typeof v === "string" ? new mongoose.Types.ObjectId(v) : v;
};

// Chặn thanh toán 2 lần trong cùng kỳ
const isAlreadyPaidInSamePeriod = (bill, now = new Date()) => {
  if (!bill?.last_paid_at) return false;

  const last = dayjs(bill.last_paid_at);
  const cur = dayjs(now);

  switch (bill.frequency) {
    case "daily":
      return last.isSame(cur, "day");
    case "weekly":
      return last.isSame(cur, "week"); // week theo locale, đủ dùng
    case "biweekly":
      // trong 14 ngày gần nhất tính từ last_paid_at
      return cur.diff(last, "day") < 14;
    case "monthly":
      return last.isSame(cur, "month");
    case "yearly":
      return last.isSame(cur, "year");
    case "custom":
      // custom: mặc định chặn trong cùng ngày để tránh spam
      return last.isSame(cur, "day");
    default:
      return last.isSame(cur, "month");
  }
};

const calculateNextRun = (bill) => {
  const nextRun = new Date(bill.next_run || new Date());

  switch (bill.frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case "weekly":
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case "biweekly":
      nextRun.setDate(nextRun.getDate() + 14);
      break;
    case "monthly":
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;
    case "yearly":
      nextRun.setFullYear(nextRun.getFullYear() + 1);
      break;
    case "custom":
      // custom -> scheduler/cron xử lý (giữ nguyên)
      break;
    default:
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;
  }

  return nextRun;
};

// tạo noti an toàn, không làm fail flow chính
const safeNotify = async (userId, payload) => {
  try {
    await createNotification(userId, payload);
  } catch (e) {
    console.error("❌ [RecurringBill notify] Error:", e?.message || e);
  }
};

/**
 * Create recurring bill
 */
const createRecurringBill = async (userId, data) => {
  try {
    if (!data || !userId) {
      return { status: false, error: 1, message: "Invalid data", data: null };
    }

    const {
      name,
      walletId,
      categoryId,
      amount,
      type,
      frequency,
      cron_rule,
      next_run,
      ends_at,
      active = true,
      auto_create_transaction = true,
      description,
    } = data;

    if (!name || !walletId || amount == null || !type || !frequency || !next_run) {
      return { status: false, error: 1, message: "Missing required fields", data: null };
    }

    const amountNum = assertPositiveNumber(amount, "Amount must be > 0");

    // Validate wallet
    const wallet = await Wallet.findOne({ _id: walletId, userId }).lean();
    if (!wallet) {
      return { status: false, error: 1, message: "Wallet not found", data: null };
    }

    // Validate category if provided
    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, userId }).lean();
      if (!category || category.type !== type) {
        return { status: false, error: 1, message: "Category not found or invalid type", data: null };
      }
    }

    const recurringBill = await RecurringBill.create({
      userId,
      name: String(name).trim(),
      wallet: walletId,
      category: categoryId || null,
      amount: amountNum,
      type,
      frequency,
      cron_rule: frequency === "custom" ? cron_rule : null,
      next_run: new Date(next_run),
      ends_at: ends_at ? new Date(ends_at) : null,
      active: !!active,
      auto_create_transaction: !!auto_create_transaction,
      description: description || "",
    });

    // ✅ Notification: created
    await safeNotify(userId, {
      type: "reminder",
      level: "success",
      event: "bill.created",
      title: "Tạo hóa đơn định kỳ",
      message: `Đã tạo hóa đơn "${recurringBill.name}" (${recurringBill.frequency}).`,
      link: `/recurring-bills/${recurringBill._id}`,
      entity: { kind: "recurring_bill", id: recurringBill._id },
      dedupeKey: `bill.created:${recurringBill._id}`,
      data: {
        recurringBillId: recurringBill._id,
        amount: recurringBill.amount,
        billType: recurringBill.type,
        frequency: recurringBill.frequency,
        nextRun: recurringBill.next_run,
      },
      // expiresAt optional
    });

    return {
      status: true,
      error: 0,
      message: "Recurring bill created successfully",
      data: recurringBill,
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Get all recurring bills
 */
const getAllRecurringBills = async (userId, options = {}) => {
  try {
    const { active, type } = options;
    const query = { userId };

    if (active !== undefined) query.active = active === "true" || active === true;
    if (type) query.type = type;

    const recurringBills = await RecurringBill.find(query)
      .populate("wallet", "name type balance")
      .populate("category", "name icon type")
      .sort({ createdAt: -1 });

    return { status: true, error: 0, message: "Get recurring bills successfully", data: recurringBills };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Get recurring bill by id
 */
const getRecurringBillById = async (userId, id) => {
  try {
    const recurringBill = await RecurringBill.findOne({ _id: id, userId })
      .populate("wallet", "name type balance")
      .populate("category", "name icon type");

    if (!recurringBill) {
      return { status: false, error: 1, message: "Recurring bill not found", data: null };
    }

    return { status: true, error: 0, message: "Get recurring bill successfully", data: recurringBill };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Update recurring bill
 */
const updateRecurringBill = async (userId, id, data) => {
  try {
    const recurringBill = await RecurringBill.findOne({ _id: id, userId });
    if (!recurringBill) {
      return { status: false, error: 1, message: "Recurring bill not found", data: null };
    }

    // Validate wallet if provided
    if (data.walletId) {
      const wallet = await Wallet.findOne({ _id: data.walletId, userId }).lean();
      if (!wallet) return { status: false, error: 1, message: "Wallet not found", data: null };
      recurringBill.wallet = data.walletId;
    }

    // Validate category if provided
    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const effectiveType = data.type || recurringBill.type;
        const category = await Category.findOne({ _id: data.categoryId, userId }).lean();
        if (!category || category.type !== effectiveType) {
          return { status: false, error: 1, message: "Category not found or invalid type", data: null };
        }
        recurringBill.category = data.categoryId;
      } else {
        recurringBill.category = null;
      }
    }

    // Update fields
    if (data.name !== undefined) recurringBill.name = String(data.name).trim();
    if (data.amount !== undefined) recurringBill.amount = assertPositiveNumber(data.amount);
    if (data.type !== undefined) recurringBill.type = data.type;
    if (data.frequency !== undefined) recurringBill.frequency = data.frequency;

    if (data.cron_rule !== undefined) {
      recurringBill.cron_rule = (data.frequency || recurringBill.frequency) === "custom" ? data.cron_rule : null;
    }

    if (data.next_run !== undefined) recurringBill.next_run = data.next_run ? new Date(data.next_run) : recurringBill.next_run;
    if (data.ends_at !== undefined) recurringBill.ends_at = data.ends_at ? new Date(data.ends_at) : null;
    if (data.active !== undefined) recurringBill.active = !!data.active;
    if (data.auto_create_transaction !== undefined) recurringBill.auto_create_transaction = !!data.auto_create_transaction;
    if (data.description !== undefined) recurringBill.description = data.description;

    await recurringBill.save();

    // ✅ Notification: updated
    await safeNotify(userId, {
      type: "reminder",
      level: "info",
      event: "bill.updated",
      title: "Cập nhật hóa đơn định kỳ",
      message: `Đã cập nhật hóa đơn "${recurringBill.name}".`,
      link: `/recurring-bills/${recurringBill._id}`,
      entity: { kind: "recurring_bill", id: recurringBill._id },
      dedupeKey: `bill.updated:${recurringBill._id}:${new Date().toISOString().slice(0, 10)}`,
      data: { recurringBillId: recurringBill._id },
    });

    return { status: true, error: 0, message: "Recurring bill updated successfully", data: recurringBill };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Pause recurring bill
 */
const pauseRecurringBill = async (userId, id) => {
  try {
    const bill = await RecurringBill.findOne({ _id: id, userId });
    if (!bill) return { status: false, error: 1, message: "Recurring bill not found", data: null };
    if (!bill.active) return { status: false, error: 1, message: "Recurring bill already paused", data: null };

    bill.active = false;
    await bill.save();

    await safeNotify(userId, {
      type: "reminder",
      level: "warning",
      event: "bill.paused",
      title: "Tạm dừng hóa đơn định kỳ",
      message: `Đã tạm dừng "${bill.name}".`,
      link: `/recurring-bills/${bill._id}`,
      entity: { kind: "recurring_bill", id: bill._id },
      dedupeKey: `bill.paused:${bill._id}:${new Date().toISOString().slice(0, 10)}`,
      data: { recurringBillId: bill._id },
    });

    return { status: true, error: 0, message: "Recurring bill paused successfully", data: bill };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Resume recurring bill
 */
const resumeRecurringBill = async (userId, id) => {
  try {
    const bill = await RecurringBill.findOne({ _id: id, userId });
    if (!bill) return { status: false, error: 1, message: "Recurring bill not found", data: null };
    if (bill.active) return { status: false, error: 1, message: "Recurring bill already active", data: null };

    if (bill.ends_at && bill.ends_at < new Date()) {
      return { status: false, error: 1, message: "Recurring bill has already ended", data: null };
    }

    bill.active = true;
    await bill.save();

    await safeNotify(userId, {
      type: "reminder",
      level: "success",
      event: "bill.resumed",
      title: "Bật lại hóa đơn định kỳ",
      message: `Đã bật lại "${bill.name}".`,
      link: `/recurring-bills/${bill._id}`,
      entity: { kind: "recurring_bill", id: bill._id },
      dedupeKey: `bill.resumed:${bill._id}:${new Date().toISOString().slice(0, 10)}`,
      data: { recurringBillId: bill._id },
    });

    return { status: true, error: 0, message: "Recurring bill resumed successfully", data: bill };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Delete recurring bill (soft delete)
 */
const deleteRecurringBill = async (userId, id) => {
  try {
    const recurringBill = await RecurringBill.findOne({ _id: id, userId });
    if (!recurringBill) return { status: false, error: 1, message: "Recurring bill not found", data: null };

    await recurringBill.delete();

    await safeNotify(userId, {
      type: "reminder",
      level: "warning",
      event: "bill.deleted",
      title: "Đã xóa hóa đơn định kỳ",
      message: `Đã chuyển "${recurringBill.name}" vào thùng rác.`,
      dedupeKey: `bill.deleted:${recurringBill._id}:${new Date().toISOString().slice(0, 10)}`,
      data: { recurringBillId: recurringBill._id },
    });

    return { status: true, error: 0, message: "Recurring bill deleted successfully", data: null };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  }
};

/**
 * Pay recurring bill
 * - tạo Transaction
 * - cập nhật Wallet balance (atomic $inc)
 * - cập nhật last_paid_at, next_run
 * - tạo Notification
 */
const payRecurringBill = async (userId, id) => {
  const session = await mongoose.startSession();
  try {
    let billDoc;
    let walletDoc;

    await session.withTransaction(async () => {
      const recurringBill = await RecurringBill.findOne({ _id: id, userId })
        .populate("wallet")
        .populate("category")
        .session(session);

      if (!recurringBill) throw new Error("Recurring bill not found");
      if (!recurringBill.active) throw new Error("Recurring bill is not active");
      if (recurringBill.ends_at && recurringBill.ends_at < new Date()) throw new Error("Recurring bill has already ended");

      // 🔒 chặn thanh toán 2 lần trong cùng kỳ
      if (isAlreadyPaidInSamePeriod(recurringBill, new Date())) {
        throw new Error("Hóa đơn này đã được thanh toán trong kỳ hiện tại");
      }

      const wallet = recurringBill.wallet;
      if (!wallet?._id) throw new Error("Wallet not found");
      walletDoc = wallet;

      const amount = assertPositiveNumber(recurringBill.amount);

      // ✅ create transaction record
      // (dùng note/description song song để an toàn schema)
      await Transaction.create(
        [
          {
            userId,
            type: recurringBill.type,
            amount,
            walletId: wallet._id,
            categoryId: recurringBill.category?._id || recurringBill.category || null,
            note: `Thanh toán hóa đơn định kỳ: ${recurringBill.name}`,
            description: recurringBill.name,
            source: "recurring_bill",
            recurring_bill: recurringBill._id,
            date: new Date(),
            createdAt: new Date(),
          },
        ],
        { session }
      );

      // ✅ update wallet balance atomically
      const inc = recurringBill.type === "expense" ? -amount : amount;
      await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: inc } }, { session });

      // ✅ update bill
      recurringBill.last_paid_at = new Date();
      recurringBill.next_run = calculateNextRun(recurringBill);
      await recurringBill.save({ session });

      billDoc = recurringBill;
    });

    // ✅ Notification: paid (sau commit)
    await safeNotify(userId, {
      type: "transaction",
      level: "success",
      event: "bill.paid",
      title: "Đã thanh toán hóa đơn",
      message: `Bạn đã thanh toán "${billDoc?.name}".`,
      link: `/recurring-bills/${billDoc?._id}`,
      entity: { kind: "recurring_bill", id: billDoc?._id },
      dedupeKey: `bill.paid:${billDoc?._id}:${new Date().toISOString().slice(0, 10)}`,
      data: {
        recurringBillId: billDoc?._id,
        amount: billDoc?.amount,
        billType: billDoc?.type,
        walletId: walletDoc?._id,
        nextRun: billDoc?.next_run,
      },
    });

    return { status: true, error: 0, message: "Pay recurring bill successfully", data: null };
  } catch (error) {
    return { status: false, error: -1, message: error.message || "Server error", data: null };
  } finally {
    session.endSession();
  }
};

module.exports = {
  createRecurringBill,
  getAllRecurringBills,
  getRecurringBillById,
  updateRecurringBill,
  deleteRecurringBill,
  payRecurringBill,
  pauseRecurringBill,
  resumeRecurringBill,
};
