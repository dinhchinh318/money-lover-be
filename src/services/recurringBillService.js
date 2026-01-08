// services/recurringBillService.js
const RecurringBill = require("../models/recurringBill");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const Transaction = require("../models/transaction");

const createRecurringBill = async (userId, data) => {
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
            categoryId,
            amount,
            type,
            frequency,
            cron_rule,
            next_run,
            ends_at,
            active = true,
            auto_create_transaction = true,
            description,
        } = data;

        if (!name || !walletId || !amount || !type || !frequency || !next_run) {
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

        // Validate category if provided
        if (categoryId) {
            const category = await Category.findOne({ _id: categoryId, userId });
            if (!category || category.type !== type) {
                return {
                    status: false,
                    error: 1,
                    message: "Category not found or invalid type",
                    data: null,
                };
            }
        }

        const recurringBill = await RecurringBill.create({
            userId,
            name,
            wallet: walletId,
            category: categoryId || null,
            amount: Number(amount),
            type,
            frequency,
            cron_rule: frequency === "custom" ? cron_rule : null,
            next_run: new Date(next_run),
            ends_at: ends_at ? new Date(ends_at) : null,
            active,
            auto_create_transaction,
            description: description || "",
        });

        return {
            status: true,
            error: 0,
            message: "Recurring bill created successfully",
            data: recurringBill,
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

const getAllRecurringBills = async (userId, options = {}) => {
    try {
        const { active, type } = options;
        const query = { userId };

        if (active !== undefined) {
            query.active = active === "true" || active === true;
        }

        if (type) {
            query.type = type;
        }

        const recurringBills = await RecurringBill.find(query)
            .populate("wallet", "name type balance")
            .populate("category", "name icon type")
            .sort({ createdAt: -1 });

        return {
            status: true,
            error: 0,
            message: "Get recurring bills successfully",
            data: recurringBills,
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

const getRecurringBillById = async (userId, id) => {
    try {
        const recurringBill = await RecurringBill.findOne({ _id: id, userId })
            .populate("wallet", "name type balance")
            .populate("category", "name icon type");

        if (!recurringBill) {
            return {
                status: false,
                error: 1,
                message: "Recurring bill not found",
                data: null,
            };
        }

        return {
            status: true,
            error: 0,
            message: "Get recurring bill successfully",
            data: recurringBill,
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
const calculateNextRun = (bill) => {
    const nextRun = new Date(bill.next_run);

    switch (bill.frequency) {
        case "daily":
            nextRun.setDate(nextRun.getDate() + 1);
            break;
        case "weekly":
            nextRun.setDate(nextRun.getDate() + 7);
            break;
        case "biweekly":
            nextRun.setDate(nextRun.getDate() + 14);
            break;
        case "monthly":
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
        case "yearly":
            nextRun.setFullYear(nextRun.getFullYear() + 1);
            break;
        case "custom":
            // custom → để scheduler xử lý
            break;
    }

    return nextRun;
};

const updateRecurringBill = async (userId, id, data) => {
    try {
        const recurringBill = await RecurringBill.findOne({ _id: id, userId });

        if (!recurringBill) {
            return {
                status: false,
                error: 1,
                message: "Recurring bill not found",
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
            recurringBill.wallet = data.walletId;
        }

        // Validate category if provided
        if (data.categoryId !== undefined) {
            if (data.categoryId) {
                const category = await Category.findOne({ _id: data.categoryId, userId });
                if (!category || category.type !== (data.type || recurringBill.type)) {
                    return {
                        status: false,
                        error: 1,
                        message: "Category not found or invalid type",
                        data: null,
                    };
                }
                recurringBill.category = data.categoryId;
            } else {
                recurringBill.category = null;
            }
        }

        // Update other fields
        if (data.name) recurringBill.name = data.name;
        if (data.amount !== undefined) recurringBill.amount = Number(data.amount);
        if (data.type) recurringBill.type = data.type;
        if (data.frequency) recurringBill.frequency = data.frequency;
        if (data.cron_rule !== undefined) {
            recurringBill.cron_rule = data.frequency === "custom" ? data.cron_rule : null;
        }
        if (data.next_run) recurringBill.next_run = new Date(data.next_run);
        if (data.ends_at !== undefined) {
            recurringBill.ends_at = data.ends_at ? new Date(data.ends_at) : null;
        }
        if (data.active !== undefined) recurringBill.active = data.active;
        if (data.auto_create_transaction !== undefined) {
            recurringBill.auto_create_transaction = data.auto_create_transaction;
        }
        if (data.description !== undefined) recurringBill.description = data.description;

        await recurringBill.save();

        return {
            status: true,
            error: 0,
            message: "Recurring bill updated successfully",
            data: recurringBill,
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

const deleteRecurringBill = async (userId, id) => {
    try {
        const recurringBill = await RecurringBill.findOne({ _id: id, userId });

        if (!recurringBill) {
            return {
                status: false,
                error: 1,
                message: "Recurring bill not found",
                data: null,
            };
        }

        await recurringBill.delete();

        return {
            status: true,
            error: 0,
            message: "Recurring bill deleted successfully",
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

const payRecurringBill = async (userId, id) => {

    try {
        const recurringBill = await RecurringBill.findOne({ _id: id, userId })
            .populate("wallet");

        if (!recurringBill) {
            return {
                status: false,
                error: 1,
                message: "Recurring bill not found",
                data: null,
            };
        }

        if (!recurringBill.active) {
            return {
                status: false,
                error: 1,
                message: "Recurring bill is not active",
                data: null,
            };
        }
        const wallet = recurringBill.wallet;
        if (!wallet) {
            return {
                status: false,
                error: 1,
                message: "Wallet not found",
                data: null,
            };
        }
        const transaction = await Transaction.create({
            userId,
            type: recurringBill.type,
            amount: recurringBill.amount,
            walletId: wallet._id,
            categoryId: recurringBill.category,
            description: recurringBill.name,
            source: "recurring_bill",
            recurring_bill: recurringBill._id,
            createdAt: new Date(),
        });
        if (recurringBill.type === "expense") {
            wallet.balance -= recurringBill.amount;
        } else {
            wallet.balance += recurringBill.amount;
        }
        await wallet.save();

        // 3️⃣ Update next_run
        recurringBill.next_run = calculateNextRun(recurringBill);
        await recurringBill.save();

        return {
            status: true,
            error: 0,
            message: "Pay recurring bill successfully",
            data: transaction,
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
    createRecurringBill,
    getAllRecurringBills,
    getRecurringBillById,
    updateRecurringBill,
    deleteRecurringBill,
    payRecurringBill,
};



