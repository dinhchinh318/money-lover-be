const mongoose = require("mongoose");
const mongooseDelete = require("mongoose-delete");

const analyticsProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    avgDailyExpense: { 
      type: Number, default: 0 
    },
    avgTransactionsPerWeek: { 
      type: Number, default: 0 
    },
    mostActiveSpendingDayOfWeek: {
      type: Number,
      min: 1,
      max: 7,
      validate: {
        validator: Number.isInteger,
        message: "Day of week must be an integer (1–7)"
      }
    },
    mostFrequentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    avgExpenseAmount: { 
      type: Number, default: 0 
    },
    stdDevExpenseAmount: { 
      type: Number, default: 0 
    },
    dailyExpenseTrend: { 
      type: Number, default: 1 
    },
    last30dExpense: { 
      type: Number, default: 0 
    },
    topCategories: [
      {
        category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        amount: { type: Number, default: 0 }
      }
    ],
    volatilityIndex: { 
      type: Number, default: 0 
    },
    firstTransactionDate: { 
      type: Date, default: null 
    },
    lastCalculated: { 
      type: Date, default: Date.now 
    },
  },
  { timestamps: true }
);

analyticsProfileSchema.index({ user: 1 }, { unique: true });

// (Optional) soft delete
analyticsProfileSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("AnalyticsProfile", analyticsProfileSchema);
