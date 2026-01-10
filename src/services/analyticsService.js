/**
 * analytics.service.js
 * ✅ Fix:
 * - ISO week chuẩn (isoWeek/isoWeekYear) + timezone VN (Asia/Ho_Chi_Minh)
 * - Chuẩn hoá ObjectId cho userId/categoryId/walletId
 * - Aggregate có lọc soft-delete (mongoose-delete không auto filter trong aggregate)
 * - Fix bug Z-score sai đơn vị trong suggestOptimizeSpending
 * - Fix createSmartAlerts dùng userId nhất quán (userIdObj)
 * - ✅ Thêm tạo Notification song song với Alert khi tạo smart alerts
 */

const mongoose = require("mongoose");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const Budget = require("../models/budget");
const Alert = require("../models/alert");

// ✅ NEW: Notification model
// Nếu project bạn chưa có Notification model -> tạo file models/notification.js tương tự Alert
const Notification = require("../models/notification");

const TZ = "Asia/Ho_Chi_Minh";
const VN_OFFSET_HOURS = 7;

// ------------------------------
// Helpers
// ------------------------------

const toObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  return id; // fallback
};

/**
 * Soft-delete filter cho aggregate (mongoose-delete không auto filter trong aggregate)
 * - tuỳ schema của bạn, có thể là deleted/deletedAt
 */
const txNotDeletedMatch = () => ({
  $or: [
    { deleted: { $exists: false } },
    { deleted: false },
    { deleted: null },
  ],
});

/**
 * Helper: Tính độ lệch chuẩn
 */
const calculateStdDev = (values, mean) => {
  if (!values || values.length === 0) return 0;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Helper: Tính trung bình
 */
const calculateMean = (values) => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Helper: Linear Regression - Tính hệ số a và b cho y = ax + b
 */
const linearRegression = (x, y) => {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, idx) => sum + val * y[idx], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssRes = y.reduce((sum, val, idx) => {
    const predicted = slope * x[idx] + intercept;
    return sum + Math.pow(val - predicted, 2);
  }, 0);
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
};

/**
 * Helper: Exponential Smoothing - Dự đoán giá trị tiếp theo
 */
const exponentialSmoothing = (values, alpha = 0.3) => {
  if (!values || values.length === 0) return 0;
  if (values.length === 1) return values[0];

  let smoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed;
  }
  return smoothed;
};

/**
 * Helper: Z-score
 */
const calculateZScore = (value, mean, stdDev) => {
  if (!stdDev) return 0;
  return (value - mean) / stdDev;
};

/**
 * Helper: Percentile
 */
const calculatePercentile = (values, percentile) => {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

/**
 * Helper: Growth %
 */
const calculateGrowthPercent = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * ISO Week Range from isoYear + isoWeek
 */
const getIsoWeekRange = (isoYear, isoWeek) => {
  // ISO week: tuần chứa Jan 4 là tuần 1, bắt đầu Monday
  const jan4 = new Date(isoYear, 0, 4);
  const jan4Day = jan4.getDay() || 7; // Mon=1..Sun=7
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - (jan4Day - 1));

  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (isoWeek - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
};

const formatDateVN = (date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

/**
 * ✅ Build Notification object from Alert doc
 * NOTE: Nếu Notification schema của bạn khác field -> sửa tại đây.
 */
const buildNotificationFromAlert = (alertDoc) => {
  return {
    userId: alertDoc.userId,
    type: alertDoc.type,
    title: alertDoc.title,
    message: alertDoc.message,
    isRead: false,
    related: alertDoc.related || undefined,
    // optional: link back to alert
    alertId: alertDoc._id,
  };
};

// ============================================
// A. DIAGNOSTIC ANALYTICS
// ============================================

/**
 * A.1.1 - Danh mục tăng mạnh bất thường
 */
const getCategorySpendingSpikes = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);

    const { months = 3, thresholdPercent = 50 } = options;
    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const stats = await Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            type: "expense",
            date: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: "$categoryId",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
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
            month: monthStart.getMonth() + 1,
            year: monthStart.getFullYear(),
          },
        },
      ]);

      results.push({
        month: monthStart.getMonth() + 1,
        year: monthStart.getFullYear(),
        label: `Tháng ${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
        categories: stats,
      });
    }

    if (results.length >= 2) {
      const current = results[0];
      const previous = results[1];
      const spikes = [];

      current.categories.forEach((cat) => {
        const prevCat = previous.categories.find(
          (c) => c.categoryId.toString() === cat.categoryId.toString()
        );
        if (prevCat) {
          const growth = calculateGrowthPercent(cat.totalAmount, prevCat.totalAmount);
          if (growth >= thresholdPercent) {
            spikes.push({
              ...cat,
              previousAmount: prevCat.totalAmount,
              growthPercent: growth,
              isSpike: true,
            });
          }
        } else if (cat.totalAmount > 0) {
          spikes.push({
            ...cat,
            previousAmount: 0,
            growthPercent: 100,
            isSpike: true,
          });
        }
      });

      return {
        status: true,
        error: 0,
        message: "Lấy danh mục tăng mạnh bất thường thành công",
        data: {
          spikes,
          comparison: {
            currentMonth: current.label,
            previousMonth: previous.label,
          },
        },
      };
    }

    return {
      status: true,
      error: 0,
      message: "Chưa đủ dữ liệu để phân tích",
      data: { spikes: [] },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.1.2 - Tháng phát sinh chi tiêu đột biến
 */
const getMonthlySpendingSpikes = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { months = 12 } = options;
    const now = new Date();
    const monthlyData = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const stats = await Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            type: "expense",
            date: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      monthlyData.push({
        month: monthStart.getMonth() + 1,
        year: monthStart.getFullYear(),
        label: `Tháng ${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
        totalAmount: stats[0]?.totalAmount || 0,
        count: stats[0]?.count || 0,
      });
    }

    const amounts = monthlyData.map((d) => d.totalAmount);
    const mean = calculateMean(amounts);
    const stdDev = calculateStdDev(amounts, mean);
    const threshold = mean + 2 * stdDev;

    const spikes = monthlyData
      .filter((d) => d.totalAmount > threshold)
      .map((d) => ({
        ...d,
        deviation: d.totalAmount - mean,
        deviationPercent: calculateGrowthPercent(d.totalAmount, mean),
        isSpike: true,
      }));

    return {
      status: true,
      error: 0,
      message: "Lấy tháng chi tiêu đột biến thành công",
      data: {
        spikes,
        statistics: { mean, stdDev, threshold },
        allMonths: monthlyData.reverse(),
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.1.3 - Biến động theo từng ví
 */
const getWalletVariations = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { months = 3 } = options;

    const wallets = await Wallet.find({ userId: userIdObj, is_archived: false }).lean();
    const now = new Date();
    const walletVariations = [];

    for (const wallet of wallets) {
      const monthlyData = [];

      for (let i = 0; i < months; i++) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

        const stats = await Transaction.aggregate([
          {
            $match: {
              userId: userIdObj,
              ...txNotDeletedMatch(),
              walletId: wallet._id,
              type: "expense",
              date: { $gte: monthStart, $lte: monthEnd },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]);

        monthlyData.push({
          month: monthStart.getMonth() + 1,
          year: monthStart.getFullYear(),
          totalAmount: stats[0]?.totalAmount || 0,
          count: stats[0]?.count || 0,
        });
      }

      if (monthlyData.length >= 2) {
        const amounts = monthlyData.map((d) => d.totalAmount);
        const mean = calculateMean(amounts);
        const stdDev = calculateStdDev(amounts, mean);
        const volatility = mean > 0 ? (stdDev / mean) * 100 : 0;

        const latest = monthlyData[0];
        const previous = monthlyData[1];
        const change = latest.totalAmount - previous.totalAmount;
        const changePercent = calculateGrowthPercent(latest.totalAmount, previous.totalAmount);

        walletVariations.push({
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance: wallet.balance,
          latestMonth: {
            month: latest.month,
            year: latest.year,
            totalAmount: latest.totalAmount,
          },
          previousMonth: {
            month: previous.month,
            year: previous.year,
            totalAmount: previous.totalAmount,
          },
          change,
          changePercent,
          volatility,
          trend: change > 0 ? "increase" : change < 0 ? "decrease" : "stable",
        });
      }
    }

    return {
      status: true,
      error: 0,
      message: "Lấy biến động theo ví thành công",
      data: walletVariations,
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.2.1 - Phát hiện khoản chi quá lớn so với thói quen
 */
const detectUnusualLargeExpenses = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);

    const { days = 30, thresholdMultiplier = 2 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    const transactions = await Transaction.find({
      userId: userIdObj,
      type: "expense",
      date: { $gte: startDate, $lte: now },
      // find() có thể auto filter soft-delete tuỳ plugin, nhưng để an toàn vẫn lọc:
      $or: [{ deleted: { $exists: false } }, { deleted: false }, { deleted: null }],
    })
      .populate("categoryId", "name icon")
      .populate("walletId", "name type")
      .sort({ date: -1 })
      .lean();

    if (transactions.length === 0) {
      return { status: true, error: 0, message: "Không có dữ liệu để phân tích", data: { unusualExpenses: [] } };
    }

    const amounts = transactions.map((t) => t.amount);
    const mean = calculateMean(amounts);
    const stdDev = calculateStdDev(amounts, mean);
    const threshold = mean + thresholdMultiplier * stdDev;

    const unusualExpenses = transactions
      .filter((t) => t.amount >= threshold)
      .map((t) => ({
        transactionId: t._id,
        amount: t.amount,
        date: t.date,
        note: t.note,
        category: t.categoryId,
        wallet: t.walletId,
        deviation: t.amount - mean,
        deviationPercent: calculateGrowthPercent(t.amount, mean),
        isUnusual: true,
      }));

    return {
      status: true,
      error: 0,
      message: "Phát hiện chi tiêu bất thường thành công",
      data: {
        unusualExpenses,
        statistics: { mean, stdDev, threshold, totalTransactions: transactions.length },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.2.2 - Chi vào thời điểm bất thường
 */
const detectUnusualTimeSpending = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { days = 30 } = options;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    const transactions = await Transaction.find({
      userId: userIdObj,
      type: "expense",
      date: { $gte: startDate, $lte: now },
      $or: [{ deleted: { $exists: false } }, { deleted: false }, { deleted: null }],
    })
      .populate("categoryId", "name icon")
      .lean();

    if (transactions.length === 0) {
      return { status: true, error: 0, message: "Không có dữ liệu để phân tích", data: { unusualTimeSpending: [] } };
    }

    const hourStats = {};
    transactions.forEach((t) => {
      const hour = new Date(t.date).getHours();
      if (!hourStats[hour]) hourStats[hour] = { count: 0, totalAmount: 0 };
      hourStats[hour].count++;
      hourStats[hour].totalAmount += t.amount;
    });

    const avgCount = transactions.length / 24;
    const unusualTimes = [];

    transactions.forEach((t) => {
      const hour = new Date(t.date).getHours();
      const hourCount = hourStats[hour].count;

      if (hour >= 22 || hour <= 6 || hourCount < avgCount * 0.3) {
        unusualTimes.push({
          transactionId: t._id,
          amount: t.amount,
          date: t.date,
          hour,
          note: t.note,
          category: t.categoryId,
          reason: hour >= 22 || hour <= 6 ? "Giờ khuya" : "Giờ ít giao dịch",
          isUnusual: true,
        });
      }
    });

    return {
      status: true,
      error: 0,
      message: "Phát hiện chi tiêu thời điểm bất thường thành công",
      data: { unusualTimeSpending: unusualTimes, hourDistribution: hourStats },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.2.3 - Chi tăng đột biến trong 24 giờ gần nhất
 */
const detect24hSpendingSpike = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const last24h = new Date(now);
    last24h.setHours(now.getHours() - 24);
    const previous24h = new Date(last24h);
    previous24h.setHours(last24h.getHours() - 24);

    const [last24hStats, previous24hStats] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            type: "expense",
            date: { $gte: last24h, $lte: now },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            type: "expense",
            date: { $gte: previous24h, $lte: last24h },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    const last24hTotal = last24hStats[0]?.totalAmount || 0;
    const previous24hTotal = previous24hStats[0]?.totalAmount || 0;
    const change = last24hTotal - previous24hTotal;
    const changePercent = calculateGrowthPercent(last24hTotal, previous24hTotal);

    const transactions = await Transaction.find({
      userId: userIdObj,
      type: "expense",
      date: { $gte: last24h, $lte: now },
      $or: [{ deleted: { $exists: false } }, { deleted: false }, { deleted: null }],
    })
      .populate("categoryId", "name icon")
      .populate("walletId", "name type")
      .sort({ date: -1 })
      .lean();

    return {
      status: true,
      error: 0,
      message: "Phân tích chi tiêu 24h thành công",
      data: {
        last24h: { totalAmount: last24hTotal, count: last24hStats[0]?.count || 0, transactions },
        previous24h: { totalAmount: previous24hTotal, count: previous24hStats[0]?.count || 0 },
        change,
        changePercent,
        isSpike: changePercent >= 100,
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.3.1 - Ngày trong tuần chi nhiều nhất
 */
const getMostSpendingDayOfWeek = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { weeks = 12 } = options;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - weeks * 7);

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$date" }, // 1 = Sunday, 2 = Monday, ..., 7 = Saturday
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const dayNames = {
      1: "Chủ nhật",
      2: "Thứ 2",
      3: "Thứ 3",
      4: "Thứ 4",
      5: "Thứ 5",
      6: "Thứ 6",
      7: "Thứ 7",
    };

    const result = stats.map((stat) => ({
      dayOfWeek: stat._id,
      dayName: dayNames[stat._id],
      totalAmount: stat.totalAmount,
      count: stat.count,
      avgAmount: stat.count > 0 ? stat.totalAmount / stat.count : 0,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy ngày chi nhiều nhất thành công",
      data: { days: result, mostSpendingDay: result[0] || null },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.3.2 - Danh mục phát sinh nhiều nhất
 */
const getMostFrequentCategories = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);

    let startDate, endDate;
    if (options.startDate && options.endDate) {
      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const { days = 30 } = options;
      endDate = new Date();
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - days);
    }

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: startDate, $lte: endDate },
          categoryId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          categoryId: "$_id",
          categoryName: "$category.name",
          categoryIcon: "$category.icon",
          totalAmount: 1,
          count: 1,
          avgAmount: { $cond: [{ $gt: ["$count", 0] }, { $divide: ["$totalAmount", "$count"] }, 0] },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return { status: true, error: 0, message: "Lấy danh mục phát sinh nhiều nhất thành công", data: stats };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * A.3.3 - Tần suất giao dịch trung bình
 */
const getTransactionFrequency = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);

    let startDate, endDate;
    if (options.startDate && options.endDate) {
      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const { days = 30 } = options;
      endDate = new Date();
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - days);
    }

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$type", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
    ]);

    const totalTransactions = stats.reduce((sum, s) => sum + s.count, 0);
    const actualDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const avgPerDay = totalTransactions / actualDays;

    return {
      status: true,
      error: 0,
      message: "Lấy tần suất giao dịch thành công",
      data: {
        period: { days: actualDays, startDate, endDate },
        totalTransactions,
        frequency: { perDay: avgPerDay, perWeek: avgPerDay * 7, perMonth: avgPerDay * 30 },
        byType: stats,
      },
    };
  } catch (error) {
    console.error(`[TẦN SUẤT GIAO DỊCH] Error:`, error);
    return { status: false, error: -1, message: error.message, data: null };
  }
};

// ============================================
// B. PREDICTIVE ANALYTICS
// ============================================

const predictMonthEndExpense7Days = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);

    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: last7Days, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            // ✅ group theo ngày theo timezone VN
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: TZ } },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    const last7DaysTotal = dailyStats.reduce((sum, day) => sum + day.totalAmount, 0);
    const currentMonthTotal = currentMonthStats[0]?.totalAmount || 0;

    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;

    let avgDailyLast7Days = 0;
    if (dailyStats.length > 0) {
      const dailyAmounts = dailyStats.map((d) => d.totalAmount);
      avgDailyLast7Days = dailyAmounts.length >= 3
        ? exponentialSmoothing(dailyAmounts, 0.3)
        : calculateMean(dailyAmounts);
    } else if (last7DaysTotal > 0) {
      avgDailyLast7Days = last7DaysTotal / 7;
    } else if (currentMonthTotal > 0 && daysPassed > 0) {
      avgDailyLast7Days = currentMonthTotal / daysPassed;
    }

    const dayOfWeek = now.getDay();
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.15 : 1.0;

    const predictedRemaining = avgDailyLast7Days * Math.max(0, daysRemaining) * weekendMultiplier;
    const predictedMonthEnd = currentMonthTotal + predictedRemaining;

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu cuối tháng (7 ngày) thành công",
      data: {
        method: "7-day-average",
        currentMonth: { total: currentMonthTotal, daysPassed, avgPerDay: currentMonthTotal / Math.max(1, daysPassed) },
        last7Days: { total: last7DaysTotal, avgPerDay: avgDailyLast7Days },
        prediction: { daysRemaining, predictedRemaining, predictedMonthEnd },
        period: { month: now.getMonth() + 1, year: now.getFullYear() },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const predictMonthEndExpense30Days = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: last30Days, $lte: now },
        },
      },
      {
        $group: {
          _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: TZ } } },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    const last30DaysTotal = dailyStats.reduce((sum, day) => sum + day.totalAmount, 0);
    const currentMonthTotal = currentMonthStats[0]?.totalAmount || 0;

    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;

    let avgDailyLast30Days = 0;
    if (dailyStats.length > 0) {
      const dailyAmounts = dailyStats.map((d) => d.totalAmount);

      if (dailyAmounts.length >= 7) {
        const weights = dailyAmounts.map((_, idx) => (idx + 1) / dailyAmounts.length);
        const weightedSum = dailyAmounts.reduce((sum, val, idx) => sum + val * weights[idx], 0);
        const weightSum = weights.reduce((sum, w) => sum + w, 0);
        avgDailyLast30Days = weightSum > 0 ? weightedSum / weightSum : calculateMean(dailyAmounts);
      } else {
        avgDailyLast30Days = calculateMean(dailyAmounts);
      }
    } else if (last30DaysTotal > 0) {
      avgDailyLast30Days = last30DaysTotal / 30;
    } else if (currentMonthTotal > 0 && daysPassed > 0) {
      avgDailyLast30Days = currentMonthTotal / daysPassed;
    }

    const predictedRemaining = avgDailyLast30Days * Math.max(0, daysRemaining);
    const predictedMonthEnd = currentMonthTotal + predictedRemaining;

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu cuối tháng (30 ngày) thành công",
      data: {
        method: "30-day-average",
        currentMonth: { total: currentMonthTotal, daysPassed, avgPerDay: currentMonthTotal / Math.max(1, daysPassed) },
        last30Days: { total: last30DaysTotal, avgPerDay: avgDailyLast30Days },
        prediction: { daysRemaining, predictedRemaining, predictedMonthEnd },
        period: { month: now.getMonth() + 1, year: now.getFullYear() },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const predictMonthEndExpenseTrend = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last60Days = new Date(now);
    last60Days.setDate(now.getDate() - 60);

    // ✅ ISO week chuẩn + shift timezone VN bằng dateAdd +7h
    const weeklyStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: last60Days, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            isoYear: {
              $isoWeekYear: { $dateAdd: { startDate: "$date", unit: "hour", amount: VN_OFFSET_HOURS } },
            },
            isoWeek: {
              $isoWeek: { $dateAdd: { startDate: "$date", unit: "hour", amount: VN_OFFSET_HOURS } },
            },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.isoYear": 1, "_id.isoWeek": 1 } },
    ]);

    let trend = 0;
    let dailyTrend = 0;
    let trendDirection = "stable";
    let r2 = 0;

    if (weeklyStats.length >= 2) {
      const amounts = weeklyStats.map((s) => s.totalAmount);
      const x = amounts.map((_, idx) => idx);

      const regression = linearRegression(x, amounts);
      trend = regression.slope;
      dailyTrend = trend / 7;
      r2 = regression.r2;

      if (trend > 0 && r2 > 0.3) trendDirection = "increasing";
      else if (trend < 0 && r2 > 0.3) trendDirection = "decreasing";
      else trendDirection = "stable";
    }

    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    const currentMonthTotal = currentMonthStats[0]?.totalAmount || 0;
    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;

    const avgDailyCurrent = currentMonthTotal / Math.max(1, daysPassed);

    let predictedDailyForRemaining = avgDailyCurrent;
    if (weeklyStats.length >= 2 && r2 > 0.2) {
      predictedDailyForRemaining = avgDailyCurrent + dailyTrend;
    } else {
      const recentWeeklyAmounts = weeklyStats.slice(-4).map((s) => s.totalAmount);
      const smoothedWeekly = exponentialSmoothing(recentWeeklyAmounts, 0.3);
      predictedDailyForRemaining = smoothedWeekly / 7;
    }

    const predictedRemaining = Math.max(0, predictedDailyForRemaining * Math.max(0, daysRemaining));
    const predictedMonthEnd = currentMonthTotal + predictedRemaining;

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu cuối tháng (xu hướng) thành công",
      data: {
        method: "trend-based",
        currentMonth: { total: currentMonthTotal, daysPassed, avgPerDay: avgDailyCurrent },
        trend: { weeklyTrend: trend, dailyTrend, direction: trendDirection, confidence: r2 },
        prediction: { daysRemaining, predictedDailyForRemaining, predictedRemaining, predictedMonthEnd },
        period: { month: now.getMonth() + 1, year: now.getFullYear() },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * B.2.1 - Dự đoán vượt ngân sách
 */
const predictBudgetOverrun = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const budgets = await Budget.find({
      userId: userIdObj,
      period: "monthly",
      $or: [
        { start_date: { $lte: currentMonthEnd }, end_date: { $gte: currentMonthStart } },
        { start_date: null },
      ],
    })
      .populate("category", "name icon")
      .lean();

    const predictions = [];

    for (const budget of budgets) {
      if (!budget.category || !budget.category._id) continue;

      const categoryIdObj = toObjectId(budget.category._id);

      const matchQuery = {
        userId: userIdObj,
        ...txNotDeletedMatch(),
        type: "expense",
        categoryId: categoryIdObj,
        date: { $gte: currentMonthStart, $lte: now },
      };

      if (budget.wallet) matchQuery.walletId = toObjectId(budget.wallet);

      const spentStats = await Transaction.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]);

      const spent = spentStats[0]?.totalAmount || 0;
      const limit = budget.limit_amount || 0;
      const remaining = limit - spent;
      const usagePercent = limit > 0 ? (spent / limit) * 100 : 0;

      const daysPassed = Math.max(1, Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1);
      const daysRemaining = Math.max(
        0,
        new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed
      );

      const avgDailySpending = spent / daysPassed;

      let predictedRemaining = 0;
      let predictedTotal = spent;

      if (daysRemaining > 0) {
        if (avgDailySpending > 0) {
          predictedRemaining = avgDailySpending * daysRemaining;
        } else if (limit > 0) {
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          predictedRemaining = (limit / daysInMonth) * daysRemaining;
        }
        predictedTotal = spent + predictedRemaining;
      }

      const predictedOverrun = Math.max(0, predictedTotal - limit);
      const overrunPercent = limit > 0 ? (predictedOverrun / limit) * 100 : 0;

      let predictedOverrunDate = null;
      if (avgDailySpending > 0 && remaining > 0) {
        const daysUntilOverrun = Math.ceil(remaining / avgDailySpending);
        const predictedDate = new Date(now);
        predictedDate.setDate(now.getDate() + daysUntilOverrun);
        if (predictedDate <= currentMonthEnd) predictedOverrunDate = predictedDate;
      }

      predictions.push({
        budgetId: budget._id,
        budgetName: budget.name,
        category: { id: budget.category._id, name: budget.category.name, icon: budget.category.icon },
        limit,
        spent,
        remaining,
        usagePercent,
        prediction: {
          predictedTotal,
          predictedOverrun: predictedOverrun > 0 ? predictedOverrun : 0,
          overrunPercent: overrunPercent > 0 ? overrunPercent : 0,
          predictedOverrunDate,
          daysUntilOverrun: predictedOverrunDate
            ? Math.ceil((predictedOverrunDate - now) / (1000 * 60 * 60 * 24))
            : null,
        },
        isAtRisk: usagePercent >= 80 || predictedOverrun > 0,
      });
    }

    return {
      status: true,
      error: 0,
      message: "Dự đoán vượt ngân sách thành công",
      data: { predictions, atRisk: predictions.filter((p) => p.isAtRisk) },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * B.3.1 - Dự đoán chi tiêu theo danh mục (light ML)
 */
const predictCategorySpending = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { days = 30 } = options;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // ✅ ISO week chuẩn + shift +7h
    const weeklyCategoryStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            categoryId: "$categoryId",
            isoYear: {
              $isoWeekYear: { $dateAdd: { startDate: "$date", unit: "hour", amount: VN_OFFSET_HOURS } },
            },
            isoWeek: {
              $isoWeek: { $dateAdd: { startDate: "$date", unit: "hour", amount: VN_OFFSET_HOURS } },
            },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id.categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $sort: { "_id.categoryId": 1, "_id.isoYear": 1, "_id.isoWeek": 1 } },
    ]);

    const categoryMap = {};
    weeklyCategoryStats.forEach((stat) => {
      const catId = stat._id.categoryId?.toString();
      if (!catId) return;
      if (!categoryMap[catId]) {
        categoryMap[catId] = {
          categoryId: stat._id.categoryId,
          categoryName: stat.category.name,
          categoryIcon: stat.category.icon,
          weeklyAmounts: [],
        };
      }
      categoryMap[catId].weeklyAmounts.push(stat.totalAmount);
    });

    const predictions = Object.values(categoryMap).map((cat) => {
      const amounts = cat.weeklyAmounts;
      let predictedNextWeek = 0;
      let trend = 0;
      let confidence = 0;

      if (amounts.length >= 2) {
        const x = amounts.map((_, idx) => idx);
        const regression = linearRegression(x, amounts);
        trend = regression.slope;
        confidence = regression.r2;

        if (confidence > 0.4) {
          const nextX = amounts.length;
          predictedNextWeek = regression.slope * nextX + regression.intercept;
        } else {
          predictedNextWeek = exponentialSmoothing(amounts, 0.3);
        }

        predictedNextWeek = Math.max(0, predictedNextWeek);
      } else if (amounts.length === 1) {
        predictedNextWeek = amounts[0];
      }

      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryIcon: cat.categoryIcon,
        historical: {
          weeks: amounts.length,
          avgPerWeek: calculateMean(amounts),
          totalAmount: amounts.reduce((sum, a) => sum + a, 0),
          weeklyAmounts: amounts,
        },
        prediction: {
          nextWeek: predictedNextWeek,
          trend,
          trendDirection: trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable",
          confidence,
        },
      };
    });

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu theo danh mục thành công",
      data: { predictions, method: "weighted-moving-average" },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

// ============================================
// C. PRESCRIPTIVE ANALYTICS
// ============================================

/**
 * C.1.1 - Gợi ý tối ưu chi tiêu
 * ✅ Fix Z-score: tính theo "tổng theo danh mục" (cùng đơn vị)
 */
const suggestOptimizeSpending = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);

    const { days = 30, thresholdPercent = 20 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    const categoryStats = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          ...txNotDeletedMatch(),
          type: "expense",
          date: { $gte: startDate, $lte: now },
        },
      },
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
          avgAmount: {
            $cond: [{ $gt: ["$count", 0] }, { $divide: ["$totalAmount", "$count"] }, 0],
          },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    if (categoryStats.length === 0) {
      return {
        status: true,
        error: 0,
        message: "Không có dữ liệu để phân tích",
        data: { suggestions: [], totalExpense: 0, potentialTotalSavings: 0 },
      };
    }

    const totalExpense = categoryStats.reduce((sum, cat) => sum + cat.totalAmount, 0);
    if (totalExpense === 0) {
      return {
        status: true,
        error: 0,
        message: "Không có chi tiêu để phân tích",
        data: { suggestions: [], totalExpense: 0, potentialTotalSavings: 0 },
      };
    }

    let effectiveThreshold = 10;
    if (categoryStats.length <= 2) effectiveThreshold = 0;
    else if (categoryStats.length <= 5) effectiveThreshold = 10;
    else effectiveThreshold = Math.min(thresholdPercent, 15);

    const filteredCategories = categoryStats.filter((cat) => {
      const percentage = (cat.totalAmount / totalExpense) * 100;
      return percentage >= effectiveThreshold;
    });

    // ✅ Z-score theo "totalAmount của các category" => cùng đơn vị
    const totals = filteredCategories.map((c) => c.totalAmount);
    const meanTotal = calculateMean(totals);
    const stdTotal = calculateStdDev(totals, meanTotal);

    const suggestions = await Promise.all(
      filteredCategories.map(async (cat) => {
        const percentage = (cat.totalAmount / totalExpense) * 100;

        let reductionPercent = 10;
        if (percentage >= 30) reductionPercent = 20;
        else if (percentage >= 20) reductionPercent = 15;

        const suggestedReduction = cat.totalAmount * (reductionPercent / 100);

        // ✅ variance per-transaction (giữ để mô tả “biến thiên”), nhưng Z-score dùng total
        const categoryTransactions = await Transaction.find({
          userId: userIdObj,
          categoryId: cat.categoryId,
          type: "expense",
          date: { $gte: startDate, $lte: now },
          $or: [{ deleted: { $exists: false } }, { deleted: false }, { deleted: null }],
        }).lean();

        const amounts = categoryTransactions.map((t) => t.amount);
        const meanTx = cat.avgAmount;
        const stdDevTx = amounts.length > 1 ? calculateStdDev(amounts, meanTx) : 0;

        const zScoreTotal = stdTotal > 0 ? calculateZScore(cat.totalAmount, meanTotal, stdTotal) : 0;

        const adjustmentFactor = Math.abs(zScoreTotal) > 1.5 ? 1.2 : 1.0;
        const adjustedSavings = suggestedReduction * adjustmentFactor;

        let priority = "low";
        if (percentage >= 30 || zScoreTotal > 1.8) priority = "high";
        else if (percentage >= 20 || zScoreTotal > 1.0) priority = "medium";

        return {
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          categoryIcon: cat.categoryIcon,
          currentSpending: {
            total: cat.totalAmount,
            count: cat.count,
            avgPerTransaction: cat.avgAmount,
            percentageOfTotal: percentage,
            variancePerTransaction: stdDevTx,
            zScoreTotal: zScoreTotal, // ✅ đúng đơn vị
          },
          suggestion: {
            reductionPercent,
            suggestedReduction: adjustedSavings,
            suggestedNewAmount: cat.totalAmount - adjustedSavings,
            potentialSavings: adjustedSavings,
            reason:
              Math.abs(zScoreTotal) > 1.5
                ? "Danh mục này đang cao hơn mặt bằng chung, có thể tối ưu"
                : percentage >= 30
                ? "Chiếm tỷ trọng lớn trong tổng chi tiêu"
                : "Có thể giảm để cân đối ngân sách",
          },
          priority,
        };
      })
    );

    return {
      status: true,
      error: 0,
      message: "Gợi ý tối ưu chi tiêu thành công",
      data: {
        suggestions,
        totalExpense,
        potentialTotalSavings: suggestions.reduce((sum, s) => sum + s.suggestion.potentialSavings, 0),
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * C.1.2 - Đề xuất mức ngân sách phù hợp hơn
 */
const suggestBudgetAdjustment = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const last3MonthsStart = new Date(now);
    last3MonthsStart.setMonth(now.getMonth() - 3);

    const budgets = await Budget.find({ userId: userIdObj, period: "monthly" })
      .populate("category", "name icon")
      .lean();

    const suggestions = [];

    for (const budget of budgets) {
      if (!budget.category?._id) continue;

      const match = {
        userId: userIdObj,
        ...txNotDeletedMatch(),
        type: "expense",
        categoryId: toObjectId(budget.category._id),
        date: { $gte: last3MonthsStart, $lte: now },
      };
      if (budget.wallet) match.walletId = toObjectId(budget.wallet);

      const avgSpendingStats = await Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: { date: "$date", timezone: TZ } },
              month: { $month: { date: "$date", timezone: TZ } },
            },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      if (avgSpendingStats.length === 0) continue;

      const monthlyAmounts = avgSpendingStats.map((s) => s.totalAmount);
      const avgMonthlySpending = calculateMean(monthlyAmounts);
      const currentLimit = budget.limit_amount || 0;
      const stdDev = calculateStdDev(monthlyAmounts, avgMonthlySpending);

      const percentile75 = calculatePercentile(monthlyAmounts, 75);
      const percentile90 = calculatePercentile(monthlyAmounts, 90);

      const coefficientOfVariation = avgMonthlySpending > 0 ? stdDev / avgMonthlySpending : 0;
      let suggestedLimit;

      if (coefficientOfVariation > 0.3) suggestedLimit = percentile90 * 1.1;
      else if (coefficientOfVariation > 0.15) suggestedLimit = percentile75 * 1.15;
      else suggestedLimit = avgMonthlySpending * 1.2;

      const minLimit = avgMonthlySpending * 1.1;
      const maxLimit = percentile90 * 1.5;
      suggestedLimit = Math.max(minLimit, Math.min(suggestedLimit, maxLimit));

      const difference = suggestedLimit - currentLimit;
      const differencePercent = calculateGrowthPercent(suggestedLimit, currentLimit);

      const overrunCount = monthlyAmounts.filter((amount) => amount > currentLimit).length;
      const overrunRate = (overrunCount / monthlyAmounts.length) * 100;

      let reason;
      if (avgMonthlySpending > currentLimit * 1.1) {
        reason = `Chi tiêu trung bình (${avgMonthlySpending.toLocaleString("vi-VN")} VND) vượt ngân sách hiện tại`;
      } else if (avgMonthlySpending < currentLimit * 0.7) {
        reason = `Ngân sách hiện tại quá cao so với chi tiêu thực tế (${avgMonthlySpending.toLocaleString("vi-VN")} VND)`;
      } else if (overrunRate >= 50) {
        reason = `Vượt ngân sách thường xuyên (${overrunRate.toFixed(0)}% thời gian)`;
      } else if (coefficientOfVariation > 0.3) {
        reason = `Chi tiêu có biến thiên lớn, cần buffer cao hơn`;
      } else {
        reason = `Điều chỉnh để phù hợp với xu hướng chi tiêu`;
      }

      suggestions.push({
        budgetId: budget._id,
        budgetName: budget.name,
        category: { id: budget.category._id, name: budget.category.name, icon: budget.category.icon },
        current: {
          limit: currentLimit,
          avgSpending: avgMonthlySpending,
          usagePercent: currentLimit > 0 ? (avgMonthlySpending / currentLimit) * 100 : 0,
          overrunRate,
        },
        suggestion: {
          suggestedLimit,
          difference,
          differencePercent,
          reason,
          statisticalAnalysis: {
            avgSpending: avgMonthlySpending,
            stdDev,
            percentile75,
            percentile90,
            coefficientOfVariation,
          },
        },
        priority: overrunRate >= 50 ? "high" : avgMonthlySpending > currentLimit ? "medium" : "low",
      });
    }

    return {
      status: true,
      error: 0,
      message: "Đề xuất điều chỉnh ngân sách thành công",
      data: { suggestions },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * C.2.1 - Khuyến nghị chuyển tiền giữa các ví
 */
const suggestWalletTransfer = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const wallets = await Wallet.find({ userId: userIdObj, is_archived: false }).lean();
    const suggestions = [];
    const lowBalanceWallets = [];
    const highBalanceWallets = [];

    const threshold = 100000;
    const highBalanceThreshold = 200000;

    if (wallets.length < 2) {
      return {
        status: true,
        error: 0,
        message: "Cần ít nhất 2 ví để có khuyến nghị chuyển tiền",
        data: { suggestions: [], summary: { lowBalanceCount: 0, highBalanceCount: 0, totalSuggestions: 0 } },
      };
    }

    for (const wallet of wallets) {
      if (wallet.balance < threshold || wallet.balance < 0) {
        lowBalanceWallets.push({
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance: wallet.balance,
          isLow: true,
        });
      } else if (wallet.balance > highBalanceThreshold) {
        highBalanceWallets.push({
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance: wallet.balance,
        });
      }
    }

    lowBalanceWallets.sort((a, b) => {
      if (a.currentBalance < 0 && b.currentBalance >= 0) return -1;
      if (a.currentBalance >= 0 && b.currentBalance < 0) return 1;
      return a.currentBalance - b.currentBalance;
    });
    highBalanceWallets.sort((a, b) => b.currentBalance - a.currentBalance);

    const usedHighWallets = new Set();

    lowBalanceWallets.forEach((lowWallet) => {
      const neededAmount = Math.abs(lowWallet.currentBalance) + threshold * 2;

      for (const highWallet of highBalanceWallets) {
        if (usedHighWallets.has(highWallet.walletId.toString())) continue;

        const maxFromHigh = Math.min(highWallet.currentBalance * 0.5, highWallet.currentBalance - threshold);
        if (maxFromHigh < threshold) continue;

        const suggestedAmount = Math.min(neededAmount, maxFromHigh);

        if (suggestedAmount >= threshold) {
          suggestions.push({
            fromWallet: {
              id: highWallet.walletId,
              name: highWallet.walletName,
              type: highWallet.walletType,
              currentBalance: highWallet.currentBalance,
            },
            toWallet: {
              id: lowWallet.walletId,
              name: lowWallet.walletName,
              type: lowWallet.walletType,
              currentBalance: lowWallet.currentBalance,
              isLow: true,
            },
            suggestedAmount: Math.round(suggestedAmount),
            reason:
              lowWallet.currentBalance < 0
                ? "Ví đang âm số dư, cần chuyển ngay"
                : lowWallet.currentBalance < threshold
                ? "Ví sắp hết tiền, cần bổ sung"
                : "Cân đối số dư giữa các ví",
            priority:
              lowWallet.currentBalance < 0 ? "high" : lowWallet.currentBalance < threshold ? "medium" : "low",
            optimization: {
              neededAmount,
              availableFromHigh: maxFromHigh,
              transferEfficiency: (suggestedAmount / neededAmount) * 100,
            },
          });

          if (suggestedAmount >= maxFromHigh * 0.8) usedHighWallets.add(highWallet.walletId.toString());
          break;
        }
      }
    });

    if (lowBalanceWallets.length === 0 && highBalanceWallets.length > 0 && wallets.length > 1) {
      const otherWallets = wallets.filter(
        (w) =>
          w.balance >= threshold &&
          w.balance <= highBalanceThreshold &&
          !highBalanceWallets.find((h) => h.walletId.toString() === w._id.toString())
      );

      if (otherWallets.length > 0) {
        const lowestWallet = otherWallets.reduce((min, w) => (w.balance < min.balance ? w : min));
        const highestWallet = highBalanceWallets[0];

        const balanceDiff = highestWallet.currentBalance - lowestWallet.balance;
        if (balanceDiff > threshold * 2) {
          const suggestedAmount = Math.min(balanceDiff * 0.3, highestWallet.currentBalance * 0.3);
          suggestions.push({
            fromWallet: {
              id: highestWallet.walletId,
              name: highestWallet.walletName,
              type: highestWallet.walletType,
              currentBalance: highestWallet.currentBalance,
            },
            toWallet: {
              id: lowestWallet._id,
              name: lowestWallet.name,
              type: lowestWallet.type,
              currentBalance: lowestWallet.balance,
              isLow: false,
            },
            suggestedAmount: Math.round(suggestedAmount),
            reason: "Cân đối số dư giữa các ví",
            priority: "low",
            optimization: { neededAmount: suggestedAmount, availableFromHigh: suggestedAmount, transferEfficiency: 100 },
          });
        }
      }
    }

    return {
      status: true,
      error: 0,
      message: "Khuyến nghị chuyển tiền giữa ví thành công",
      data: {
        suggestions,
        summary: {
          lowBalanceCount: lowBalanceWallets.length,
          highBalanceCount: highBalanceWallets.length,
          totalSuggestions: suggestions.length,
        },
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * C.3.1 - Tạo cảnh báo thông minh + ✅ tạo Notification
 */
const createSmartAlerts = async (userId) => {
  try {
    const userIdObj = toObjectId(userId);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const alerts = [];

    // 1) Chi tiêu tháng tăng so với tháng trước
    const [currentMonthStats, previousMonthStats] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            type: "expense",
            date: { $gte: currentMonthStart, $lte: now },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            type: "expense",
            date: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
    ]);

    const currentTotal = currentMonthStats[0]?.totalAmount || 0;
    const previousTotal = previousMonthStats[0]?.totalAmount || 0;

    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const estimatedMonthEnd = (currentTotal / Math.max(1, daysPassed)) * daysInMonth;
    const estimatedIncrease = calculateGrowthPercent(estimatedMonthEnd, previousTotal);

    if (estimatedIncrease >= 15) {
      alerts.push({
        userId: userIdObj,
        type: "MONTHLY_SPENDING_INCREASE",
        title: "Chi tiêu tháng này tăng cao",
        message: `Bạn đang chi nhiều hơn ${estimatedIncrease.toFixed(
          1
        )}% so với tháng trước. Dự kiến cuối tháng sẽ chi ${estimatedMonthEnd.toLocaleString(
          "vi-VN"
        )} VND (tháng trước: ${previousTotal.toLocaleString("vi-VN")} VND).`,
        isRead: false,
      });
    }

    // 2) Danh mục tăng đột biến
    const categorySpikes = await getCategorySpendingSpikes(userIdObj, { months: 2, thresholdPercent: 50 });
    if (categorySpikes.status && categorySpikes.data.spikes.length > 0) {
      categorySpikes.data.spikes.slice(0, 3).forEach((spike) => {
        alerts.push({
          userId: userIdObj, // ✅ FIX: always userIdObj
          type: "CATEGORY_SPENDING_SPIKE",
          title: `${spike.categoryName} tăng đột biến`,
          message: `Danh mục "${spike.categoryName}" tăng ${spike.growthPercent.toFixed(
            1
          )}% so với tháng trước (${spike.totalAmount.toLocaleString("vi-VN")} VND).`,
          isRead: false,
          related: { model: "Category", id: spike.categoryId },
        });
      });
    }

    // 3) Ngân sách sắp hết / vượt
    const budgets = await Budget.find({ userId: userIdObj, period: "monthly" })
      .populate("category", "name icon")
      .lean();

    for (const budget of budgets) {
      const catId = budget.category?._id ? toObjectId(budget.category._id) : toObjectId(budget.category);

      const categoryExpense = await Transaction.aggregate([
        {
          $match: {
            userId: userIdObj,
            ...txNotDeletedMatch(),
            categoryId: catId,
            type: "expense",
            date: { $gte: currentMonthStart, $lte: now },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);

      const currentSpending = categoryExpense[0]?.totalAmount || 0;
      const limit = budget.limit_amount || 0;
      const usagePercent = limit > 0 ? (currentSpending / limit) * 100 : 0;

      if (usagePercent >= 75 && usagePercent < 100) {
        alerts.push({
          userId: userIdObj,
          type: "BUDGET_ALMOST_DEPLETED",
          title: `Ngân sách "${budget.category?.name || "Danh mục"}" sắp hết`,
          message: `Bạn đã chi tiêu ${usagePercent.toFixed(1)}% ngân sách ${
            budget.category?.name || "danh mục"
          } trong tháng này (${currentSpending.toLocaleString("vi-VN")} / ${limit.toLocaleString(
            "vi-VN"
          )} VND).`,
          isRead: false,
          related: { model: "Budget", id: budget._id },
        });
      }

      if (usagePercent >= 100) {
        alerts.push({
          userId: userIdObj,
          type: "BUDGET_OVERRUN",
          title: `Ngân sách "${budget.category?.name || "Danh mục"}" đã vượt`,
          message: `Ngân sách "${budget.category?.name || "danh mục"}" đã vượt ${Math.max(
            0,
            usagePercent - 100
          ).toFixed(1)}% (${currentSpending.toLocaleString("vi-VN")} / ${limit.toLocaleString(
            "vi-VN"
          )} VND).`,
          isRead: false,
          related: { model: "Budget", id: budget._id },
        });
      }
    }

    // 3b) Dự đoán vượt ngân sách
    const budgetOverrun = await predictBudgetOverrun(userIdObj);
    if (budgetOverrun.status && budgetOverrun.data.atRisk.length > 0) {
      budgetOverrun.data.atRisk.slice(0, 3).forEach((b) => {
        const existingAlert = alerts.find(
          (a) => a.related?.model === "Budget" && a.related?.id?.toString() === b.budgetId?.toString()
        );

        if (!existingAlert) {
          alerts.push({
            userId: userIdObj,
            type: "BUDGET_OVERRUN_PREDICTED",
            title: `Ngân sách "${b.category.name}" sắp vượt`,
            message: `Ngân sách "${b.category.name}" đã sử dụng ${b.usagePercent.toFixed(
              1
            )}%. Dự kiến sẽ vượt ${b.prediction.overrunPercent.toFixed(1)}% cuối tháng.`,
            isRead: false,
            related: { model: "Budget", id: b.budgetId },
          });
        }
      });
    }

    // 4) Ví sắp hết tiền
    const wallets = await Wallet.find({ userId: userIdObj, is_archived: false }).lean();
    wallets.forEach((wallet) => {
      if (wallet.balance < 100000 && wallet.balance > 0) {
        alerts.push({
          userId: userIdObj,
          type: "LOW_WALLET_BALANCE",
          title: `Ví "${wallet.name}" sắp hết tiền`,
          message: `Ví "${wallet.name}" chỉ còn ${wallet.balance.toLocaleString("vi-VN")} VND. Hãy nạp thêm tiền.`,
          isRead: false,
          related: { model: "Wallet", id: wallet._id },
        });
      }
    });

    // 5) Gợi ý tối ưu chi tiêu
    const optimizeSuggestions = await suggestOptimizeSpending(userIdObj, { days: 30, thresholdPercent: 20 });
    if (optimizeSuggestions.status && optimizeSuggestions.data.suggestions.length > 0) {
      const topSuggestion = optimizeSuggestions.data.suggestions[0];
      alerts.push({
        userId: userIdObj,
        type: "SUGGEST_OPTIMIZE_SPENDING",
        title: "Gợi ý tối ưu chi tiêu",
        message: `Bạn có thể tiết kiệm ${optimizeSuggestions.data.potentialTotalSavings.toLocaleString(
          "vi-VN"
        )} VND bằng cách giảm chi cho danh mục "${topSuggestion.categoryName}" và các danh mục khác.`,
        isRead: false,
        related: { model: "Category", id: topSuggestion.categoryId },
      });
    }

    // ✅ Save alerts mới (dedupe trong 24h) + tạo notifications
    const savedAlerts = [];
    const oneDayAgo = new Date(now);
    oneDayAgo.setHours(now.getHours() - 24);

    for (const alert of alerts) {
      const existing = await Alert.findOne({
        userId: userIdObj,
        type: alert.type,
        "related.model": alert.related?.model,
        "related.id": alert.related?.id,
        createdAt: { $gte: oneDayAgo },
      });

      if (!existing) {
        const newAlert = await Alert.create(alert);
        savedAlerts.push(newAlert);
      }
    }

    // ✅ NEW: tạo Notification tương ứng với các alert vừa tạo
    let notificationsCreated = 0;
    if (savedAlerts.length > 0) {
      const notifDocs = savedAlerts.map((a) => buildNotificationFromAlert(a));
      // Dedupe thêm 1 lớp (phòng trường hợp chạy song song)
      // Nếu Notification có unique index bạn có thể bỏ đoạn này
      try {
        const inserted = await Notification.insertMany(notifDocs, { ordered: false });
        notificationsCreated = inserted?.length || 0;
      } catch (e) {
        // ordered:false => có thể vẫn insert được một phần
        // Nếu duplicate key hoặc schema khác, log để debug
        console.error("[NOTIFICATION] insertMany error:", e?.message || e);
      }
    }

    return {
      status: true,
      error: 0,
      message: "Tạo cảnh báo + notification thông minh thành công",
      data: {
        alertsCreated: savedAlerts.length,
        notificationsCreated,
        totalAlerts: alerts.length,
        alerts: savedAlerts,
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * C.3.2 - Lấy lịch sử cảnh báo
 */
const getAlertHistory = async (userId, options = {}) => {
  try {
    const userIdObj = toObjectId(userId);
    const { limit = 50, isRead = null } = options;

    const query = { userId: userIdObj };
    if (isRead !== null) query.isRead = isRead;

    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    return {
      status: true,
      error: 0,
      message: "Lấy lịch sử cảnh báo thành công",
      data: { alerts, total: alerts.length },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

/**
 * C.3.3 - Đánh dấu cảnh báo đã đọc
 */
const markAlertAsRead = async (userId, alertId) => {
  try {
    const userIdObj = toObjectId(userId);

    const alert = await Alert.findOne({ _id: alertId, userId: userIdObj });
    if (!alert) {
      return { status: false, error: 1, message: "Cảnh báo không tồn tại", data: null };
    }

    alert.isRead = true;
    await alert.save();

    // ✅ OPTIONAL: đồng bộ Notification tương ứng (nếu bạn muốn)
    // Nếu Notification có field alertId
    try {
      await Notification.updateMany(
        { userId: userIdObj, alertId: alert._id },
        { $set: { isRead: true } }
      );
    } catch (e) {
      // bỏ qua nếu schema khác
    }

    return { status: true, error: 0, message: "Đánh dấu cảnh báo đã đọc thành công", data: alert.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  // A. Diagnostic
  getCategorySpendingSpikes,
  getMonthlySpendingSpikes,
  getWalletVariations,
  detectUnusualLargeExpenses,
  detectUnusualTimeSpending,
  detect24hSpendingSpike,
  getMostSpendingDayOfWeek,
  getMostFrequentCategories,
  getTransactionFrequency,

  // B. Predictive
  predictMonthEndExpense7Days,
  predictMonthEndExpense30Days,
  predictMonthEndExpenseTrend,
  predictBudgetOverrun,
  predictCategorySpending,

  // C. Prescriptive
  suggestOptimizeSpending,
  suggestBudgetAdjustment,
  suggestWalletTransfer,

  // Alerts + Notifications
  createSmartAlerts,
  getAlertHistory,
  markAlertAsRead,
};
