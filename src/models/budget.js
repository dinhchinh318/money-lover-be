const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete');

const budgetSchema = new mongoose.Schema(
  {
    userId: { // chủ sở hữu budget (đồng nhất với Transaction.userId)
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      trim: true,
      default: ""
    },

    // budget áp dụng cho category này
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    // NULL => áp dụng cho tất cả ví của user
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
    },

    // giới hạn chi tiêu (luôn >= 0)
    limit_amount: {
      type: Number,
      required: true,
      min: 0
    },
    // period window để tính (monthly/weekly/yearly/custom)
    period: {
      type: String,
      enum: ["monthly", "weekly", "yearly", "custom"],
      default: "monthly"
    },
    // phạm vi của budget (nếu custom hoặc dùng làm range)
    start_date: {
      type: Date,
      required: true
    },
    end_date: {
      type: Date,
      default: null
    },

    description: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Index giúp query nhanh theo user và category / time window
budgetSchema.index({ userId: 1, categoryId: 1, start_date: -1 });

budgetSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("Budget", budgetSchema);
