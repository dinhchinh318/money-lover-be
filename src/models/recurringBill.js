const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete');

const recurringBillSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    // expense hoặc income
    type: {
      type: String,
      enum: ["expense", "income"],
      required: true
    },

    currency: {
      type: String,
      default: "VND"
    },

    // tần suất
    frequency: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly", "yearly", "custom"],
      required: true
    },

    // Nếu custom: cron hoặc rrule (string)
    cron_rule: {
      type: String,
      default: null
    },

    // Thời điểm scheduler sẽ chạy tiếp
    next_run: {
      type: Date,
      required: true
    },

    // Khi recurring kết thúc
    ends_at: {
      type: Date,
      default: null
    },

    active: {
      type: Boolean,
      default: true
    },

    auto_create_transaction: {
      type: Boolean,
      default: true
    },

    description: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Index dùng cho scheduler: active bills ordered by next_run
recurringBillSchema.index({ userId: 1, active: 1, next_run: 1 });

recurringBillSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("RecurringBill", recurringBillSchema);
