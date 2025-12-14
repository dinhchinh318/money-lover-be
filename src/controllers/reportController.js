const reportService = require("../services/reportService");

/**
 * Lấy Financial Dashboard - Tổng quan tài chính
 */
const getFinancialDashboardAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await reportService.getFinancialDashboard(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * So sánh tháng hiện tại với tháng trước
 */
const compareCurrentMonthWithPreviousAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await reportService.compareCurrentMonthWithPrevious(userId);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * So sánh tuần hiện tại với tuần trước
 */
const compareCurrentWeekWithPreviousAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await reportService.compareCurrentWeekWithPrevious(userId);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * So sánh năm hiện tại với năm trước
 */
const compareCurrentYearWithPreviousAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await reportService.compareCurrentYearWithPrevious(userId);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * A.3 - Biến động ví
 */
const getWalletChangesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await reportService.getWalletChanges(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * B - Báo cáo theo thời gian
 */
const getTimeBasedReportAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = "day" } = req.query; // day, week, month, year
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      type: req.query.type, // income, expense
      walletId: req.query.walletId,
      categoryId: req.query.categoryId,
    };

    console.log("📥 [getTimeBasedReportAPI] Request received:", {
      userId,
      period,
      options,
      query: req.query,
    });

    let result;
    switch (period) {
      case "day":
        result = await reportService.getTimeBasedReportByDay(userId, options);
        break;
      case "week":
        result = await reportService.getTimeBasedReportByWeek(userId, options);
        break;
      case "month":
        result = await reportService.getTimeBasedReportByMonth(userId, options);
        break;
      case "year":
        result = await reportService.getTimeBasedReportByYear(userId, options);
        break;
      default:
        return res.status(400).json({
          status: false,
          error: 1,
          message: "Period không hợp lệ. Chọn: day, week, month, year",
          data: null,
        });
    }

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [getTimeBasedReportAPI] Error:", error);
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message || "Lỗi server khi lấy báo cáo theo thời gian",
      data: null,
    });
  }
};

/**
 * C.1 - Tổng chi theo từng danh mục
 */
const getCategoryExpenseReportAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
    };

    const result = await reportService.getCategoryExpenseReport(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * C.2 - Top danh mục chi nhiều nhất
 */
const getTopExpenseCategoriesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit || 10,
    };

    const result = await reportService.getTopExpenseCategories(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * C.3 - Top danh mục thu nhiều nhất
 */
const getTopIncomeCategoriesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit || 10,
    };

    const result = await reportService.getTopIncomeCategories(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * C.4 - So sánh mức chi các danh mục giữa các tháng
 */
const compareCategoryExpenseBetweenMonthsAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      months: parseInt(req.query.months) || 6,
      categoryIds: req.query.categoryIds ? req.query.categoryIds.split(",") : null,
    };

    const result = await reportService.compareCategoryExpenseBetweenMonths(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * D.1 - Chi tiêu theo từng ví
 */
const getWalletExpenseReportAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await reportService.getWalletExpenseReport(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * D.2 - Phân bổ chi tiêu theo ví (pie chart)
 */
const getWalletExpenseDistributionAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await reportService.getWalletExpenseDistribution(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

/**
 * D.3 - So sánh chi tiêu các ví theo thời gian
 */
const compareWalletExpenseOverTimeAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      period: req.query.period || "month", // day, week, month, year
      walletIds: req.query.walletIds ? req.query.walletIds.split(",") : null,
    };

    const result = await reportService.compareWalletExpenseOverTime(userId, options);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

module.exports = {
  getFinancialDashboardAPI,
  compareCurrentMonthWithPreviousAPI,
  compareCurrentWeekWithPreviousAPI,
  compareCurrentYearWithPreviousAPI,
  getWalletChangesAPI,
  getTimeBasedReportAPI,
  getCategoryExpenseReportAPI,
  getTopExpenseCategoriesAPI,
  getTopIncomeCategoriesAPI,
  compareCategoryExpenseBetweenMonthsAPI,
  getWalletExpenseReportAPI,
  getWalletExpenseDistributionAPI,
  compareWalletExpenseOverTimeAPI,
};

