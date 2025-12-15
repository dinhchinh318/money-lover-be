// controllers/budgetController.js
const {
  createBudget,
  getAllBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
} = require("../services/budgetService");

const createBudgetAPI = async (req, res) => {
  try {
    const userId = req.user._id;     // FIXED: must use _id
    const payload = req.body.data || req.body || {};

    const result = await createBudget(userId, payload);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    });
  }
};

const getAllBudgetsAPI = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await getAllBudgets(userId);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    });
  }
};

const getBudgetByIdAPI = async (req, res) => {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const result = await getBudgetById(id, userId);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    });
  }
};

const updateBudgetAPI = async (req, res) => {
  try {
    const userId = req.user._id;
    const id = req.params.id;
    const payload = req.body.data || req.body || {};

    const result = await updateBudget(id, userId, payload);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    });
  }
};

const deleteBudgetAPI = async (req, res) => {
  try {
    const userId = req.user._id;
    const id = req.params.id;

    const result = await deleteBudget(id, userId);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: err.message || "Server error",
      data: null,
    });
  }
};

module.exports = {
  createBudgetAPI,
  getAllBudgetsAPI,
  getBudgetByIdAPI,
  updateBudgetAPI,
  deleteBudgetAPI,
};
