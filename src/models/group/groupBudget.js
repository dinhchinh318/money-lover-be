const mongoose = require("mongoose");

const groupBudgetSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Types.ObjectId, ref: "Group", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },

    period: { type: String, enum: ["monthly", "weekly", "custom"], default: "monthly" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },

    scope: { type: String, enum: ["total", "category", "wallet"], default: "total", index: true },
    categoryId: { type: mongoose.Types.ObjectId, ref: "GroupCategory", default: null, index: true },
    walletId: { type: mongoose.Types.ObjectId, ref: "GroupWallet", default: null, index: true },

    limitAmount: { type: Number, required: true, min: 0 },

    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

groupBudgetSchema.index({ groupId: 1, startDate: 1, endDate: 1, scope: 1, categoryId: 1, walletId: 1 });

module.exports = mongoose.model("GroupBudget", groupBudgetSchema);
