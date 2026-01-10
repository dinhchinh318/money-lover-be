// services/reportService.js
const mongoose = require("mongoose");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");

/**
 * =========================
 * Helpers
 * =========================
 */
const toObjectId = (id) => (typeof id === "string" ? new mongoose.Types.ObjectId(id) : id);

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

const buildDateMatch = (startDate, endDate) => {
  if (!startDate && !endDate) return null;
  const date = {};
  if (startDate) date.$gte = startOfDay(startDate);
  if (endDate) date.$lte = endOfDay(endDate);
  return date;
};

const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : current < 0 ? -100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

/**
 * Lấy dữ liệu trong khoảng thời gian
 * - chỉ tính income/expense cho tổng thu/chi
 * - luôn filter soft delete (deleted != true)
 */
const getPeriodData = async (userId, startDate, endDate) => {
  const userIdObj = toObjectId(userId);

  const matchQuery = {
    userId: userIdObj,
    deleted: { $ne: true },
    date: {
      $gte: startOfDay(startDate),
      $lte: endOfDay(endDate),
    },
  };

  // dùng conditional sum để khỏi phải find _id
  const stats = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
        totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
      },
    },
  ]);

  const totalIncome = Number(stats?.[0]?.totalIncome || 0);
  const totalExpense = Number(stats?.[0]?.totalExpense || 0);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
};

/**
 * Range helpers
 */
const getCurrentMonthRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

const getPreviousMonthRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0..6 (CN..T7)
  const daysToMonday = day === 0 ? 6 : day - 1;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - daysToMonday);
  return { startDate: startOfDay(startDate), endDate: endOfDay(new Date(startDate.getTime() + 6 * 86400000)) };
};

const getPreviousWeekRange = () => {
  const { startDate: currentStart } = getCurrentWeekRange();
  const endDate = endOfDay(new Date(currentStart.getTime() - 1));
  const startDate = startOfDay(new Date(endDate.getTime() - 6 * 86400000));
  return { startDate, endDate };
};

const getCurrentYearRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
};

const getPreviousYearRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
};

/**
 * =========================
 * A.1 - Financial Dashboard
 * =========================
 */
const getFinancialDashboard = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;
    const userIdObj = toObjectId(userId);

    const matchQuery = { userId: userIdObj, deleted: { $ne: true } };
    const dateMatch = buildDateMatch(startDate, endDate);
    if (dateMatch) matchQuery.date = dateMatch;

    // tính income/expense chuẩn
    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
        },
      },
    ]);

    const totalIncome = Number(stats?.[0]?.totalIncome || 0);
    const totalExpense = Number(stats?.[0]?.totalExpense || 0);
    const balance = totalIncome - totalExpense;

    const wallets = await Wallet.find({ userId: userIdObj, is_archived: false, deleted: { $ne: true } }).lean();
    const totalWalletBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    let incomeChangePercent = 0;
    let expenseChangePercent = 0;

    // chỉ tính change khi có start+end
    if (startDate && endDate) {
      try {
        const curStart = startOfDay(startDate);
        const curEnd = endOfDay(endDate);
        const daysDiff = Math.ceil((curEnd - curStart) / 86400000) + 1;

        const prevEnd = endOfDay(new Date(curStart.getTime() - 86400000));
        const prevStart = startOfDay(new Date(prevEnd.getTime() - (daysDiff - 1) * 86400000));

        const prev = await getPeriodData(userIdObj, prevStart, prevEnd);

        incomeChangePercent = calculatePercentageChange(totalIncome, prev.totalIncome);
        expenseChangePercent = calculatePercentageChange(totalExpense, prev.totalExpense);
      } catch (_) {}
    }

    return {
      status: true,
      error: 0,
      message: "Lấy dữ liệu Financial Dashboard thành công",
      data: {
        totalIncome,
        totalExpense,
        totalWalletBalance,
        balance,
        walletCount: wallets.length,
        incomeChange: Number(incomeChangePercent.toFixed(2)),
        expenseChange: Number(expenseChangePercent.toFixed(2)),
        period: { startDate: startDate || null, endDate: endDate || null },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * Compare month/week/year
 * =========================
 */
const compareCurrentMonthWithPrevious = async (userId) => {
  try {
    const currentRange = getCurrentMonthRange();
    const previousRange = getPreviousMonthRange();

    const [currentData, previousData] = await Promise.all([
      getPeriodData(userId, currentRange.startDate, currentRange.endDate),
      getPeriodData(userId, previousRange.startDate, previousRange.endDate),
    ]);

    return {
      status: true,
      error: 0,
      message: "So sánh tháng hiện tại với tháng trước thành công",
      data: {
        current: { period: "Tháng hiện tại", ...currentRange, ...currentData },
        previous: { period: "Tháng trước", ...previousRange, ...previousData },
        comparison: {
          incomeChange: currentData.totalIncome - previousData.totalIncome,
          incomeChangePercent: calculatePercentageChange(currentData.totalIncome, previousData.totalIncome),
          expenseChange: currentData.totalExpense - previousData.totalExpense,
          expenseChangePercent: calculatePercentageChange(currentData.totalExpense, previousData.totalExpense),
          balanceChange: currentData.balance - previousData.balance,
          balanceChangePercent: calculatePercentageChange(currentData.balance, previousData.balance),
        },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const compareCurrentWeekWithPrevious = async (userId) => {
  try {
    const currentRange = getCurrentWeekRange();
    const previousRange = getPreviousWeekRange();

    const [currentData, previousData] = await Promise.all([
      getPeriodData(userId, currentRange.startDate, currentRange.endDate),
      getPeriodData(userId, previousRange.startDate, previousRange.endDate),
    ]);

    return {
      status: true,
      error: 0,
      message: "So sánh tuần hiện tại với tuần trước thành công",
      data: {
        current: { period: "Tuần hiện tại", ...currentRange, ...currentData },
        previous: { period: "Tuần trước", ...previousRange, ...previousData },
        comparison: {
          incomeChange: currentData.totalIncome - previousData.totalIncome,
          incomeChangePercent: calculatePercentageChange(currentData.totalIncome, previousData.totalIncome),
          expenseChange: currentData.totalExpense - previousData.totalExpense,
          expenseChangePercent: calculatePercentageChange(currentData.totalExpense, previousData.totalExpense),
          balanceChange: currentData.balance - previousData.balance,
          balanceChangePercent: calculatePercentageChange(currentData.balance, previousData.balance),
        },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const compareCurrentYearWithPrevious = async (userId) => {
  try {
    const currentRange = getCurrentYearRange();
    const previousRange = getPreviousYearRange();

    const [currentData, previousData] = await Promise.all([
      getPeriodData(userId, currentRange.startDate, currentRange.endDate),
      getPeriodData(userId, previousRange.startDate, previousRange.endDate),
    ]);

    return {
      status: true,
      error: 0,
      message: "So sánh năm hiện tại với năm trước thành công",
      data: {
        current: { period: "Năm hiện tại", ...currentRange, ...currentData },
        previous: { period: "Năm trước", ...previousRange, ...previousData },
        comparison: {
          incomeChange: currentData.totalIncome - previousData.totalIncome,
          incomeChangePercent: calculatePercentageChange(currentData.totalIncome, previousData.totalIncome),
          expenseChange: currentData.totalExpense - previousData.totalExpense,
          expenseChangePercent: calculatePercentageChange(currentData.totalExpense, previousData.totalExpense),
          balanceChange: currentData.balance - previousData.balance,
          balanceChangePercent: calculatePercentageChange(currentData.balance, previousData.balance),
        },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * A.3 - Wallet changes (FIX adjust)
 * - Tính biến động ví theo period
 * - adjust delta = sum(adjustTo - adjustFrom)
 * =========================
 */
const getWalletChanges = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { startDate, endDate } = options;

    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = startOfDay(startDate);
      periodEnd = endOfDay(endDate);
    } else {
      const cur = getCurrentMonthRange();
      periodStart = cur.startDate;
      periodEnd = cur.endDate;
    }

    const wallets = await Wallet.find({
      userId: userIdObj,
      is_archived: false,
      deleted: { $ne: true },
    }).lean();

    const walletChanges = await Promise.all(
      wallets.map(async (wallet) => {
        const baseMatch = {
          userId: userIdObj,
          deleted: { $ne: true },
          date: { $gte: periodStart, $lte: periodEnd },
        };

        // income/expense/loan/debt tổng theo ví
        const byType = await Transaction.aggregate([
          { $match: { ...baseMatch, walletId: wallet._id } },
          { $group: { _id: "$type", totalAmount: { $sum: "$amount" } } },
        ]);

        // transfer out
        const transferOut = await Transaction.aggregate([
          { $match: { ...baseMatch, walletId: wallet._id, type: "transfer" } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]);

        // transfer in
        const transferIn = await Transaction.aggregate([
          { $match: { ...baseMatch, toWalletId: wallet._id, type: "transfer" } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]);

        // ✅ adjust delta (quan trọng)
        const adjustDeltaAgg = await Transaction.aggregate([
          { $match: { ...baseMatch, walletId: wallet._id, type: "adjust" } },
          {
            $group: {
              _id: null,
              delta: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$adjustFrom", null] },
                        { $ne: ["$adjustTo", null] },
                      ],
                    },
                    { $subtract: ["$adjustTo", "$adjustFrom"] },
                    0,
                  ],
                },
              },
            },
          },
        ]);

        const getTypeTotal = (t) => Number(byType.find((x) => x._id === t)?.totalAmount || 0);

        const income = getTypeTotal("income");
        const expense = getTypeTotal("expense");
        const loan = getTypeTotal("loan");
        const debt = getTypeTotal("debt");

        const periodTransferOut = Number(transferOut?.[0]?.totalAmount || 0);
        const periodTransferIn = Number(transferIn?.[0]?.totalAmount || 0);
        const adjustDelta = Number(adjustDeltaAgg?.[0]?.delta || 0);

        // net change thực sự của ví trong kỳ (phù hợp với wallet balance update của bạn)
        // income + loan - expense - debt + transferIn - transferOut + adjustDelta
        const periodNetChange =
          income + loan - expense - debt + periodTransferIn - periodTransferOut + adjustDelta;

        const currentBalance = Number(wallet.balance || 0);
        const estimatedStartBalance = currentBalance - periodNetChange;

        const change = currentBalance - estimatedStartBalance;
        const changePercent =
          estimatedStartBalance === 0
            ? currentBalance > 0
              ? 100
              : currentBalance < 0
              ? -100
              : 0
            : (change / Math.abs(estimatedStartBalance)) * 100;

        return {
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance,
          estimatedStartBalance,
          change,
          changePercent: Number(changePercent.toFixed(2)),

          // breakdown
          periodIncome: income,
          periodExpense: expense,
          periodLoan: loan,
          periodDebt: debt,
          periodTransferIn,
          periodTransferOut,
          adjustDelta,

          trend: change > 0 ? "increase" : change < 0 ? "decrease" : "stable",
        };
      })
    );

    walletChanges.sort((a, b) => b.change - a.change);

    return {
      status: true,
      error: 0,
      message: "Lấy dữ liệu biến động ví thành công",
      data: { wallets: walletChanges, period: { startDate: periodStart, endDate: periodEnd } },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * B.1 - Report by day
 * =========================
 */
const getTimeBasedReportByDay = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    if (!startDate || !endDate) {
      return { status: false, error: 1, message: "startDate và endDate là bắt buộc", data: null };
    }

    const userIdObj = toObjectId(userId);
    const matchQuery = {
      userId: userIdObj,
      deleted: { $ne: true },
      date: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = toObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = toObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo ngày thành công",
      data: stats.map((x) => ({
        date: x._id,
        label: x._id,
        totalIncome: x.totalIncome,
        totalExpense: x.totalExpense,
        balance: x.totalIncome - x.totalExpense,
        count: x.count,
      })),
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * B.2 - Report by week (FIX ISO week)
 * =========================
 */
const getTimeBasedReportByWeek = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    if (!startDate || !endDate) {
      return { status: false, error: 1, message: "startDate và endDate là bắt buộc", data: null };
    }

    const userIdObj = toObjectId(userId);
    const matchQuery = {
      userId: userIdObj,
      deleted: { $ne: true },
      date: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = toObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = toObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            isoYear: { $isoWeekYear: "$date" },
            isoWeek: { $isoWeek: "$date" },
          },
          totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.isoYear": 1, "_id.isoWeek": 1 } },
    ]);

    // ISO week -> monday
    const isoWeekStartEnd = (isoYear, isoWeek) => {
      // ISO week 1: tuần có ngày 4/1
      const jan4 = new Date(isoYear, 0, 4);
      const day = jan4.getDay() || 7; // CN=7
      const mondayWeek1 = new Date(jan4);
      mondayWeek1.setDate(jan4.getDate() - (day - 1));
      mondayWeek1.setHours(0, 0, 0, 0);

      const weekStart = new Date(mondayWeek1);
      weekStart.setDate(mondayWeek1.getDate() + (isoWeek - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return { weekStart, weekEnd };
    };

    const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo tuần thành công",
      data: stats.map((x) => {
        const { weekStart, weekEnd } = isoWeekStartEnd(x._id.isoYear, x._id.isoWeek);
        return {
          year: x._id.isoYear,
          week: x._id.isoWeek,
          label: `${fmt(weekStart)} - ${fmt(weekEnd)}`,
          totalIncome: x.totalIncome,
          totalExpense: x.totalExpense,
          balance: x.totalIncome - x.totalExpense,
          count: x.count,
        };
      }),
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * B.3 - Report by month
 * =========================
 */
const getTimeBasedReportByMonth = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    if (!startDate || !endDate) {
      return { status: false, error: 1, message: "startDate và endDate là bắt buộc", data: null };
    }

    const userIdObj = toObjectId(userId);
    const matchQuery = {
      userId: userIdObj,
      deleted: { $ne: true },
      date: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = toObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = toObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo tháng thành công",
      data: stats.map((x) => ({
        year: x._id.year,
        month: x._id.month,
        label: `Tháng ${x._id.month}/${x._id.year}`,
        totalIncome: x.totalIncome,
        totalExpense: x.totalExpense,
        balance: x.totalIncome - x.totalExpense,
        count: x.count,
      })),
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * B.4 - Report by year
 * =========================
 */
const getTimeBasedReportByYear = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    if (!startDate || !endDate) {
      return { status: false, error: 1, message: "startDate và endDate là bắt buộc", data: null };
    }

    const userIdObj = toObjectId(userId);
    const matchQuery = {
      userId: userIdObj,
      deleted: { $ne: true },
      date: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = toObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = toObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $year: "$date" },
          totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo năm thành công",
      data: stats.map((x) => ({
        year: x._id,
        label: `Năm ${x._id}`,
        totalIncome: x.totalIncome,
        totalExpense: x.totalExpense,
        balance: x.totalIncome - x.totalExpense,
        count: x.count,
      })),
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * C.1 - Category expense report
 * =========================
 */
const getCategoryExpenseReport = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit } = options;
    const userIdObj = toObjectId(userId);

    const matchQuery = { userId: userIdObj, type: "expense", deleted: { $ne: true } };
    const dateMatch = buildDateMatch(startDate, endDate);
    if (dateMatch) matchQuery.date = dateMatch;

    const pipeline = [
      { $match: matchQuery },
      { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          categoryId: "$_id",
          categoryName: "$category.name",
          categoryIcon: "$category.icon",
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ];

    if (limit) pipeline.push({ $limit: parseInt(limit, 10) });

    const stats = await Transaction.aggregate(pipeline);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo chi tiêu theo danh mục thành công",
      data: stats,
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getTopExpenseCategories = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit = 10 } = options;
    const result = await getCategoryExpenseReport(userId, { startDate, endDate, limit });
    return { status: result.status, error: result.error, message: "Lấy top danh mục chi nhiều nhất thành công", data: result.data };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getTopIncomeCategories = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit = 10 } = options;
    const userIdObj = toObjectId(userId);

    const matchQuery = { userId: userIdObj, type: "income", deleted: { $ne: true } };
    const dateMatch = buildDateMatch(startDate, endDate);
    if (dateMatch) matchQuery.date = dateMatch;

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          categoryId: "$_id",
          categoryName: "$category.name",
          categoryIcon: "$category.icon",
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit, 10) },
    ]);

    return { status: true, error: 0, message: "Lấy top danh mục thu nhiều nhất thành công", data: stats };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const compareCategoryExpenseBetweenMonths = async (userId, options = {}) => {
  try {
    const { months = 6, categoryIds } = options;
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const matchQuery = {
        userId: userIdObj,
        type: "expense",
        deleted: { $ne: true },
        date: { $gte: monthStart, $lte: monthEnd },
      };

      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        matchQuery.categoryId = { $in: categoryIds.map(toObjectId) };
      }

      const stats = await Transaction.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        { $project: { categoryId: "$_id", categoryName: "$category.name", categoryIcon: "$category.icon", totalAmount: 1 } },
      ]);

      results.push({
        month: monthStart.getMonth() + 1,
        year: monthStart.getFullYear(),
        label: `Tháng ${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
        categories: stats,
      });
    }

    results.reverse();

    return { status: true, error: 0, message: "So sánh mức chi các danh mục giữa các tháng thành công", data: results };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * =========================
 * D.1 - Wallet expense report (giữ ý tưởng cũ, nhưng chuẩn userId + deleted)
 * =========================
 */
const getWalletExpenseReport = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { startDate, endDate } = options;

    const dateMatch = buildDateMatch(startDate, endDate);

    const lookupExpr = [
      { $eq: ["$walletId", "$$walletId"] },
      { $eq: ["$userId", userIdObj] },
      { $in: ["$type", ["expense", "income"]] },
      { $ne: ["$deleted", true] },
    ];

    if (dateMatch?.$gte) lookupExpr.push({ $gte: ["$date", dateMatch.$gte] });
    if (dateMatch?.$lte) lookupExpr.push({ $lte: ["$date", dateMatch.$lte] });

    const stats = await Wallet.aggregate([
      {
        $match: {
          userId: userIdObj,
          deleted: { $ne: true },
          is_archived: { $ne: true },
        },
      },
      {
        $lookup: {
          from: "transactions",
          let: { walletId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: lookupExpr } } },
            {
              $group: {
                _id: null,
                totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
                totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
                count: { $sum: 1 },
              },
            },
          ],
          as: "transactionStats",
        },
      },
      { $unwind: { path: "$transactionStats", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          walletId: "$_id",
          walletName: "$name",
          walletType: "$type",
          totalIncome: { $ifNull: ["$transactionStats.totalIncome", 0] },
          totalExpense: { $ifNull: ["$transactionStats.totalExpense", 0] },
          balance: {
            $subtract: [
              { $ifNull: ["$transactionStats.totalIncome", 0] },
              { $ifNull: ["$transactionStats.totalExpense", 0] },
            ],
          },
          count: { $ifNull: ["$transactionStats.count", 0] },
        },
      },
      { $sort: { totalExpense: -1 } },
    ]);

    return { status: true, error: 0, message: "Lấy báo cáo chi tiêu theo ví thành công", data: stats };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getWalletExpenseDistribution = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;
    const result = await getWalletExpenseReport(userId, { startDate, endDate });
    if (!result.status) return result;

    const totalExpense = result.data.reduce((sum, x) => sum + Number(x.totalExpense || 0), 0);
    const totalIncome = result.data.reduce((sum, x) => sum + Number(x.totalIncome || 0), 0);

    const distribution = result.data.map((x) => ({
      ...x,
      percentage: totalExpense > 0 ? (Number(x.totalExpense || 0) / totalExpense) * 100 : 0,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy phân bổ chi tiêu theo ví thành công",
      data: { distribution, totalExpense, totalIncome },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const compareWalletExpenseOverTime = async (userId, options = {}) => {
  try {
    const { startDate, endDate, period = "month", walletIds } = options;
    if (!startDate || !endDate) {
      return { status: false, error: 1, message: "startDate và endDate là bắt buộc", data: null };
    }

    const userIdObj = toObjectId(userId);

    const matchQuery = {
      userId: userIdObj,
      type: "expense",
      deleted: { $ne: true },
      date: { $gte: startOfDay(startDate), $lte: endOfDay(endDate) },
    };

    if (Array.isArray(walletIds) && walletIds.length > 0) {
      matchQuery.walletId = { $in: walletIds.map(toObjectId) };
    }

    let groupBy;
    switch (period) {
      case "day":
        groupBy = { date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, walletId: "$walletId" };
        break;
      case "week":
        groupBy = { isoYear: { $isoWeekYear: "$date" }, isoWeek: { $isoWeek: "$date" }, walletId: "$walletId" };
        break;
      case "month":
        groupBy = { year: { $year: "$date" }, month: { $month: "$date" }, walletId: "$walletId" };
        break;
      case "year":
        groupBy = { year: { $year: "$date" }, walletId: "$walletId" };
        break;
      default:
        groupBy = { year: { $year: "$date" }, month: { $month: "$date" }, walletId: "$walletId" };
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      { $group: { _id: groupBy, totalExpense: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: "wallets", localField: "_id.walletId", foreignField: "_id", as: "wallet" } },
      { $unwind: "$wallet" },
      {
        $project: {
          period: "$_id",
          walletId: "$_id.walletId",
          walletName: "$wallet.name",
          walletType: "$wallet.type",
          totalExpense: 1,
          count: 1,
        },
      },
      { $sort: { "period.year": 1, "period.month": 1, "period.isoWeek": 1, "period.date": 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: `So sánh chi tiêu các ví theo ${period} thành công`,
      data: stats,
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  getFinancialDashboard,
  compareCurrentMonthWithPrevious,
  compareCurrentWeekWithPrevious,
  compareCurrentYearWithPrevious,
  getWalletChanges,
  getTimeBasedReportByDay,
  getTimeBasedReportByWeek,
  getTimeBasedReportByMonth,
  getTimeBasedReportByYear,
  getCategoryExpenseReport,
  getTopExpenseCategories,
  getTopIncomeCategories,
  compareCategoryExpenseBetweenMonths,
  getWalletExpenseReport,
  getWalletExpenseDistribution,
  compareWalletExpenseOverTime,
};
