// controllers/recurringBillController.js
const {
    createRecurringBill,
    getAllRecurringBills,
    getRecurringBillById,
    updateRecurringBill,
    deleteRecurringBill,
    payRecurringBill,
} = require("../services/recurringBillService");

const createRecurringBillAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const payload = req.body.data || req.body || {};

        const result = await createRecurringBill(userId, payload);
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

const getAllRecurringBillsAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const options = req.query || {};

        const result = await getAllRecurringBills(userId, options);
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

const getRecurringBillByIdAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const result = await getRecurringBillById(userId, id);
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

const updateRecurringBillAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        const payload = req.body.data || req.body || {};

        const result = await updateRecurringBill(userId, id, payload);
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

const deleteRecurringBillAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const result = await deleteRecurringBill(userId, id);
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

const payRecurringBillAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const result = await payRecurringBill(userId, id);
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
    createRecurringBillAPI,
    getAllRecurringBillsAPI,
    getRecurringBillByIdAPI,
    updateRecurringBillAPI,
    deleteRecurringBillAPI,
    payRecurringBillAPI,
};



