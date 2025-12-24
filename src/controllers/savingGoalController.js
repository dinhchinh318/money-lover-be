// controllers/savingGoalController.js
const {
    createSavingGoal,
    getAllSavingGoals,
    getSavingGoalById,
    updateSavingGoal,
    deleteSavingGoal,
    addAmount,
    withdrawAmount,
} = require("../services/savingGoalService");

const createSavingGoalAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const payload = req.body.data || req.body || {};

        const result = await createSavingGoal(userId, payload);
        return res.status(result.status ? 200 : 400).json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: -1,
            message: err.message || "Server error",
            data: null,
        });
    }
};

const getAllSavingGoalsAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const options = req.query || {};

        const result = await getAllSavingGoals(userId, options);
        return res.status(result.status ? 200 : 400).json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: -1,
            message: err.message || "Server error",
            data: null,
        });
    }
};

const getSavingGoalByIdAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const result = await getSavingGoalById(userId, id);
        return res.status(result.status ? 200 : 404).json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: -1,
            message: err.message || "Server error",
            data: null,
        });
    }
};

const updateSavingGoalAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        const payload = req.body.data || req.body || {};

        const result = await updateSavingGoal(userId, id, payload);
        return res.status(result.status ? 200 : 400).json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: -1,
            message: err.message || "Server error",
            data: null,
        });
    }
};

const deleteSavingGoalAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const result = await deleteSavingGoal(userId, id);
        return res.status(result.status ? 200 : 404).json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: -1,
            message: err.message || "Server error",
            data: null,
        });
    }
};

const addAmountAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({
                status: false,
                error: 1,
                message: "Invalid amount",
                data: null,
            });
        }

        const result = await addAmount(userId, id, amount);
        return res.status(result.status ? 200 : 400).json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: -1,
            message: err.message || "Server error",
            data: null,
        });
    }
};

const withdrawAmountAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({
                status: false,
                error: 1,
                message: "Invalid amount",
                data: null,
            });
        }

        const result = await withdrawAmount(userId, id, amount);
        return res.status(result.status ? 200 : 400).json(result);
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
    createSavingGoalAPI,
    getAllSavingGoalsAPI,
    getSavingGoalByIdAPI,
    updateSavingGoalAPI,
    deleteSavingGoalAPI,
    addAmountAPI,
    withdrawAmountAPI,
};


