const transactionService = require("../services/transactionService");

/**
 * Tạo transaction mới
 */
const createTransactionAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await transactionService.createTransaction(userId, req.body);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }

    return res.status(201).json(result);
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
 * Cập nhật transaction
 */
const updateTransactionAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await transactionService.updateTransaction(userId, id, req.body);

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
 * Xóa transaction
 */
const deleteTransactionAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await transactionService.deleteTransaction(userId, id);

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
 * Khôi phục transaction đã xóa
 */
const restoreTransactionAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await transactionService.restoreTransaction(userId, id);

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
 * Lấy danh sách transaction với filter
 */
const getAllTransactionsAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      walletId: req.query.walletId,
      categoryId: req.query.categoryId,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      isRecurring: req.query.isRecurring === "true",
      isSettled: req.query.isSettled === "true",
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "-date",
    };

    const result = await transactionService.getAllTransactions(userId, options);

    if (!result.status) {
      return res.status(500).json(result);
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
 * Lấy chi tiết transaction
 */
const getTransactionByIdAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await transactionService.getTransactionById(userId, id);

    if (!result.status) {
      return res.status(result.error === 1 ? 404 : 500).json(result);
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
 * Đánh dấu debt/loan đã thanh toán
 */
const settleDebtLoanAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await transactionService.settleDebtLoan(userId, id);

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
 * Thống kê theo category
 */
const getStatsByCategoryAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      type: req.query.type,
    };

    const result = await transactionService.getStatsByCategory(userId, options);

    if (!result.status) {
      return res.status(500).json(result);
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
 * Thống kê tổng quan
 */
const getOverviewStatsAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await transactionService.getOverviewStats(userId, options);

    if (!result.status) {
      return res.status(500).json(result);
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
  createTransactionAPI,
  updateTransactionAPI,
  deleteTransactionAPI,
  restoreTransactionAPI,
  getAllTransactionsAPI,
  getTransactionByIdAPI,
  settleDebtLoanAPI,
  getStatsByCategoryAPI,
  getOverviewStatsAPI,
};