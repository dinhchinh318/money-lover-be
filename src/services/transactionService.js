const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const mongoose = require("mongoose");

/**
 * Helper: Cập nhật balance của wallet
 */
const updateWalletBalance = async (walletId, toWalletId, amount, type, session) => {
  switch (type) {
    case "income":
    case "loan":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: amount } },
        { session }
      );
      break;

    case "expense":
    case "debt":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: -amount } },
        { session }
      );
      break;

    case "transfer":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: -amount } },
        { session }
      );
      await Wallet.findByIdAndUpdate(
        toWalletId,
        { $inc: { balance: amount } },
        { session }
      );
      break;

    case "adjust":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: amount } },
        { session }
      );
      break;
  }
};

/**
 * Helper: Hoàn nguyên balance của wallet
 */
const revertWalletBalance = async (walletId, toWalletId, amount, type, session) => {
  switch (type) {
    case "income":
    case "loan":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: -amount } },
        { session }
      );
      break;

    case "expense":
    case "debt":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: amount } },
        { session }
      );
      break;

    case "transfer":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: amount } },
        { session }
      );
      await Wallet.findByIdAndUpdate(
        toWalletId,
        { $inc: { balance: -amount } },
        { session }
      );
      break;

    case "adjust":
      await Wallet.findByIdAndUpdate(
        walletId,
        { $inc: { balance: -amount } },
        { session }
      );
      break;
  }
};

/**
 * Tạo transaction mới
 */
// const createTransaction = async (userId, data) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       walletId,
//       categoryId,
//       amount,
//       type,
//       toWalletId,
//       counterpartyName,
//       counterpartyContact,
//       dueDate,
//       adjustReason,
//       date,
//       note,
//       imageUrl,
//       isRecurring,
//       recurringType,
//     } = data;

//     // Kiểm tra wallet có tồn tại và thuộc về user
//     const wallet = await Wallet.findOne({ _id: walletId, userId });
//     if (!wallet) {
//       await session.abortTransaction();
//       return {
//         status: false,
//         error: 1,
//         message: "Wallet not found or does not belong to you",
//         data: null,
//       };
//     }

//     // Kiểm tra category nếu cần
//     if (categoryId) {
//       const category = await Category.findOne({ _id: categoryId, userId });
//       if (!category) {
//         await session.abortTransaction();
//         return {
//           status: false,
//           error: 1,
//           message: "Category not found or does not belong to you",
//           data: null,
//         };
//       }
//       if (type === "income" && category.type !== "income") {
//         await session.abortTransaction();
//         return {
//           status: false,
//           error: 1,
//           message: "Category must be income type",
//           data: null,
//         };
//       }
//       if (type === "expense" && category.type !== "expense") {
//         await session.abortTransaction();
//         return {
//           status: false,
//           error: 1,
//           message: "Category must be expense type",
//           data: null,
//         };
//       }
//     }

//     // Kiểm tra toWallet nếu là transfer
//     if (type === "transfer") {
//       const toWallet = await Wallet.findOne({ _id: toWalletId, userId });
//       if (!toWallet) {
//         await session.abortTransaction();
//         return {
//           status: false,
//           error: 1,
//           message: "Destination wallet not found or does not belong to you",
//           data: null,
//         };
//       }
//     }

//     // Tạo transaction
//     const transaction = new Transaction({
//       userId,
//       walletId,
//       categoryId,
//       amount,
//       type,
//       toWalletId,
//       counterpartyName,
//       counterpartyContact,
//       dueDate,
//       adjustReason,
//       date: date || new Date(),
//       note,
//       imageUrl,
//       isRecurring,
//       recurringType,
//     });

//     await transaction.save({ session });

//     // Cập nhật balance của wallet
//     await updateWalletBalance(walletId, toWalletId, amount, type, session);

//     await session.commitTransaction();

//     const result = await Transaction.findById(transaction._id)
//       .populate("walletId", "name type balance")
//       .populate("categoryId", "name type icon")
//       .populate("toWalletId", "name type balance");

//     return {
//       status: true,
//       error: 0,
//       message: "Created successfully",
//       data: result.toObject(),
//     };
//   } catch (error) {
//     await session.abortTransaction();
//     return {
//       status: false,
//       error: -1,
//       message: error.message,
//       data: null,
//     };
//   } finally {
//     session.endSession();
//   }
// };
const createTransaction = async (userId, data) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const {
        walletId, categoryId, amount, type, toWalletId,
        counterpartyName, counterpartyContact, dueDate,
        adjustReason, date, note, imageUrl, isRecurring, recurringType
      } = data;

      const wallet = await Wallet.findOne({ _id: walletId, userId }).session(session);
      if (!wallet) throw new Error("Wallet not found or does not belong to you");

      let category;
      if (categoryId) {
        category = await Category.findOne({ _id: categoryId, userId }).session(session);
        if (!category) throw new Error("Category not found or does not belong to you");
        if ((type === "income" && category.type !== "income") ||
          (type === "expense" && category.type !== "expense"))
          throw new Error("Category type mismatch");
      }

      let toWallet;
      if (type === "transfer") {
        toWallet = await Wallet.findOne({ _id: toWalletId, userId }).session(session);
        if (!toWallet) throw new Error("Destination wallet not found or does not belong to you");
      }

      const transaction = new Transaction({
        userId, walletId, categoryId, amount, type, toWalletId,
        counterpartyName, counterpartyContact, dueDate, adjustReason,
        date: date || new Date(), note, imageUrl, isRecurring, recurringType
      });
      await transaction.save({ session });

      await updateWalletBalance(walletId, toWalletId, amount, type, session);

      result = await Transaction.findById(transaction._id)
        .populate("walletId", "name type balance")
        .populate("categoryId", "name type icon")
        .populate("toWalletId", "name type balance")
        .session(session);
    });

    return {
      status: true,
      error: 0,
      message: "Created successfully",
      data: result.toObject(),
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  } finally {
    session.endSession();
  }
};


/**
 * Cập nhật transaction
 */
const updateTransaction = async (userId, transactionId, data) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId,
    });

    if (!transaction) {
      await session.abortTransaction();
      return {
        status: false,
        error: 1,
        message: "Transaction not found",
        data: null,
      };
    }

    const oldAmount = transaction.amount;
    const oldType = transaction.type;
    const oldWalletId = transaction.walletId;
    const oldToWalletId = transaction.toWalletId;

    // Hoàn nguyên balance cũ
    await revertWalletBalance(
      oldWalletId,
      oldToWalletId,
      oldAmount,
      oldType,
      session
    );

    // Cập nhật transaction
    Object.assign(transaction, data);
    await transaction.save({ session });

    // Cập nhật balance mới
    await updateWalletBalance(
      transaction.walletId,
      transaction.toWalletId,
      transaction.amount,
      transaction.type,
      session
    );

    await session.commitTransaction();

    const result = await Transaction.findById(transaction._id)
      .populate("walletId", "name type balance")
      .populate("categoryId", "name type icon")
      .populate("toWalletId", "name type balance");

    return {
      status: true,
      error: 0,
      message: "Updated successfully",
      data: result.toObject(),
    };
  } catch (error) {
    await session.abortTransaction();
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  } finally {
    session.endSession();
  }
};

/**
 * Xóa transaction (soft delete)
 */
const deleteTransaction = async (userId, transactionId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId,
    });

    if (!transaction) {
      await session.abortTransaction();
      return {
        status: false,
        error: 1,
        message: "Transaction not found",
        data: null,
      };
    }

    // Hoàn nguyên balance
    await revertWalletBalance(
      transaction.walletId,
      transaction.toWalletId,
      transaction.amount,
      transaction.type,
      session
    );

    await transaction.delete({ session });

    await session.commitTransaction();
    return {
      status: true,
      error: 0,
      message: "Deleted successfully",
      data: null,
    };
  } catch (error) {
    await session.abortTransaction();
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  } finally {
    session.endSession();
  }
};

/**
 * Khôi phục transaction đã xóa
 */
const restoreTransaction = async (userId, transactionId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findOneDeleted({
      _id: transactionId,
      userId,
    });

    if (!transaction) {
      await session.abortTransaction();
      return {
        status: false,
        error: 1,
        message: "Transaction not found or not deleted",
        data: null,
      };
    }

    await transaction.restore({ session });

    // Cập nhật lại balance
    await updateWalletBalance(
      transaction.walletId,
      transaction.toWalletId,
      transaction.amount,
      transaction.type,
      session
    );

    await session.commitTransaction();

    return {
      status: true,
      error: 0,
      message: "Restored successfully",
      data: transaction.toObject(),
    };
  } catch (error) {
    await session.abortTransaction();
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  } finally {
    session.endSession();
  }
};

/**
 * Lấy danh sách transaction với filter và pagination
 */
const getAllTransactions = async (userId, options = {}) => {
  try {
    const {
      walletId,
      categoryId,
      type,
      startDate,
      endDate,
      isRecurring,
      isSettled,
      page = 1,
      limit = 20,
      sortBy = "-date",
    } = options;

    const query = { userId };

    if (walletId) query.walletId = walletId;
    if (categoryId) query.categoryId = categoryId;
    if (type) query.type = type;
    if (isRecurring !== undefined) query.isRecurring = isRecurring;
    if (isSettled !== undefined) query.isSettled = isSettled;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("walletId", "name type balance")
        .populate("categoryId", "name type icon")
        .populate("toWalletId", "name type balance")
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    return {
      status: true,
      error: 0,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
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
 * Lấy chi tiết transaction
 */
const getTransactionById = async (userId, transactionId) => {
  try {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId,
    })
      .populate("walletId", "name type balance")
      .populate("categoryId", "name type icon")
      .populate("toWalletId", "name type balance")
      .lean();

    if (!transaction) {
      return {
        status: false,
        error: 1,
        message: "Transaction not found",
        data: null,
      };
    }

    return {
      status: true,
      error: 0,
      data: transaction,
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
 * Đánh dấu debt/loan đã thanh toán
 */
const settleDebtLoan = async (userId, transactionId) => {
  try {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId,
    });

    if (!transaction) {
      return {
        status: false,
        error: 1,
        message: "Transaction not found",
        data: null,
      };
    }

    if (!["debt", "loan"].includes(transaction.type)) {
      return {
        status: false,
        error: 1,
        message: "Only applicable for debt or loan",
        data: null,
      };
    }

    transaction.isSettled = true;
    await transaction.save();

    return {
      status: true,
      error: 0,
      message: "Settled successfully",
      data: transaction.toObject(),
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
 * Thống kê theo category
 */
const getStatsByCategory = async (userId, options = {}) => {
  try {
    const { startDate, endDate, type } = options;

    const matchQuery = { userId };
    if (type) matchQuery.type = type;
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
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
          categoryType: "$category.type",
          totalAmount: 1,
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return {
      status: true,
      error: 0,
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
 * Thống kê tổng quan theo thời gian
 */
const getOverviewStats = async (userId, options = {}) => {
  try {
    const { startDate, endDate } = options;

    // Đảm bảo userId là ObjectId
    const mongoose = require("mongoose");
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const matchQuery = { userId: userIdObj };
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        matchQuery.date.$gte = startDateObj;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        matchQuery.date.$lte = endDateObj;
      }
    }

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

    // Đếm tổng số giao dịch
    const transactionCount = await Transaction.countDocuments(matchQuery);

    const result = {
      totalIncome: 0,
      totalExpense: 0,
      debt: 0,
      loan: 0,
      transfer: 0,
      adjust: 0,
      transactionCount: transactionCount,
    };

    stats.forEach((stat) => {
      if (stat._id === "income") {
        result.totalIncome = stat.totalAmount;
      } else if (stat._id === "expense") {
        result.totalExpense = stat.totalAmount;
      } else {
        result[stat._id] = stat.totalAmount;
      }
    });

    result.balance = result.totalIncome - result.totalExpense;

    // Tính tổng số dư tất cả ví của user (chỉ tính ví chưa bị archive)
    const wallets = await Wallet.find({
      userId: userIdObj,
      is_archived: false,
    }).lean();

    const totalWalletBalance = wallets.reduce((sum, wallet) => {
      return sum + (wallet.balance || 0);
    }, 0);

    result.totalWalletBalance = totalWalletBalance;

    return {
      status: true,
      error: 0,
      message: "Get overview stats successfully",
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

module.exports = {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getAllTransactions,
  getTransactionById,
  settleDebtLoan,
  getStatsByCategory,
  getOverviewStats,
};