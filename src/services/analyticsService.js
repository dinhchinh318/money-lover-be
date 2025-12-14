const mongoose = require("mongoose");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const Budget = require("../models/budget");
const Alert = require("../models/alert");
const AnalyticsProfile = require("../models/analyticsProfile");

/**
 * Helper: Tính độ lệch chuẩn
 */
const calculateStdDev = (values, mean) => {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
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
 * @param {Array} x - Mảng giá trị x (thời gian: 0, 1, 2, ...)
 * @param {Array} y - Mảng giá trị y (chi tiêu)
 * @returns {Object} { slope, intercept, r2 } - Hệ số góc, hệ số chặn, R-squared
 */
const linearRegression = (x, y) => {
  if (x.length !== y.length || x.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, idx) => sum + val * y[idx], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  const sumYY = y.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Tính R-squared (độ phù hợp)
  const yMean = sumY / n;
  const ssRes = y.reduce((sum, val, idx) => {
    const predicted = slope * x[idx] + intercept;
    return sum + Math.pow(val - predicted, 2);
  }, 0);
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  return { slope, intercept, r2 };
};

/**
 * Helper: Exponential Smoothing - Dự đoán giá trị tiếp theo
 * @param {Array} values - Mảng giá trị lịch sử
 * @param {Number} alpha - Hệ số smoothing (0-1), mặc định 0.3
 * @returns {Number} - Giá trị dự đoán
 */
const exponentialSmoothing = (values, alpha = 0.3) => {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  let smoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed;
  }
  return smoothed;
};

/**
 * Helper: Tính Z-score để phát hiện outlier
 * @param {Number} value - Giá trị cần kiểm tra
 * @param {Number} mean - Giá trị trung bình
 * @param {Number} stdDev - Độ lệch chuẩn
 * @returns {Number} - Z-score
 */
const calculateZScore = (value, mean, stdDev) => {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
};

/**
 * Helper: Tính percentile
 * @param {Array} values - Mảng giá trị đã sắp xếp
 * @param {Number} percentile - Percentile cần tính (0-100)
 * @returns {Number} - Giá trị tại percentile
 */
const calculatePercentile = (values, percentile) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

/**
 * Helper: Tính phần trăm tăng trưởng
 */
const calculateGrowthPercent = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// ============================================
// A. DIAGNOSTIC ANALYTICS (Phân tích nguyên nhân)
// ============================================

/**
 * A.1.1 - Danh mục tăng mạnh bất thường
 */
const getCategorySpendingSpikes = async (userId, options = {}) => {
  try {
    const { months = 3, thresholdPercent = 50 } = options;
    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const stats = await Transaction.aggregate([
        {
          $match: {
            userId,
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

    // So sánh tháng hiện tại với tháng trước để tìm tăng mạnh
    if (results.length >= 2) {
      const current = results[0];
      const previous = results[1];
      const spikes = [];

      current.categories.forEach((cat) => {
        const prevCat = previous.categories.find((c) => c.categoryId.toString() === cat.categoryId.toString());
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
          // Danh mục mới xuất hiện
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
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

/**
 * A.1.2 - Tháng phát sinh chi tiêu đột biến
 */
const getMonthlySpendingSpikes = async (userId, options = {}) => {
  try {
    const { months = 12 } = options;
    const now = new Date();
    const monthlyData = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const stats = await Transaction.aggregate([
        {
          $match: {
            userId,
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

    // Tính trung bình và độ lệch chuẩn
    const amounts = monthlyData.map((d) => d.totalAmount);
    const mean = calculateMean(amounts);
    const stdDev = calculateStdDev(amounts, mean);
    const threshold = mean + 2 * stdDev; // 2 standard deviations = outlier

    // Tìm các tháng đột biến
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
        statistics: {
          mean,
          stdDev,
          threshold,
        },
        allMonths: monthlyData.reverse(),
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

/**
 * A.1.3 - Biến động theo từng ví
 */
const getWalletVariations = async (userId, options = {}) => {
  try {
    const { months = 3 } = options;
    const wallets = await Wallet.find({ userId, is_archived: false }).lean();
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
              userId,
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
          volatility, // Độ biến động (%)
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
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

/**
 * A.2.1 - Phát hiện khoản chi quá lớn so với thói quen
 */
const detectUnusualLargeExpenses = async (userId, options = {}) => {
  try {
    const { days = 30, thresholdMultiplier = 2 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Lấy tất cả giao dịch chi tiêu trong khoảng thời gian
    const transactions = await Transaction.find({
      userId,
      type: "expense",
      date: { $gte: startDate, $lte: now },
    })
      .populate("categoryId", "name icon")
      .populate("walletId", "name type")
      .sort({ date: -1 })
      .lean();

    if (transactions.length === 0) {
      return {
        status: true,
        error: 0,
        message: "Không có dữ liệu để phân tích",
        data: { unusualExpenses: [] },
      };
    }

    // Tính trung bình và độ lệch chuẩn
    const amounts = transactions.map((t) => t.amount);
    const mean = calculateMean(amounts);
    const stdDev = calculateStdDev(amounts, mean);
    const threshold = mean + thresholdMultiplier * stdDev;

    // Tìm các giao dịch bất thường
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
        statistics: {
          mean,
          stdDev,
          threshold,
          totalTransactions: transactions.length,
        },
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

/**
 * A.2.2 - Chi vào thời điểm bất thường
 */
const detectUnusualTimeSpending = async (userId, options = {}) => {
  try {
    const { days = 30 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Lấy tất cả giao dịch
    const transactions = await Transaction.find({
      userId,
      type: "expense",
      date: { $gte: startDate, $lte: now },
    })
      .populate("categoryId", "name icon")
      .lean();

    if (transactions.length === 0) {
      return {
        status: true,
        error: 0,
        message: "Không có dữ liệu để phân tích",
        data: { unusualTimeSpending: [] },
      };
    }

    // Phân tích theo giờ trong ngày
    const hourStats = {};
    transactions.forEach((t) => {
      const hour = new Date(t.date).getHours();
      if (!hourStats[hour]) {
        hourStats[hour] = { count: 0, totalAmount: 0 };
      }
      hourStats[hour].count++;
      hourStats[hour].totalAmount += t.amount;
    });

    // Tìm giờ ít giao dịch nhất (bất thường khi có chi)
    const avgCount = transactions.length / 24;
    const unusualTimes = [];

    transactions.forEach((t) => {
      const hour = new Date(t.date).getHours();
      const hourCount = hourStats[hour].count;
      
      // Giờ khuya (22h - 6h) hoặc giờ có ít giao dịch hơn trung bình
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
      data: {
        unusualTimeSpending: unusualTimes,
        hourDistribution: hourStats,
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

/**
 * A.2.3 - Chi tăng đột biến trong 24 giờ gần nhất
 */
const detect24hSpendingSpike = async (userId) => {
  try {
    const now = new Date();
    const last24h = new Date(now);
    last24h.setHours(now.getHours() - 24);
    const previous24h = new Date(last24h);
    previous24h.setHours(last24h.getHours() - 24);

    const [last24hStats, previous24hStats] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: last24h, $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: previous24h, $lte: last24h },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const last24hTotal = last24hStats[0]?.totalAmount || 0;
    const previous24hTotal = previous24hStats[0]?.totalAmount || 0;
    const change = last24hTotal - previous24hTotal;
    const changePercent = calculateGrowthPercent(last24hTotal, previous24hTotal);

    // Lấy chi tiết giao dịch 24h gần nhất
    const transactions = await Transaction.find({
      userId,
      type: "expense",
      date: { $gte: last24h, $lte: now },
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
        last24h: {
          totalAmount: last24hTotal,
          count: last24hStats[0]?.count || 0,
          transactions,
        },
        previous24h: {
          totalAmount: previous24hTotal,
          count: previous24hStats[0]?.count || 0,
        },
        change,
        changePercent,
        isSpike: changePercent >= 100, // Tăng 100% trở lên = đột biến
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

/**
 * A.3.1 - Ngày trong tuần chi nhiều nhất
 */
const getMostSpendingDayOfWeek = async (userId, options = {}) => {
  try {
    const { weeks = 12 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - weeks * 7);

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId,
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
      avgAmount: stat.totalAmount / stat.count,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy ngày chi nhiều nhất thành công",
      data: {
        days: result,
        mostSpendingDay: result[0] || null,
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

/**
 * A.3.2 - Danh mục phát sinh nhiều nhất
 */
const getMostFrequentCategories = async (userId, options = {}) => {
  try {
    const { days = 30 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: startDate, $lte: now },
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
          avgAmount: { $divide: ["$totalAmount", "$count"] },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy danh mục phát sinh nhiều nhất thành công",
      data: stats,
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

/**
 * A.3.3 - Tần suất giao dịch trung bình
 */
const getTransactionFrequency = async (userId, options = {}) => {
  try {
    const { days = 30 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalTransactions = stats.reduce((sum, s) => sum + s.count, 0);
    const avgPerDay = totalTransactions / days;
    const avgPerWeek = avgPerDay * 7;
    const avgPerMonth = avgPerDay * 30;

    return {
      status: true,
      error: 0,
      message: "Lấy tần suất giao dịch thành công",
      data: {
        period: {
          days,
          startDate,
          endDate: now,
        },
        totalTransactions,
        frequency: {
          perDay: avgPerDay,
          perWeek: avgPerWeek,
          perMonth: avgPerMonth,
        },
        byType: stats,
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

// ============================================
// B. PREDICTIVE ANALYTICS (Dự đoán)
// ============================================

/**
 * B.1.1 - Dự đoán chi tiêu cuối tháng (dựa trên trung bình 7 ngày gần nhất)
 * Sử dụng thuật toán: Exponential Weighted Moving Average (EWMA) với alpha = 0.3
 */
const predictMonthEndExpense7Days = async (userId) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);

    // Lấy chi tiêu theo ngày trong 7 ngày gần nhất để phân tích chi tiết
    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: last7Days, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Chi tiêu từ đầu tháng đến hiện tại
    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const last7DaysTotal = dailyStats.reduce((sum, day) => sum + day.totalAmount, 0);
    const currentMonthTotal = currentMonthStats[0]?.totalAmount || 0;

    // Số ngày đã qua trong tháng
    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    // Số ngày còn lại trong tháng
    const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;

    // Thuật toán dự đoán: Exponential Weighted Moving Average
    let avgDailyLast7Days = 0;
    if (dailyStats.length > 0) {
      const dailyAmounts = dailyStats.map((d) => d.totalAmount);
      
      // Nếu có đủ 7 ngày, dùng EWMA
      if (dailyAmounts.length >= 3) {
        avgDailyLast7Days = exponentialSmoothing(dailyAmounts, 0.3);
      } else {
        // Nếu ít dữ liệu, dùng trung bình đơn giản
        avgDailyLast7Days = calculateMean(dailyAmounts);
      }
    } else if (last7DaysTotal > 0) {
      // Fallback: chia đều cho 7 ngày
      avgDailyLast7Days = last7DaysTotal / 7;
    } else if (currentMonthTotal > 0 && daysPassed > 0) {
      // Nếu không có dữ liệu 7 ngày, dùng trung bình tháng hiện tại
      avgDailyLast7Days = currentMonthTotal / daysPassed;
    }

    // Dự đoán chi tiêu còn lại với điều chỉnh theo ngày trong tuần
    // Giả sử cuối tuần chi tiêu nhiều hơn (weight adjustment)
    const dayOfWeek = now.getDay(); // 0 = Chủ nhật, 6 = Thứ bảy
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
    
    const predictedRemaining = avgDailyLast7Days * daysRemaining * weekendMultiplier;
    const predictedMonthEnd = currentMonthTotal + predictedRemaining;

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu cuối tháng (7 ngày) thành công",
      data: {
        method: "7-day-average",
        currentMonth: {
          total: currentMonthTotal,
          daysPassed,
          avgPerDay: currentMonthTotal / daysPassed,
        },
        last7Days: {
          total: last7DaysTotal,
          avgPerDay: avgDailyLast7Days,
        },
        prediction: {
          daysRemaining,
          predictedRemaining,
          predictedMonthEnd,
        },
        period: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
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

/**
 * B.1.2 - Dự đoán chi tiêu cuối tháng (dựa trên trung bình 30 ngày gần nhất)
 * Sử dụng thuật toán: Weighted Average với trọng số giảm dần theo thời gian
 */
const predictMonthEndExpense30Days = async (userId) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    // Lấy chi tiêu theo ngày trong 30 ngày gần nhất
    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: last30Days, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Chi tiêu từ đầu tháng đến hiện tại
    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const last30DaysTotal = dailyStats.reduce((sum, day) => sum + day.totalAmount, 0);
    const currentMonthTotal = currentMonthStats[0]?.totalAmount || 0;

    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;

    // Thuật toán: Weighted Average với trọng số giảm dần (ngày gần nhất có trọng số cao hơn)
    let avgDailyLast30Days = 0;
    if (dailyStats.length > 0) {
      const dailyAmounts = dailyStats.map((d) => d.totalAmount);
      
      if (dailyAmounts.length >= 7) {
        // Weighted average: ngày gần nhất có trọng số cao hơn
        const weights = dailyAmounts.map((_, idx) => {
          // Trọng số tăng dần: ngày gần nhất = weight cao nhất
          return (idx + 1) / dailyAmounts.length;
        });
        
        const weightedSum = dailyAmounts.reduce((sum, val, idx) => sum + val * weights[idx], 0);
        const weightSum = weights.reduce((sum, w) => sum + w, 0);
        avgDailyLast30Days = weightedSum / weightSum;
      } else if (dailyAmounts.length > 0) {
        // Ít dữ liệu, dùng trung bình đơn giản
        avgDailyLast30Days = calculateMean(dailyAmounts);
      }
    } else if (last30DaysTotal > 0) {
      // Fallback: chia đều cho 30 ngày
      avgDailyLast30Days = last30DaysTotal / 30;
    } else if (currentMonthTotal > 0 && daysPassed > 0) {
      // Nếu không có dữ liệu 30 ngày, dùng trung bình tháng hiện tại
      avgDailyLast30Days = currentMonthTotal / daysPassed;
    }

    const predictedRemaining = avgDailyLast30Days * daysRemaining;
    const predictedMonthEnd = currentMonthTotal + predictedRemaining;

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu cuối tháng (30 ngày) thành công",
      data: {
        method: "30-day-average",
        currentMonth: {
          total: currentMonthTotal,
          daysPassed,
          avgPerDay: currentMonthTotal / daysPassed,
        },
        last30Days: {
          total: last30DaysTotal,
          avgPerDay: avgDailyLast30Days,
        },
        prediction: {
          daysRemaining,
          predictedRemaining,
          predictedMonthEnd,
        },
        period: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
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

/**
 * B.1.3 - Dự đoán chi tiêu cuối tháng (dựa trên xu hướng tăng/giảm)
 */
const predictMonthEndExpenseTrend = async (userId) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last60Days = new Date(now);
    last60Days.setDate(now.getDate() - 60);

    // Lấy chi tiêu theo tuần trong 60 ngày gần nhất
    const weeklyStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: last60Days, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            week: { $week: "$date" },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ]);

    // Tính xu hướng bằng Linear Regression
    let trend = 0;
    let dailyTrend = 0;
    let trendDirection = "stable";
    let r2 = 0;
    
    if (weeklyStats.length >= 2) {
      const amounts = weeklyStats.map((s) => s.totalAmount);
      const x = amounts.map((_, idx) => idx); // [0, 1, 2, ...]
      
      // Linear Regression: y = ax + b
      const regression = linearRegression(x, amounts);
      trend = regression.slope; // Xu hướng theo tuần
      dailyTrend = trend / 7; // Chuyển sang ngày
      r2 = regression.r2;
      
      // Xác định hướng xu hướng
      if (trend > 0 && r2 > 0.3) {
        trendDirection = "increasing";
      } else if (trend < 0 && r2 > 0.3) {
        trendDirection = "decreasing";
      } else {
        trendDirection = "stable";
      }
    }

    // Chi tiêu từ đầu tháng đến hiện tại
    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const currentMonthTotal = currentMonthStats[0]?.totalAmount || 0;
    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;

    // Dự đoán dựa trên xu hướng với Linear Regression
    const avgDailyCurrent = daysPassed > 0 ? currentMonthTotal / daysPassed : 0;
    
    // Sử dụng Linear Regression để dự đoán chính xác hơn
    let predictedDailyForRemaining = avgDailyCurrent;
    if (weeklyStats.length >= 2 && r2 > 0.2) {
      // Dự đoán dựa trên xu hướng nếu có độ tin cậy
      predictedDailyForRemaining = avgDailyCurrent + dailyTrend;
    } else {
      // Nếu không có xu hướng rõ ràng, dùng Exponential Smoothing
      const recentWeeklyAmounts = weeklyStats.slice(-4).map((s) => s.totalAmount);
      const smoothedWeekly = exponentialSmoothing(recentWeeklyAmounts, 0.3);
      predictedDailyForRemaining = smoothedWeekly / 7;
    }
    
    const predictedRemaining = Math.max(0, predictedDailyForRemaining * daysRemaining);
    const predictedMonthEnd = currentMonthTotal + predictedRemaining;

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu cuối tháng (xu hướng) thành công",
      data: {
        method: "trend-based",
        currentMonth: {
          total: currentMonthTotal,
          daysPassed,
          avgPerDay: avgDailyCurrent,
        },
        trend: {
          weeklyTrend: trend,
          dailyTrend: dailyTrend,
          direction: trendDirection,
          confidence: r2, // Độ tin cậy của xu hướng (0-1)
        },
        prediction: {
          daysRemaining,
          predictedDailyForRemaining,
          predictedRemaining,
          predictedMonthEnd,
        },
        period: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
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

/**
 * B.2.1 - Dự đoán vượt ngân sách
 */
const predictBudgetOverrun = async (userId) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Lấy tất cả ngân sách monthly đang active trong tháng này
    const budgets = await Budget.find({
      userId,
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
      // Tính chi tiêu hiện tại trong tháng cho category này
      const spentStats = await Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            categoryId: budget.category._id,
            date: { $gte: currentMonthStart, $lte: now },
            ...(budget.wallet ? { walletId: budget.wallet } : {}),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const spent = spentStats[0]?.totalAmount || 0;
      const limit = budget.limit_amount;
      const remaining = limit - spent;
      const usagePercent = (spent / limit) * 100;

      // Dự đoán dựa trên tốc độ chi tiêu hiện tại
      const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysPassed;
      const avgDailySpending = spent / daysPassed;
      const predictedRemaining = avgDailySpending * daysRemaining;
      const predictedTotal = spent + predictedRemaining;
      const predictedOverrun = predictedTotal - limit;
      const overrunPercent = (predictedOverrun / limit) * 100;

      // Tính ngày dự kiến vượt (nếu có)
      let predictedOverrunDate = null;
      if (avgDailySpending > 0 && remaining > 0) {
        const daysUntilOverrun = Math.ceil(remaining / avgDailySpending);
        const predictedDate = new Date(now);
        predictedDate.setDate(now.getDate() + daysUntilOverrun);
        if (predictedDate <= currentMonthEnd) {
          predictedOverrunDate = predictedDate;
        }
      }

      predictions.push({
        budgetId: budget._id,
        budgetName: budget.name,
        category: {
          id: budget.category._id,
          name: budget.category.name,
          icon: budget.category.icon,
        },
        limit: limit,
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
      data: {
        predictions,
        atRisk: predictions.filter((p) => p.isAtRisk),
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

/**
 * B.3.1 - Dự đoán chi tiêu theo danh mục (Machine Learning nhẹ)
 */
const predictCategorySpending = async (userId, options = {}) => {
  try {
    const { days = 30 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Lấy chi tiêu theo danh mục trong 30 ngày gần nhất, nhóm theo tuần
    const weeklyCategoryStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            categoryId: "$categoryId",
            year: { $year: "$date" },
            week: { $week: "$date" },
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
      { $sort: { "_id.categoryId": 1, "_id.year": 1, "_id.week": 1 } },
    ]);

    // Nhóm theo category và tính xu hướng
    const categoryMap = {};
    weeklyCategoryStats.forEach((stat) => {
      const catId = stat._id.categoryId.toString();
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

    // Dự đoán cho tuần tới
    const predictions = Object.values(categoryMap).map((cat) => {
      const amounts = cat.weeklyAmounts;
      let predictedNextWeek = 0;

      // Sử dụng kết hợp Linear Regression và Exponential Smoothing
      let trend = 0;
      let confidence = 0;
      
      if (amounts.length >= 2) {
        // Linear Regression để tính xu hướng
        const x = amounts.map((_, idx) => idx);
        const regression = linearRegression(x, amounts);
        trend = regression.slope;
        confidence = regression.r2;
        
        // Dự đoán bằng Linear Regression nếu có độ tin cậy cao
        if (confidence > 0.4) {
          const nextX = amounts.length;
          predictedNextWeek = regression.slope * nextX + regression.intercept;
        } else {
          // Dùng Exponential Smoothing nếu xu hướng không rõ ràng
          predictedNextWeek = exponentialSmoothing(amounts, 0.3);
        }
        
        // Đảm bảo giá trị dự đoán không âm
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
        },
        prediction: {
          nextWeek: predictedNextWeek,
          trend,
          trendDirection: trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable",
          confidence: confidence, // Độ tin cậy của dự đoán
        },
      };
    });

    return {
      status: true,
      error: 0,
      message: "Dự đoán chi tiêu theo danh mục thành công",
      data: {
        predictions,
        method: "weighted-moving-average",
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

// ============================================
// C. PRESCRIPTIVE ANALYTICS (Khuyến nghị hành động)
// ============================================

/**
 * C.1.1 - Gợi ý tối ưu chi tiêu (danh mục nên giảm chi)
 */
const suggestOptimizeSpending = async (userId, options = {}) => {
  try {
    const { days = 30, thresholdPercent = 20 } = options;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Lấy chi tiêu theo danh mục trong khoảng thời gian
    const categoryStats = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: startDate, $lte: now },
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
          avgAmount: { $divide: ["$totalAmount", "$count"] },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    if (categoryStats.length === 0) {
      return {
        status: true,
        error: 0,
        message: "Không có dữ liệu để phân tích",
        data: { suggestions: [] },
      };
    }

    // Tính tổng chi tiêu
    const totalExpense = categoryStats.reduce((sum, cat) => sum + cat.totalAmount, 0);

    // Phân tích chi tiết và tính toán gợi ý tối ưu thông minh
    const suggestions = categoryStats
      .filter((cat) => {
        const percentage = (cat.totalAmount / totalExpense) * 100;
        return percentage >= thresholdPercent;
      })
      .map((cat) => {
        const percentage = (cat.totalAmount / totalExpense) * 100;
        
        // Tính toán % giảm đề xuất dựa trên phân tích
        // Nếu chi tiêu chiếm >30% tổng chi → giảm 20%
        // Nếu chi tiêu chiếm 20-30% → giảm 15%
        // Nếu chi tiêu chiếm <20% → giảm 10%
        let reductionPercent = 10;
        if (percentage >= 30) {
          reductionPercent = 20;
        } else if (percentage >= 20) {
          reductionPercent = 15;
        }
        
        const suggestedReduction = cat.totalAmount * (reductionPercent / 100);
        const suggestedNewAmount = cat.totalAmount - suggestedReduction;
        
        // Tính độ biến thiên để đánh giá khả năng tiết kiệm
        // Lấy lịch sử chi tiêu của category này để phân tích
        const mean = cat.avgAmount;
        const stdDev = calculateStdDev([cat.totalAmount], mean);
        const zScore = calculateZScore(cat.totalAmount, mean, stdDev);
        
        // Nếu có biến thiên lớn (outlier) → có thể tiết kiệm nhiều hơn
        const adjustmentFactor = Math.abs(zScore) > 1.5 ? 1.2 : 1.0;
        const adjustedSavings = suggestedReduction * adjustmentFactor;
        
        // Tính priority dựa trên nhiều yếu tố
        let priority = "low";
        if (percentage >= 30 || zScore > 2) {
          priority = "high";
        } else if (percentage >= 20 || zScore > 1) {
          priority = "medium";
        }
        
        return {
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          categoryIcon: cat.categoryIcon,
          currentSpending: {
            total: cat.totalAmount,
            count: cat.count,
            avgPerTransaction: cat.avgAmount,
            percentageOfTotal: percentage,
            variance: stdDev, // Độ biến thiên
            zScore: zScore, // Điểm Z để phát hiện outlier
          },
          suggestion: {
            reductionPercent: reductionPercent,
            suggestedReduction: adjustedSavings,
            suggestedNewAmount: cat.totalAmount - adjustedSavings,
            potentialSavings: adjustedSavings,
            reason: zScore > 1.5 
              ? "Chi tiêu có biến thiên lớn, có thể tối ưu"
              : percentage >= 30
              ? "Chiếm tỷ trọng lớn trong tổng chi tiêu"
              : "Có thể giảm để cân đối ngân sách",
          },
          priority: priority,
        };
      });

    return {
      status: true,
      error: 0,
      message: "Gợi ý tối ưu chi tiêu thành công",
      data: {
        suggestions,
        totalExpense,
        potentialTotalSavings: suggestions.reduce(
          (sum, s) => sum + s.suggestion.potentialSavings,
          0
        ),
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

/**
 * C.1.2 - Đề xuất mức ngân sách phù hợp hơn
 */
const suggestBudgetAdjustment = async (userId) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last3MonthsStart = new Date(now);
    last3MonthsStart.setMonth(now.getMonth() - 3);

    // Lấy tất cả budgets
    const budgets = await Budget.find({
      userId,
      period: "monthly",
    })
      .populate("category", "name icon")
      .lean();

    const suggestions = [];

    for (const budget of budgets) {
      // Tính chi tiêu trung bình 3 tháng gần nhất cho category này
      const avgSpendingStats = await Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            categoryId: budget.category._id,
            date: { $gte: last3MonthsStart, $lte: now },
            ...(budget.wallet ? { walletId: budget.wallet } : {}),
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      if (avgSpendingStats.length > 0) {
        const monthlyAmounts = avgSpendingStats.map((s) => s.totalAmount);
        const avgMonthlySpending = calculateMean(monthlyAmounts);
        const currentLimit = budget.limit_amount;
        const stdDev = calculateStdDev(monthlyAmounts, avgMonthlySpending);
        
        // Tính toán ngân sách đề xuất thông minh hơn
        // Sử dụng percentile 75th + buffer để đảm bảo không vượt quá thường xuyên
        const percentile75 = calculatePercentile(monthlyAmounts, 75);
        const percentile90 = calculatePercentile(monthlyAmounts, 90);
        
        // Đề xuất dựa trên phân tích thống kê
        // Nếu có biến thiên lớn → dùng percentile 90
        // Nếu biến thiên nhỏ → dùng percentile 75
        const coefficientOfVariation = stdDev / avgMonthlySpending;
        let suggestedLimit;
        
        if (coefficientOfVariation > 0.3) {
          // Biến thiên lớn → dùng percentile 90 + 10% buffer
          suggestedLimit = percentile90 * 1.1;
        } else if (coefficientOfVariation > 0.15) {
          // Biến thiên trung bình → dùng percentile 75 + 15% buffer
          suggestedLimit = percentile75 * 1.15;
        } else {
          // Biến thiên nhỏ → dùng trung bình + 20% buffer
          suggestedLimit = avgMonthlySpending * 1.2;
        }
        
        // Đảm bảo suggested limit không quá thấp hoặc quá cao
        const minLimit = avgMonthlySpending * 1.1; // Tối thiểu 110% trung bình
        const maxLimit = percentile90 * 1.5; // Tối đa 150% percentile 90
        suggestedLimit = Math.max(minLimit, Math.min(suggestedLimit, maxLimit));
        
        const difference = suggestedLimit - currentLimit;
        const differencePercent = calculateGrowthPercent(suggestedLimit, currentLimit);

        // Kiểm tra xem có vượt ngân sách thường xuyên không
        const overrunCount = monthlyAmounts.filter((amount) => amount > currentLimit).length;
        const overrunRate = (overrunCount / monthlyAmounts.length) * 100;
        
        // Tính toán lý do đề xuất dựa trên phân tích
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
          category: {
            id: budget.category._id,
            name: budget.category.name,
            icon: budget.category.icon,
          },
          current: {
            limit: currentLimit,
            avgSpending: avgMonthlySpending,
            usagePercent: (avgMonthlySpending / currentLimit) * 100,
            overrunRate,
          },
          suggestion: {
            suggestedLimit,
            difference,
            differencePercent,
            reason: reason,
            statisticalAnalysis: {
              avgSpending: avgMonthlySpending,
              stdDev: stdDev,
              percentile75: percentile75,
              percentile90: percentile90,
              coefficientOfVariation: coefficientOfVariation,
            },
          },
          priority: overrunRate >= 50 ? "high" : avgMonthlySpending > currentLimit ? "medium" : "low",
        });
      }
    }

    return {
      status: true,
      error: 0,
      message: "Đề xuất điều chỉnh ngân sách thành công",
      data: {
        suggestions,
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

/**
 * C.2.1 - Khuyến nghị chuyển tiền giữa các ví
 */
const suggestWalletTransfer = async (userId) => {
  try {
    const wallets = await Wallet.find({ userId, is_archived: false }).lean();
    const suggestions = [];
    const lowBalanceWallets = [];
    const highBalanceWallets = [];

    // Phân loại ví: sắp âm (<10% số dư ban đầu hoặc < threshold)
    const threshold = 100000; // 100k VND

    for (const wallet of wallets) {
      if (wallet.balance < threshold || wallet.balance < 0) {
        lowBalanceWallets.push({
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance: wallet.balance,
          isLow: true,
        });
      } else if (wallet.balance > threshold * 5) {
        // Ví có số dư cao (>500k)
        highBalanceWallets.push({
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance: wallet.balance,
        });
      }
    }

    // Thuật toán tối ưu chuyển tiền: Greedy Algorithm
    // Sắp xếp ví thiếu theo mức độ cần thiết (âm số dư > sắp hết)
    lowBalanceWallets.sort((a, b) => {
      if (a.currentBalance < 0 && b.currentBalance >= 0) return -1;
      if (a.currentBalance >= 0 && b.currentBalance < 0) return 1;
      return a.currentBalance - b.currentBalance;
    });

    // Sắp xếp ví dư theo số dư giảm dần
    highBalanceWallets.sort((a, b) => b.currentBalance - a.currentBalance);

    // Tối ưu hóa: Chuyển từ ví dư nhất sang ví thiếu nhất
    const usedHighWallets = new Set();
    
    lowBalanceWallets.forEach((lowWallet) => {
      const neededAmount = Math.abs(lowWallet.currentBalance) + threshold * 2; // Cần ít nhất 200k
      
      // Tìm ví dư phù hợp nhất (đủ tiền và chưa được sử dụng nhiều)
      for (const highWallet of highBalanceWallets) {
        if (usedHighWallets.has(highWallet.walletId.toString())) continue;
        
        // Tính số tiền có thể chuyển
        // Không chuyển quá 30% từ ví dư, và đảm bảo ví dư còn ít nhất 100k
        const maxFromHigh = Math.min(
          highWallet.currentBalance * 0.3,
          highWallet.currentBalance - threshold
        );
        
        if (maxFromHigh < threshold) continue;
        
        // Số tiền đề xuất: đủ để ví thiếu có 200k, nhưng không quá 30% ví dư
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
            reason: lowWallet.currentBalance < 0 
              ? "Ví đang âm số dư, cần chuyển ngay"
              : lowWallet.currentBalance < threshold
              ? "Ví sắp hết tiền, cần bổ sung"
              : "Cân đối số dư giữa các ví",
            priority: lowWallet.currentBalance < 0 
              ? "high" 
              : lowWallet.currentBalance < threshold 
              ? "medium" 
              : "low",
            optimization: {
              neededAmount: neededAmount,
              availableFromHigh: maxFromHigh,
              transferEfficiency: (suggestedAmount / neededAmount) * 100, // % đáp ứng nhu cầu
            },
          });
          
          // Đánh dấu ví dư đã được sử dụng (có thể dùng lại nếu còn dư)
          if (suggestedAmount >= maxFromHigh * 0.8) {
            usedHighWallets.add(highWallet.walletId.toString());
          }
          
          break; // Đã tìm được ví phù hợp, chuyển sang ví thiếu tiếp theo
        }
      }
    });

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
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
};

/**
 * C.3.1 - Tạo cảnh báo thông minh và lưu vào database
 */
const createSmartAlerts = async (userId) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const alerts = [];

    // 1. Kiểm tra chi tiêu tháng tăng so với tháng trước
    const [currentMonthStats, previousMonthStats] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: currentMonthStart, $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: previousMonthStart, $lte: previousMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const currentTotal = currentMonthStats[0]?.totalAmount || 0;
    const previousTotal = previousMonthStats[0]?.totalAmount || 0;
    const increasePercent = calculateGrowthPercent(currentTotal, previousTotal);

    // Tính chi tiêu dự kiến cuối tháng
    const daysPassed = Math.floor((now - currentMonthStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const estimatedMonthEnd = (currentTotal / daysPassed) * daysInMonth;
    const estimatedIncrease = calculateGrowthPercent(estimatedMonthEnd, previousTotal);

    if (estimatedIncrease >= 15) {
      alerts.push({
        userId,
        type: "MONTHLY_SPENDING_INCREASE",
        title: "Chi tiêu tháng này tăng cao",
        message: `Bạn đang chi nhiều hơn ${estimatedIncrease.toFixed(1)}% so với tháng trước. Dự kiến cuối tháng sẽ chi ${estimatedMonthEnd.toLocaleString("vi-VN")} VND (tháng trước: ${previousTotal.toLocaleString("vi-VN")} VND).`,
        isRead: false,
      });
    }

    // 2. Kiểm tra danh mục tăng đột biến
    const categorySpikes = await getCategorySpendingSpikes(userId, { months: 2, thresholdPercent: 50 });
    if (categorySpikes.status && categorySpikes.data.spikes.length > 0) {
      categorySpikes.data.spikes.slice(0, 3).forEach((spike) => {
        alerts.push({
          userId,
          type: "CATEGORY_SPENDING_SPIKE",
          title: `${spike.categoryName} tăng đột biến`,
          message: `Danh mục "${spike.categoryName}" tăng ${spike.growthPercent.toFixed(1)}% so với tháng trước (${spike.totalAmount.toLocaleString("vi-VN")} VND).`,
          isRead: false,
          related: {
            model: "Category",
            id: spike.categoryId,
          },
        });
      });
    }

    // 3. Kiểm tra vượt ngân sách
    const budgetOverrun = await predictBudgetOverrun(userId);
    if (budgetOverrun.status && budgetOverrun.data.atRisk.length > 0) {
      budgetOverrun.data.atRisk.slice(0, 3).forEach((budget) => {
        alerts.push({
          userId,
          type: "BUDGET_OVERRUN_PREDICTED",
          title: `Ngân sách "${budget.category.name}" sắp vượt`,
          message: `Ngân sách "${budget.category.name}" đã sử dụng ${budget.usagePercent.toFixed(1)}%. Dự kiến sẽ vượt ${budget.prediction.overrunPercent.toFixed(1)}% cuối tháng.`,
          isRead: false,
          related: {
            model: "Budget",
            id: budget.budgetId,
          },
        });
      });
    }

    // 4. Kiểm tra ví sắp hết tiền
    const wallets = await Wallet.find({ userId, is_archived: false }).lean();
    wallets.forEach((wallet) => {
      if (wallet.balance < 100000 && wallet.balance > 0) {
        alerts.push({
          userId,
          type: "LOW_WALLET_BALANCE",
          title: `Ví "${wallet.name}" sắp hết tiền`,
          message: `Ví "${wallet.name}" chỉ còn ${wallet.balance.toLocaleString("vi-VN")} VND. Hãy nạp thêm tiền.`,
          isRead: false,
          related: {
            model: "Wallet",
            id: wallet._id,
          },
        });
      }
    });

    // 5. Gợi ý tối ưu chi tiêu
    const optimizeSuggestions = await suggestOptimizeSpending(userId, { days: 30, thresholdPercent: 20 });
    if (optimizeSuggestions.status && optimizeSuggestions.data.suggestions.length > 0) {
      const topSuggestion = optimizeSuggestions.data.suggestions[0];
      alerts.push({
        userId,
        type: "SUGGEST_OPTIMIZE_SPENDING",
        title: "Gợi ý tối ưu chi tiêu",
        message: `Bạn có thể tiết kiệm ${optimizeSuggestions.data.potentialTotalSavings.toLocaleString("vi-VN")} VND bằng cách giảm chi cho danh mục "${topSuggestion.categoryName}" và các danh mục khác.`,
        isRead: false,
        related: {
          model: "Category",
          id: topSuggestion.categoryId,
        },
      });
    }

    // Lưu các cảnh báo vào database (chỉ lưu những cảnh báo mới)
    const savedAlerts = [];
    for (const alert of alerts) {
      // Kiểm tra xem đã có cảnh báo tương tự chưa (trong 24h gần nhất)
      const oneDayAgo = new Date(now);
      oneDayAgo.setHours(now.getHours() - 24);
      
      const existing = await Alert.findOne({
        userId,
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

    return {
      status: true,
      error: 0,
      message: "Tạo cảnh báo thông minh thành công",
      data: {
        alertsCreated: savedAlerts.length,
        totalAlerts: alerts.length,
        alerts: savedAlerts,
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

/**
 * C.3.2 - Lấy lịch sử cảnh báo
 */
const getAlertHistory = async (userId, options = {}) => {
  try {
    const { limit = 50, isRead = null } = options;
    const query = { userId };

    if (isRead !== null) {
      query.isRead = isRead;
    }

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      status: true,
      error: 0,
      message: "Lấy lịch sử cảnh báo thành công",
      data: {
        alerts,
        total: alerts.length,
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

/**
 * C.3.3 - Đánh dấu cảnh báo đã đọc
 */
const markAlertAsRead = async (userId, alertId) => {
  try {
    const alert = await Alert.findOne({ _id: alertId, userId });

    if (!alert) {
      return {
        status: false,
        error: 1,
        message: "Cảnh báo không tồn tại",
        data: null,
      };
    }

    alert.isRead = true;
    await alert.save();

    return {
      status: true,
      error: 0,
      message: "Đánh dấu cảnh báo đã đọc thành công",
      data: alert.toObject(),
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
  // A. Diagnostic Analytics
  getCategorySpendingSpikes,
  getMonthlySpendingSpikes,
  getWalletVariations,
  detectUnusualLargeExpenses,
  detectUnusualTimeSpending,
  detect24hSpendingSpike,
  getMostSpendingDayOfWeek,
  getMostFrequentCategories,
  getTransactionFrequency,
  // B. Predictive Analytics
  predictMonthEndExpense7Days,
  predictMonthEndExpense30Days,
  predictMonthEndExpenseTrend,
  predictBudgetOverrun,
  predictCategorySpending,
  // C. Prescriptive Analytics
  suggestOptimizeSpending,
  suggestBudgetAdjustment,
  suggestWalletTransfer,
  createSmartAlerts,
  getAlertHistory,
  markAlertAsRead,
};

