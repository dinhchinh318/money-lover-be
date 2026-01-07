const analyticsService = require("../services/analyticsService");

// ============================================
// A. DIAGNOSTIC ANALYTICS
// ============================================

/**
 * A.1.1 - Danh mục tăng mạnh bất thường
 */
const getCategorySpendingSpikesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      months: parseInt(req.query.months) || 3,
      thresholdPercent: parseInt(req.query.thresholdPercent) || 50,
    };

    const result = await analyticsService.getCategorySpendingSpikes(userId, options);

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
 * A.1.2 - Tháng phát sinh chi tiêu đột biến
 */
const getMonthlySpendingSpikesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      months: parseInt(req.query.months) || 12,
    };

    const result = await analyticsService.getMonthlySpendingSpikes(userId, options);

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
 * A.1.3 - Biến động theo từng ví
 */
const getWalletVariationsAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      months: parseInt(req.query.months) || 3,
    };

    const result = await analyticsService.getWalletVariations(userId, options);

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
 * A.2.1 - Phát hiện khoản chi quá lớn so với thói quen
 */
const detectUnusualLargeExpensesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      days: parseInt(req.query.days) || 30,
      thresholdMultiplier: parseFloat(req.query.thresholdMultiplier) || 2,
    };

    const result = await analyticsService.detectUnusualLargeExpenses(userId, options);

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
 * A.2.2 - Chi vào thời điểm bất thường
 */
const detectUnusualTimeSpendingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      days: parseInt(req.query.days) || 30,
    };

    const result = await analyticsService.detectUnusualTimeSpending(userId, options);

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
 * A.2.3 - Chi tăng đột biến trong 24 giờ gần nhất
 */
const detect24hSpendingSpikeAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.detect24hSpendingSpike(userId);

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
 * A.3.1 - Ngày trong tuần chi nhiều nhất
 */
const getMostSpendingDayOfWeekAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      weeks: parseInt(req.query.weeks) || 12,
    };

    const result = await analyticsService.getMostSpendingDayOfWeek(userId, options);

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
 * A.3.2 - Danh mục phát sinh nhiều nhất
 */
const getMostFrequentCategoriesAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      days: parseInt(req.query.days) || 30,
      startDate: req.query.startDate ? new Date(req.query.startDate) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate) : null,
    };

    const result = await analyticsService.getMostFrequentCategories(userId, options);

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
 * A.3.3 - Tần suất giao dịch trung bình
 */
const getTransactionFrequencyAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      days: parseInt(req.query.days) || 30,
      startDate: req.query.startDate ? new Date(req.query.startDate) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate) : null,
    };

    const result = await analyticsService.getTransactionFrequency(userId, options);

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

// ============================================
// B. PREDICTIVE ANALYTICS
// ============================================

/**
 * B.1.1 - Dự đoán chi tiêu cuối tháng (7 ngày)
 */
const predictMonthEndExpense7DaysAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.predictMonthEndExpense7Days(userId);

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
 * B.1.2 - Dự đoán chi tiêu cuối tháng (30 ngày)
 */
const predictMonthEndExpense30DaysAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.predictMonthEndExpense30Days(userId);

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
 * B.1.3 - Dự đoán chi tiêu cuối tháng (xu hướng)
 */
const predictMonthEndExpenseTrendAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.predictMonthEndExpenseTrend(userId);

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
 * B.2 - Dự đoán vượt ngân sách
 */
const predictBudgetOverrunAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.predictBudgetOverrun(userId);

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
 * B.3 - Dự đoán chi tiêu theo danh mục
 */
const predictCategorySpendingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      days: parseInt(req.query.days) || 30,
    };

    const result = await analyticsService.predictCategorySpending(userId, options);

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

// ============================================
// C. PRESCRIPTIVE ANALYTICS
// ============================================

/**
 * C.1.1 - Gợi ý tối ưu chi tiêu
 */
const suggestOptimizeSpendingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      days: parseInt(req.query.days) || 30,
      thresholdPercent: parseInt(req.query.thresholdPercent) || 20,
    };

    const result = await analyticsService.suggestOptimizeSpending(userId, options);

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
 * C.1.2 - Đề xuất mức ngân sách phù hợp
 */
const suggestBudgetAdjustmentAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.suggestBudgetAdjustment(userId);

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
 * C.2 - Khuyến nghị chuyển tiền giữa các ví
 */
const suggestWalletTransferAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.suggestWalletTransfer(userId);

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
 * C.3.1 - Tạo cảnh báo thông minh
 */
const createSmartAlertsAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await analyticsService.createSmartAlerts(userId);

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
 * C.3.2 - Lấy lịch sử cảnh báo
 */
const getAlertHistoryAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      isRead: req.query.isRead === "true" ? true : req.query.isRead === "false" ? false : null,
    };

    const result = await analyticsService.getAlertHistory(userId, options);

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
 * C.3.3 - Đánh dấu cảnh báo đã đọc
 */
const markAlertAsReadAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { alertId } = req.params;

    const result = await analyticsService.markAlertAsRead(userId, alertId);

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
  // A. Diagnostic Analytics
  getCategorySpendingSpikesAPI,
  getMonthlySpendingSpikesAPI,
  getWalletVariationsAPI,
  detectUnusualLargeExpensesAPI,
  detectUnusualTimeSpendingAPI,
  detect24hSpendingSpikeAPI,
  getMostSpendingDayOfWeekAPI,
  getMostFrequentCategoriesAPI,
  getTransactionFrequencyAPI,
  // B. Predictive Analytics
  predictMonthEndExpense7DaysAPI,
  predictMonthEndExpense30DaysAPI,
  predictMonthEndExpenseTrendAPI,
  predictBudgetOverrunAPI,
  predictCategorySpendingAPI,
  // C. Prescriptive Analytics
  suggestOptimizeSpendingAPI,
  suggestBudgetAdjustmentAPI,
  suggestWalletTransferAPI,
  createSmartAlertsAPI,
  getAlertHistoryAPI,
  markAlertAsReadAPI,
};


