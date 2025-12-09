const mongoose = require("mongoose");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");

/**
 * Helper: Lấy dữ liệu tài chính trong một khoảng thời gian
 */
const getPeriodData = async (userId, startDate, endDate) => {
  const matchQuery = {
    userId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  const stats = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  let totalIncome = 0;
  let totalExpense = 0;

  const incomeStat = stats.find((s) => s._id === "income");
  if (incomeStat) totalIncome = incomeStat.totalAmount;

  const expenseStat = stats.find((s) => s._id === "expense");
  if (expenseStat) totalExpense = expenseStat.totalAmount;

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
};

/**
 * Helper: Tính phần trăm thay đổi
 */
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : (current < 0 ? -100 : 0);
  }
  return ((current - previous) / previous) * 100;
};

/**
 * Helper: Lấy ngày đầu và cuối tháng hiện tại
 */
const getCurrentMonthRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

/**
 * Helper: Lấy ngày đầu và cuối tháng trước
 */
const getPreviousMonthRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

/**
 * Helper: Lấy ngày đầu và cuối tuần hiện tại (Thứ 2 - Chủ nhật)
 */
const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
  
  // Tính số ngày cần lùi lại để đến Thứ 2
  // Nếu Chủ nhật (0) thì lùi 6 ngày, nếu Thứ 2 (1) thì lùi 0 ngày, v.v.
  const daysToMonday = day === 0 ? 6 : day - 1;
  
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - daysToMonday);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
};

/**
 * Helper: Lấy ngày đầu và cuối tuần trước
 */
const getPreviousWeekRange = () => {
  const { startDate: currentStart } = getCurrentWeekRange();
  const endDate = new Date(currentStart);
  endDate.setDate(currentStart.getDate() - 1);
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);
  
  return { startDate, endDate };
};

/**
 * Helper: Lấy ngày đầu và cuối năm hiện tại
 */
const getCurrentYearRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1); // 1 tháng 1
  const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // 31 tháng 12
  return { startDate, endDate };
};

/**
 * Helper: Lấy ngày đầu và cuối năm trước
 */
const getPreviousYearRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 1, 0, 1); // 1 tháng 1 năm trước
  const endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999); // 31 tháng 12 năm trước
  return { startDate, endDate };
};

/**
 * Lấy Financial Dashboard - Tổng quan tài chính
 * Bao gồm: Tổng thu, Tổng chi, Tổng số dư ví, Chênh lệch thu - chi
 */
const getFinancialDashboard = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;

    // Xây dựng query filter cho transaction
    const matchQuery = { userId };
    
    // Lọc theo khoảng thời gian nếu có
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        matchQuery.date.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set thời gian cuối ngày (23:59:59.999)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = endDateTime;
      }
    }

    // Tính tổng thu và tổng chi từ transaction
    // Tổng thu: chỉ tính income (thu nhập thực tế)
    // Tổng chi: chỉ tính expense (chi tiêu thực tế)
    // Note: transfer, adjust, debt, loan không tính vào thu/chi vì không phải thu/chi thực tế
    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Khởi tạo kết quả
    let totalIncome = 0;  // Tổng thu
    let totalExpense = 0; // Tổng chi

    // Tính tổng thu (chỉ income)
    const incomeStat = stats.find((s) => s._id === "income");
    if (incomeStat) totalIncome = incomeStat.totalAmount;

    // Tính tổng chi (chỉ expense)
    const expenseStat = stats.find((s) => s._id === "expense");
    if (expenseStat) totalExpense = expenseStat.totalAmount;

    // Tính tổng số dư tất cả ví của user (chỉ tính ví chưa bị archive và chưa xóa)
    const wallets = await Wallet.find({ 
      userId,
      is_archived: false,
    }).lean();

    const totalWalletBalance = wallets.reduce((sum, wallet) => {
      return sum + (wallet.balance || 0);
    }, 0);

    // Tính chênh lệch thu - chi
    const balance = totalIncome - totalExpense;

    // Kết quả trả về
    const result = {
      totalIncome,
      totalExpense,
      totalWalletBalance,
      balance, // Chênh lệch thu - chi
      walletCount: wallets.length,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };

    return {
      status: true,
      error: 0,
      message: "Lấy dữ liệu Financial Dashboard thành công",
      data: result,
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
 * So sánh tháng hiện tại với tháng trước
 */
const compareCurrentMonthWithPrevious = async (userId) => {
  try {
    const currentRange = getCurrentMonthRange();
    const previousRange = getPreviousMonthRange();

    const [currentData, previousData] = await Promise.all([
      getPeriodData(userId, currentRange.startDate, currentRange.endDate),
      getPeriodData(userId, previousRange.startDate, previousRange.endDate),
    ]);

    const result = {
      current: {
        period: "Tháng hiện tại",
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
        totalIncome: currentData.totalIncome,
        totalExpense: currentData.totalExpense,
        balance: currentData.balance,
      },
      previous: {
        period: "Tháng trước",
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
        totalIncome: previousData.totalIncome,
        totalExpense: previousData.totalExpense,
        balance: previousData.balance,
      },
      comparison: {
        incomeChange: currentData.totalIncome - previousData.totalIncome,
        incomeChangePercent: calculatePercentageChange(currentData.totalIncome, previousData.totalIncome),
        expenseChange: currentData.totalExpense - previousData.totalExpense,
        expenseChangePercent: calculatePercentageChange(currentData.totalExpense, previousData.totalExpense),
        balanceChange: currentData.balance - previousData.balance,
        balanceChangePercent: calculatePercentageChange(currentData.balance, previousData.balance),
      },
    };

    return {
      status: true,
      error: 0,
      message: "So sánh tháng hiện tại với tháng trước thành công",
      data: result,
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
 * So sánh tuần hiện tại với tuần trước
 */
const compareCurrentWeekWithPrevious = async (userId) => {
  try {
    const currentRange = getCurrentWeekRange();
    const previousRange = getPreviousWeekRange();

    const [currentData, previousData] = await Promise.all([
      getPeriodData(userId, currentRange.startDate, currentRange.endDate),
      getPeriodData(userId, previousRange.startDate, previousRange.endDate),
    ]);

    const result = {
      current: {
        period: "Tuần hiện tại",
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
        totalIncome: currentData.totalIncome,
        totalExpense: currentData.totalExpense,
        balance: currentData.balance,
      },
      previous: {
        period: "Tuần trước",
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
        totalIncome: previousData.totalIncome,
        totalExpense: previousData.totalExpense,
        balance: previousData.balance,
      },
      comparison: {
        incomeChange: currentData.totalIncome - previousData.totalIncome,
        incomeChangePercent: calculatePercentageChange(currentData.totalIncome, previousData.totalIncome),
        expenseChange: currentData.totalExpense - previousData.totalExpense,
        expenseChangePercent: calculatePercentageChange(currentData.totalExpense, previousData.totalExpense),
        balanceChange: currentData.balance - previousData.balance,
        balanceChangePercent: calculatePercentageChange(currentData.balance, previousData.balance),
      },
    };

    return {
      status: true,
      error: 0,
      message: "So sánh tuần hiện tại với tuần trước thành công",
      data: result,
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
 * So sánh năm hiện tại với năm trước
 */
const compareCurrentYearWithPrevious = async (userId) => {
  try {
    const currentRange = getCurrentYearRange();
    const previousRange = getPreviousYearRange();

    const [currentData, previousData] = await Promise.all([
      getPeriodData(userId, currentRange.startDate, currentRange.endDate),
      getPeriodData(userId, previousRange.startDate, previousRange.endDate),
    ]);

    const result = {
      current: {
        period: "Năm hiện tại",
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
        totalIncome: currentData.totalIncome,
        totalExpense: currentData.totalExpense,
        balance: currentData.balance,
      },
      previous: {
        period: "Năm trước",
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
        totalIncome: previousData.totalIncome,
        totalExpense: previousData.totalExpense,
        balance: previousData.balance,
      },
      comparison: {
        incomeChange: currentData.totalIncome - previousData.totalIncome,
        incomeChangePercent: calculatePercentageChange(currentData.totalIncome, previousData.totalIncome),
        expenseChange: currentData.totalExpense - previousData.totalExpense,
        expenseChangePercent: calculatePercentageChange(currentData.totalExpense, previousData.totalExpense),
        balanceChange: currentData.balance - previousData.balance,
        balanceChangePercent: calculatePercentageChange(currentData.balance, previousData.balance),
      },
    };

    return {
      status: true,
      error: 0,
      message: "So sánh năm hiện tại với năm trước thành công",
      data: result,
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
 * A.3 - Biến động ví: Hiển thị ví nào tăng / ví nào giảm
 */
const getWalletChanges = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;
    const now = new Date();
    
    // Nếu không có ngày, lấy tháng hiện tại
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      const currentMonth = getCurrentMonthRange();
      periodStart = currentMonth.startDate;
      periodEnd = currentMonth.endDate;
    }

    // Lấy tất cả ví của user
    const wallets = await Wallet.find({
      userId,
      is_archived: false,
    }).lean();

    // Lấy số dư ban đầu (trước khoảng thời gian)
    periodStart.setHours(0, 0, 0, 0);
    const startDateObj = new Date(periodStart);
    startDateObj.setDate(startDateObj.getDate() - 1); // Ngày trước đó

    const walletChanges = await Promise.all(
      wallets.map(async (wallet) => {
        // Tính số dư tại thời điểm bắt đầu (balance hiện tại - tổng giao dịch trong kỳ)
        const periodTransactions = await Transaction.aggregate([
          {
            $match: {
              userId,
              walletId: wallet._id,
              date: { $gte: periodStart, $lte: periodEnd },
            },
          },
          {
            $group: {
              _id: "$type",
              totalAmount: { $sum: "$amount" },
            },
          },
        ]);

        let periodIncome = 0;
        let periodExpense = 0;
        let periodTransferOut = 0;
        let periodTransferIn = 0;

        periodTransactions.forEach((t) => {
          if (t._id === "income") periodIncome += t.totalAmount;
          else if (t._id === "expense") periodExpense += t.totalAmount;
          else if (t._id === "transfer") {
            // Kiểm tra ví này là nguồn hay đích
            // Cần query thêm để xác định
          }
        });

        // Tính số dư ban đầu (giả định)
        const currentBalance = wallet.balance || 0;
        const periodNetChange = periodIncome - periodExpense;
        const estimatedStartBalance = currentBalance - periodNetChange;

        const change = currentBalance - estimatedStartBalance;
        const changePercent = estimatedStartBalance === 0 
          ? (currentBalance > 0 ? 100 : 0)
          : (change / estimatedStartBalance) * 100;

        return {
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance,
          estimatedStartBalance,
          change,
          changePercent,
          periodIncome,
          periodExpense,
          trend: change > 0 ? "increase" : change < 0 ? "decrease" : "stable",
        };
      })
    );

    // Sắp xếp theo thay đổi giảm dần
    walletChanges.sort((a, b) => b.change - a.change);

    return {
      status: true,
      error: 0,
      message: "Lấy dữ liệu biến động ví thành công",
      data: {
        wallets: walletChanges,
        period: {
          startDate: periodStart,
          endDate: periodEnd,
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
 * B.1 - Báo cáo theo thời gian (Theo ngày)
 */
const getTimeBasedReportByDay = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    
    if (!startDate || !endDate) {
      return {
        status: false,
        error: 1,
        message: "startDate và endDate là bắt buộc",
        data: null,
      };
    }

    const matchQuery = {
      userId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (type) matchQuery.type = type;
    if (walletId) matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId) matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo ngày thành công",
      data: stats.map((item) => ({
        date: item._id,
        totalIncome: item.totalIncome,
        totalExpense: item.totalExpense,
        balance: item.totalIncome - item.totalExpense,
        count: item.count,
      })),
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
 * B.2 - Báo cáo theo thời gian (Theo tuần)
 */
const getTimeBasedReportByWeek = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    
    if (!startDate || !endDate) {
      return {
        status: false,
        error: 1,
        message: "startDate và endDate là bắt buộc",
        data: null,
      };
    }

    const matchQuery = {
      userId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (type) matchQuery.type = type;
    if (walletId) matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId) matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            week: { $week: "$date" },
          },
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo tuần thành công",
      data: stats.map((item) => ({
        year: item._id.year,
        week: item._id.week,
        label: `Tuần ${item._id.week}/${item._id.year}`,
        totalIncome: item.totalIncome,
        totalExpense: item.totalExpense,
        balance: item.totalIncome - item.totalExpense,
        count: item.count,
      })),
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
 * B.3 - Báo cáo theo thời gian (Theo tháng)
 */
const getTimeBasedReportByMonth = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    
    if (!startDate || !endDate) {
      return {
        status: false,
        error: 1,
        message: "startDate và endDate là bắt buộc",
        data: null,
      };
    }

    const matchQuery = {
      userId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (type) matchQuery.type = type;
    if (walletId) matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId) matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo tháng thành công",
      data: stats.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        label: `Tháng ${item._id.month}/${item._id.year}`,
        totalIncome: item.totalIncome,
        totalExpense: item.totalExpense,
        balance: item.totalIncome - item.totalExpense,
        count: item.count,
      })),
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
 * B.4 - Báo cáo theo thời gian (Theo năm)
 */
const getTimeBasedReportByYear = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type, walletId, categoryId } = options;
    
    if (!startDate || !endDate) {
      return {
        status: false,
        error: 1,
        message: "startDate và endDate là bắt buộc",
        data: null,
      };
    }

    const matchQuery = {
      userId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (type) matchQuery.type = type;
    if (walletId) matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId) matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $year: "$date" },
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo năm thành công",
      data: stats.map((item) => ({
        year: item._id,
        label: `Năm ${item._id}`,
        totalIncome: item.totalIncome,
        totalExpense: item.totalExpense,
        balance: item.totalIncome - item.totalExpense,
        count: item.count,
      })),
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
 * C.1 - Tổng chi theo từng danh mục
 */
const getCategoryExpenseReport = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit } = options;

    const matchQuery = {
      userId,
      type: "expense",
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = endDateTime;
      }
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
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
        },
      },
      { $sort: { totalAmount: -1 } },
      ...(limit ? [{ $limit: parseInt(limit) }] : []),
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo chi tiêu theo danh mục thành công",
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
 * C.2 - Top danh mục chi nhiều nhất
 */
const getTopExpenseCategories = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit = 10 } = options;

    const result = await getCategoryExpenseReport(userId, { startDate, endDate, limit });

    return {
      status: result.status,
      error: result.error,
      message: "Lấy top danh mục chi nhiều nhất thành công",
      data: result.data,
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
 * C.3 - Top danh mục thu nhiều nhất
 */
const getTopIncomeCategories = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit = 10 } = options;

    const matchQuery = {
      userId,
      type: "income",
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = endDateTime;
      }
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
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
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit) },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy top danh mục thu nhiều nhất thành công",
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
 * C.4 - So sánh mức chi các danh mục giữa các tháng
 */
const compareCategoryExpenseBetweenMonths = async (userId, options = {}) => {
  try {
    const { months = 6, categoryIds } = options;

    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const matchQuery = {
        userId,
        type: "expense",
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      };

      if (categoryIds && categoryIds.length > 0) {
        matchQuery.categoryId = { $in: categoryIds.map(id => new mongoose.Types.ObjectId(id)) };
      }

      const stats = await Transaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$categoryId",
            totalAmount: { $sum: "$amount" },
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

    // Sắp xếp từ tháng cũ nhất đến mới nhất
    results.reverse();

    return {
      status: true,
      error: 0,
      message: "So sánh mức chi các danh mục giữa các tháng thành công",
      data: results,
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
 * D.1 - Chi tiêu theo từng ví
 */
const getWalletExpenseReport = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;

    const matchQuery = {
      userId,
      type: { $in: ["expense", "income"] },
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = endDateTime;
      }
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$walletId",
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "wallets",
          localField: "_id",
          foreignField: "_id",
          as: "wallet",
        },
      },
      { $unwind: "$wallet" },
      {
        $project: {
          walletId: "$_id",
          walletName: "$wallet.name",
          walletType: "$wallet.type",
          totalIncome: 1,
          totalExpense: 1,
          balance: { $subtract: ["$totalIncome", "$totalExpense"] },
          count: 1,
        },
      },
      { $sort: { totalExpense: -1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo chi tiêu theo ví thành công",
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
 * D.2 - Phân bổ chi tiêu theo ví (cho pie chart)
 */
const getWalletExpenseDistribution = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;

    const result = await getWalletExpenseReport(userId, { startDate, endDate });

    if (!result.status) {
      return result;
    }

    const totalExpense = result.data.reduce((sum, item) => sum + item.totalExpense, 0);

    const distribution = result.data.map((item) => ({
      walletId: item.walletId,
      walletName: item.walletName,
      walletType: item.walletType,
      totalExpense: item.totalExpense,
      percentage: totalExpense > 0 ? (item.totalExpense / totalExpense) * 100 : 0,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy phân bổ chi tiêu theo ví thành công",
      data: {
        distribution,
        totalExpense,
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
 * D.3 - So sánh chi tiêu các ví theo thời gian
 */
const compareWalletExpenseOverTime = async (userId, options = {}) => {
  try {
    const { startDate, endDate, period = "month", walletIds } = options;

    if (!startDate || !endDate) {
      return {
        status: false,
        error: 1,
        message: "startDate và endDate là bắt buộc",
        data: null,
      };
    }

    const matchQuery = {
      userId,
      type: "expense",
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (walletIds && walletIds.length > 0) {
      matchQuery.walletId = { $in: walletIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    let groupBy;
    switch (period) {
      case "day":
        groupBy = {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          walletId: "$walletId",
        };
        break;
      case "week":
        groupBy = {
          year: { $year: "$date" },
          week: { $week: "$date" },
          walletId: "$walletId",
        };
        break;
      case "month":
        groupBy = {
          year: { $year: "$date" },
          month: { $month: "$date" },
          walletId: "$walletId",
        };
        break;
      case "year":
        groupBy = {
          year: { $year: "$date" },
          walletId: "$walletId",
        };
        break;
      default:
        groupBy = {
          year: { $year: "$date" },
          month: { $month: "$date" },
          walletId: "$walletId",
        };
    }

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          totalExpense: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "wallets",
          localField: "_id.walletId",
          foreignField: "_id",
          as: "wallet",
        },
      },
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
      { $sort: { "period.year": 1, "period.month": 1, "period.week": 1, "period.date": 1 } },
    ]);

    return {
      status: true,
      error: 0,
      message: `So sánh chi tiêu các ví theo ${period} thành công`,
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

