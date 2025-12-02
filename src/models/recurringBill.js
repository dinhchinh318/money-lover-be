const mongoose = require("mongoose");
const mongooseDelete = require("mongoose-delete");

const recurringBillSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      validate: {
        validator: async function (walletId) {
          const wallet = await mongoose.model("Wallet").findById(walletId);
          return wallet && wallet.user.toString() === this.user.toString();
        },
        message: "Wallet không thuộc user"
      }
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      validate: {
        validator: async function (catId) {
          if (!catId) return true;
          const cat = await mongoose.model("Category").findById(catId);
          return (
            cat &&
            ((this.type === "expense" && cat.type === "expense") ||
              (this.type === "income" && cat.type === "income"))
          );
        },
        message: "Category không hợp lệ với type (income/expense)"
      }
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
    type: {
      type: String,
      enum: ["expense", "income"],
      required: true
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly", "yearly", "custom"],
      required: true
    },
    cron_rule: {
      type: String,
      default: null,
      validate: {
        validator: function (val) {
          if (this.frequency === "custom") return !!val;
          return true;
        },
        message: "Custom frequency requires cron_rule"
      }
    },
    next_run: {
      type: Date,
      required: true
    },
    ends_at: {
      type: Date,
      default: null,
      validate: {
        validator: function (val) {
          if (!val) return true;
          return this.next_run <= val;
        },
        message: "ends_at phải lớn hơn hoặc bằng next_run"
      }
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

// Scheduler index
recurringBillSchema.index({ user: 1, active: 1, next_run: 1 });

recurringBillSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("RecurringBill", recurringBillSchema);
