// services/savingGoalService.js
const SavingGoal = require("../models/savingGoal");
const Wallet = require("../models/wallet");

const createSavingGoal = async (userId, data) => {
    try {
        if (!data || !userId) {
            return {
                status: false,
                error: 1,
                message: "Invalid data",
                data: null,
            };
        }

        const {
            name,
            walletId,
            target_amount,
            current_amount = 0,
            target_date,
            description,
        } = data;

        if (!name || !walletId || !target_amount) {
            return {
                status: false,
                error: 1,
                message: "Missing required fields",
                data: null,
            };
        }

        // Validate wallet
        const wallet = await Wallet.findOne({ _id: walletId, userId });
        if (!wallet) {
            return {
                status: false,
                error: 1,
                message: "Wallet not found",
                data: null,
            };
        }

        if (Number(current_amount) > Number(target_amount)) {
            return {
                status: false,
                error: 1,
                message: "Current amount cannot exceed target amount",
                data: null,
            };
        }

        const savingGoal = await SavingGoal.create({
            userId,
            name,
            wallet: walletId,
            target_amount: Number(target_amount),
            current_amount: Number(current_amount),
            target_date: target_date ? new Date(target_date) : null,
            description: description || "",
            is_active: true,
        });

        return {
            status: true,
            error: 0,
            message: "Saving goal created successfully",
            data: savingGoal,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

const getAllSavingGoals = async (userId, options = {}) => {
    try {
        const { is_active } = options;
        const query = { userId };

        if (is_active !== undefined) {
            query.is_active = is_active === "true" || is_active === true;
        }

        const savingGoals = await SavingGoal.find(query)
            .populate("wallet", "name type balance")
            .sort({ createdAt: -1 });

        return {
            status: true,
            error: 0,
            message: "Get saving goals successfully",
            data: savingGoals,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

const getSavingGoalById = async (userId, id) => {
    try {
        const savingGoal = await SavingGoal.findOne({ _id: id, userId })
            .populate("wallet", "name type balance");

        if (!savingGoal) {
            return {
                status: false,
                error: 1,
                message: "Saving goal not found",
                data: null,
            };
        }

        return {
            status: true,
            error: 0,
            message: "Get saving goal successfully",
            data: savingGoal,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

const updateSavingGoal = async (userId, id, data) => {
    try {
        const savingGoal = await SavingGoal.findOne({ _id: id, userId });

        if (!savingGoal) {
            return {
                status: false,
                error: 1,
                message: "Saving goal not found",
                data: null,
            };
        }

        // Validate wallet if provided
        if (data.walletId) {
            const wallet = await Wallet.findOne({ _id: data.walletId, userId });
            if (!wallet) {
                return {
                    status: false,
                    error: 1,
                    message: "Wallet not found",
                    data: null,
                };
            }
            savingGoal.wallet = data.walletId;
        }

        // Update other fields
        if (data.name) savingGoal.name = data.name;
        if (data.target_amount !== undefined) {
            savingGoal.target_amount = Number(data.target_amount);
            // Ensure current_amount doesn't exceed new target
            if (savingGoal.current_amount > savingGoal.target_amount) {
                savingGoal.current_amount = savingGoal.target_amount;
            }
        }
        if (data.current_amount !== undefined) {
            const newAmount = Number(data.current_amount);
            if (newAmount > savingGoal.target_amount) {
                return {
                    status: false,
                    error: 1,
                    message: "Current amount cannot exceed target amount",
                    data: null,
                };
            }
            savingGoal.current_amount = newAmount;
        }
        if (data.target_date !== undefined) {
            savingGoal.target_date = data.target_date ? new Date(data.target_date) : null;
        }
        if (data.is_active !== undefined) savingGoal.is_active = data.is_active;
        if (data.description !== undefined) savingGoal.description = data.description;

        await savingGoal.save();

        return {
            status: true,
            error: 0,
            message: "Saving goal updated successfully",
            data: savingGoal,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

const deleteSavingGoal = async (userId, id) => {
    try {
        const savingGoal = await SavingGoal.findOne({ _id: id, userId });

        if (!savingGoal) {
            return {
                status: false,
                error: 1,
                message: "Saving goal not found",
                data: null,
            };
        }

        await savingGoal.delete();

        return {
            status: true,
            error: 0,
            message: "Saving goal deleted successfully",
            data: null,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

const addAmount = async (userId, id, amount) => {
    try {
        const savingGoal = await SavingGoal.findOne({ _id: id, userId });

        if (!savingGoal) {
            return {
                status: false,
                error: 1,
                message: "Saving goal not found",
                data: null,
            };
        }

        const newAmount = savingGoal.current_amount + Number(amount);
        if (newAmount > savingGoal.target_amount) {
            return {
                status: false,
                error: 1,
                message: "Cannot exceed target amount",
                data: null,
            };
        }

        savingGoal.current_amount = newAmount;
        await savingGoal.save();

        return {
            status: true,
            error: 0,
            message: "Amount added successfully",
            data: savingGoal,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

const withdrawAmount = async (userId, id, amount) => {
    try {
        const savingGoal = await SavingGoal.findOne({ _id: id, userId });

        if (!savingGoal) {
            return {
                status: false,
                error: 1,
                message: "Saving goal not found",
                data: null,
            };
        }

        const withdrawAmount = Number(amount);
        if (withdrawAmount > savingGoal.current_amount) {
            return {
                status: false,
                error: 1,
                message: "Cannot withdraw more than current amount",
                data: null,
            };
        }

        savingGoal.current_amount = savingGoal.current_amount - withdrawAmount;
        await savingGoal.save();

        return {
            status: true,
            error: 0,
            message: "Amount withdrawn successfully",
            data: savingGoal,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Server error",
            data: null,
        };
    }
};

module.exports = {
    createSavingGoal,
    getAllSavingGoals,
    getSavingGoalById,
    updateSavingGoal,
    deleteSavingGoal,
    addAmount,
    withdrawAmount,
};



