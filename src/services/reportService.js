const mongoose = require("mongoose");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");

/**
 * Helper: Lấy dữ liệu tài chính trong một khoảng thời gian
 */
const getPeriodData = async (userId, startDate, endDate) => {
  // Đảm bảo userId là ObjectId
  const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const matchQuery = {
    userId: userIdObj,
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

  // Kiểm tra tổng số transaction trong khoảng thời gian
  const totalTransactions = await Transaction.countDocuments(matchQuery);

  let totalIncome = 0;
  let totalExpense = 0;

  const incomeStat = stats.find((s) => s._id === "income");
  if (incomeStat) totalIncome = incomeStat.totalAmount;

  const expenseStat = stats.find((s) => s._id === "expense");
  if (expenseStat) totalExpense = expenseStat.totalAmount;

  const result = {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };

  return result;
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Xây dựng query filter cho transaction
    const matchQuery = { userId: userIdObj };

    // Lọc theo khoảng thời gian nếu có
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        matchQuery.date.$gte = startDateObj;
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

    // Kiểm tra tổng số transaction
    const totalTransactions = await Transaction.countDocuments(matchQuery);

    // Tính tổng số dư tất cả ví của user (chỉ tính ví chưa bị archive và chưa xóa)
    const wallets = await Wallet.find({
      userId: userIdObj,
      is_archived: false,
    }).lean();

    const totalWalletBalance = wallets.reduce((sum, wallet) => {
      return sum + (wallet.balance || 0);
    }, 0);

    // Tính chênh lệch thu - chi
    const balance = totalIncome - totalExpense;

    // Tính phần trăm thay đổi so với kỳ trước
    let incomeChangePercent = 0;
    let expenseChangePercent = 0;

    // Nếu có startDate và endDate, tính kỳ trước
    if (startDate && endDate) {
      try {
        const currentStartDate = new Date(startDate);
        const currentEndDate = new Date(endDate);

        // Tính số ngày của kỳ hiện tại
        const daysDiff = Math.ceil((currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24)) + 1;

        // Tính ngày bắt đầu và kết thúc của kỳ trước
        const previousEndDate = new Date(currentStartDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        previousEndDate.setHours(23, 59, 59, 999);

        const previousStartDate = new Date(previousEndDate);
        previousStartDate.setDate(previousStartDate.getDate() - daysDiff + 1);
        previousStartDate.setHours(0, 0, 0, 0);

        // Lấy dữ liệu kỳ trước
        const previousData = await getPeriodData(userId, previousStartDate, previousEndDate);

        // Tính phần trăm thay đổi
        incomeChangePercent = calculatePercentageChange(totalIncome, previousData.totalIncome);
        expenseChangePercent = calculatePercentageChange(totalExpense, previousData.totalExpense);
      } catch (prevError) {
        // Nếu có lỗi, giữ giá trị mặc định là 0
      }
    }

    // Kết quả trả về
    const result = {
      totalIncome,
      totalExpense,
      totalWalletBalance,
      balance, // Chênh lệch thu - chi
      walletCount: wallets.length,
      incomeChange: parseFloat(incomeChangePercent.toFixed(2)), // Làm tròn đến 2 chữ số thập phân
      expenseChange: parseFloat(expenseChangePercent.toFixed(2)), // Làm tròn đến 2 chữ số thập phân
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
    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    
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
      userId: userIdObj,
      is_archived: false,
    }).lean();

    // Lấy số dư ban đầu (trước khoảng thời gian)
    periodStart.setHours(0, 0, 0, 0);
    const startDateObj = new Date(periodStart);
    startDateObj.setDate(startDateObj.getDate() - 1); // Ngày trước đó

    const walletChanges = await Promise.all(
      wallets.map(async (wallet) => {
        // Tính tất cả giao dịch trong kỳ cho ví này
        const periodTransactions = await Transaction.aggregate([
          {
            $match: {
              userId: userIdObj,
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

        // Tính các giao dịch transfer (ví này là nguồn - chuyển đi)
        const transferOutTransactions = await Transaction.aggregate([
          {
            $match: {
              userId: userIdObj,
              walletId: wallet._id,
              type: "transfer",
              date: { $gte: periodStart, $lte: periodEnd },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
            },
          },
        ]);

        // Tính các giao dịch transfer (ví này là đích - nhận vào)
        const transferInTransactions = await Transaction.aggregate([
          {
            $match: {
              userId: userIdObj,
              toWalletId: wallet._id,
              type: "transfer",
              date: { $gte: periodStart, $lte: periodEnd },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
            },
          },
        ]);

        let periodIncome = 0;
        let periodExpense = 0;
        let periodTransferOut = transferOutTransactions[0]?.totalAmount || 0;
        let periodTransferIn = transferInTransactions[0]?.totalAmount || 0;

        periodTransactions.forEach((t) => {
          if (t._id === "income") periodIncome += t.totalAmount;
          else if (t._id === "expense") periodExpense += t.totalAmount;
          else if (t._id === "loan") periodIncome += t.totalAmount; // Vay được tính như thu nhập
          else if (t._id === "debt") periodExpense += t.totalAmount; // Nợ được tính như chi tiêu
          else if (t._id === "adjust") {
            // Điều chỉnh: nếu amount > 0 là tăng, < 0 là giảm
            if (t.totalAmount > 0) periodIncome += t.totalAmount;
            else periodExpense += Math.abs(t.totalAmount);
          }
        });

        // Tính số dư ban đầu: số dư hiện tại - (thu - chi + chuyển vào - chuyển ra)
        const currentBalance = wallet.balance || 0;
        const periodNetChange = periodIncome - periodExpense + periodTransferIn - periodTransferOut;
        const estimatedStartBalance = currentBalance - periodNetChange;

        // Tính thay đổi và phần trăm
        const change = currentBalance - estimatedStartBalance;
        const changePercent = estimatedStartBalance === 0
          ? (currentBalance > 0 ? 100 : currentBalance < 0 ? -100 : 0)
          : (change / Math.abs(estimatedStartBalance)) * 100;

        return {
          walletId: wallet._id,
          walletName: wallet.name,
          walletType: wallet.type,
          currentBalance,
          estimatedStartBalance,
          change,
          changePercent: parseFloat(changePercent.toFixed(2)),
          periodIncome,
          periodExpense,
          periodTransferIn,
          periodTransferOut,
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Set thời gian đầu ngày và cuối ngày
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const matchQuery = {
      userId: userIdObj,
      date: {
        $gte: startDateObj,
        $lte: endDateObj,
      },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

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

    const result = stats.map((item) => ({
      date: item._id,
      label: item._id, // Thêm label để frontend có thể dùng
      totalIncome: item.totalIncome,
      totalExpense: item.totalExpense,
      balance: item.totalIncome - item.totalExpense,
      count: item.count,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo ngày thành công",
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Set thời gian cuối ngày để lấy hết dữ liệu trong ngày cuối
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const matchQuery = {
      userId: userIdObj,
      date: {
        $gte: startDateObj,
        $lte: endDateObj,
      },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

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

    // Helper function để tính ngày đầu và cuối tuần từ year và week number (ISO week)
    const getWeekDateRange = (year, week) => {
      // MongoDB $week sử dụng ISO week numbering
      // Tuần đầu tiên của năm là tuần có ngày 4 tháng 1
      // Tuần bắt đầu từ Thứ 2

      // Tìm ngày 4 tháng 1 của năm (điểm tham chiếu cho tuần đầu tiên)
      const jan4 = new Date(year, 0, 4);

      // Tìm thứ của ngày 4/1 (0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7)
      const dayOfWeek = jan4.getDay();

      // Tính số ngày cần trừ để đến Thứ 2 của tuần chứa ngày 4/1
      // ISO week: Thứ 2 = 1, Thứ 3 = 2, ..., Chủ nhật = 0 (nhưng tính là 7)
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      // Tính ngày Thứ 2 của tuần đầu tiên (tuần chứa ngày 4/1)
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() + daysToMonday);

      // Tính ngày đầu tuần của tuần cần tìm (cộng (week - 1) * 7 ngày)
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);

      // Tính ngày cuối tuần (Chủ nhật = Thứ 2 + 6 ngày)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return { weekStart, weekEnd };
    };

    // Format date thành DD/MM
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    };

    const result = stats.map((item) => {
      const { weekStart, weekEnd } = getWeekDateRange(item._id.year, item._id.week);
      const startDateStr = formatDate(weekStart);
      const endDateStr = formatDate(weekEnd);

      return {
        year: item._id.year,
        week: item._id.week,
        label: `${startDateStr} - ${endDateStr}`,
        totalIncome: item.totalIncome,
        totalExpense: item.totalExpense,
        balance: item.totalIncome - item.totalExpense,
        count: item.count,
      };
    });

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo tuần thành công",
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Set thời gian cuối ngày để lấy hết dữ liệu trong ngày cuối
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const matchQuery = {
      userId: userIdObj,
      date: {
        $gte: startDateObj,
        $lte: endDateObj,
      },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

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

    const result = stats.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      label: `Tháng ${item._id.month}/${item._id.year}`,
      totalIncome: item.totalIncome,
      totalExpense: item.totalExpense,
      balance: item.totalIncome - item.totalExpense,
      count: item.count,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo tháng thành công",
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Set thời gian cuối ngày để lấy hết dữ liệu trong ngày cuối
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const matchQuery = {
      userId: userIdObj,
      date: {
        $gte: startDateObj,
        $lte: endDateObj,
      },
    };

    if (type && type !== "all") matchQuery.type = type;
    if (walletId && walletId !== "all") matchQuery.walletId = new mongoose.Types.ObjectId(walletId);
    if (categoryId && categoryId !== "all") matchQuery.categoryId = new mongoose.Types.ObjectId(categoryId);

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

    const result = stats.map((item) => ({
      year: item._id,
      label: `Năm ${item._id}`,
      totalIncome: item.totalIncome,
      totalExpense: item.totalExpense,
      balance: item.totalIncome - item.totalExpense,
      count: item.count,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy báo cáo theo năm thành công",
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
 * C.1 - Tổng chi theo từng danh mục
 */
const getCategoryExpenseReport = async (userId, options = {}) => {
  try {
    const { startDate, endDate, limit } = options;

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const matchQuery = {
      userId: userIdObj,
      type: "expense",
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        matchQuery.date.$gte = startDateObj;
      }
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Build date filter cho transaction lookup
    const transactionDateFilter = {};
    if (startDate) {
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      transactionDateFilter.$gte = startDateObj;
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      transactionDateFilter.$lte = endDateTime;
    }

    // Build match query cho transaction lookup trong $lookup pipeline
    // Sử dụng $expr cho các field cần so sánh với biến từ let
    const lookupMatchConditions = [
      { $eq: ["$walletId", "$$walletId"] },
      { $eq: ["$userId", userIdObj] },
      { $in: ["$type", ["expense", "income"]] },
      // Filter transaction đã bị xóa (soft delete)
      { $ne: ["$deleted", true] },
    ];

    // Thêm date filter vào $expr nếu có
    if (transactionDateFilter.$gte) {
      lookupMatchConditions.push({ $gte: ["$date", transactionDateFilter.$gte] });
    }
    if (transactionDateFilter.$lte) {
      lookupMatchConditions.push({ $lte: ["$date", transactionDateFilter.$lte] });
    }

    const lookupMatchQuery = {
      $expr: {
        $and: lookupMatchConditions,
      },
    };

    // Bắt đầu từ wallets collection để bao gồm tất cả ví
    // Lưu ý: mongoose-delete plugin với overrideMethods: "all" không tự động filter trong aggregate()
    // Nên cần filter thủ công: deleted phải là null, false, hoặc không tồn tại
    const stats = await Wallet.aggregate([
      // Lấy tất cả ví của user (không bị xóa và không bị archive)
      {
        $match: {
          userId: userIdObj,
          $or: [
            { deleted: { $exists: false } },
            { deleted: false },
            { deleted: null },
          ],
          is_archived: { $ne: true }, // Không lấy ví đã archive
        },
      },
      // Left join với transactions để lấy thống kê
      {
        $lookup: {
          from: "transactions",
          let: { walletId: "$_id" },
          pipeline: [
            {
              $match: lookupMatchQuery,
            },
            {
              $group: {
                _id: null,
                totalIncome: {
                  $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
                },
                totalExpense: {
                  $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
                },
                count: { $sum: 1 },
              },
            },
          ],
          as: "transactionStats",
        },
      },
      // Unwind transaction stats (có thể rỗng nếu không có transaction)
      {
        $unwind: {
          path: "$transactionStats",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Project kết quả
      {
        $project: {
          walletId: "$_id",
          walletName: "$name",
          walletType: "$type",
          totalIncome: {
            $ifNull: ["$transactionStats.totalIncome", 0],
          },
          totalExpense: {
            $ifNull: ["$transactionStats.totalExpense", 0],
          },
          balance: {
            $subtract: [
              { $ifNull: ["$transactionStats.totalIncome", 0] },
              { $ifNull: ["$transactionStats.totalExpense", 0] },
            ],
          },
          count: {
            $ifNull: ["$transactionStats.count", 0],
          },
        },
      },
      // Sort theo totalExpense giảm dần
      { $sort: { totalExpense: -1 } },
    ]);

    // Kiểm tra tổng số ví của user (để debug)
    // Sử dụng withDeleted() để đếm cả ví đã xóa (nếu cần)
    const totalWallets = await Wallet.countDocuments({
      userId: userIdObj,
      deleted: { $ne: true },
    });
    const activeWallets = await Wallet.countDocuments({
      userId: userIdObj,
      deleted: { $ne: true },
      is_archived: { $ne: true },
    });
    const archivedWallets = await Wallet.countDocuments({
      userId: userIdObj,
      deleted: { $ne: true },
      is_archived: true,
    });

    // Log chi tiết từng ví để debug
    const allWallets = await Wallet.find({
      userId: userIdObj,
      deleted: { $ne: true },
    }).lean();

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

    const totalExpense = result.data.reduce((sum, item) => sum + (item.totalExpense || 0), 0);
    const totalIncome = result.data.reduce((sum, item) => sum + (item.totalIncome || 0), 0);

    const distribution = result.data.map((item) => ({
      walletId: item.walletId,
      walletName: item.walletName,
      walletType: item.walletType,
      totalIncome: item.totalIncome || 0,
      totalExpense: item.totalExpense || 0,
      balance: item.balance || 0,
      count: item.count || 0,
      percentage: totalExpense > 0 ? ((item.totalExpense || 0) / totalExpense) * 100 : 0,
    }));

    return {
      status: true,
      error: 0,
      message: "Lấy phân bổ chi tiêu theo ví thành công",
      data: {
        distribution,
        totalExpense,
        totalIncome,
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

    // Đảm bảo userId là ObjectId
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Set thời gian đầu ngày và cuối ngày
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);

    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const matchQuery = {
      userId: userIdObj,
      type: "expense",
      date: {
        $gte: startDateObj,
        $lte: endDateObj,
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

