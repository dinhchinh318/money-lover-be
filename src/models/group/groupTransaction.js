const mongoose = require("mongoose");

const splitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const groupTransactionSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Types.ObjectId, ref: "Group", required: true, index: true },

    scope: { type: String, enum: ["group", "personal"], default: "group", index: true },

    type: { type: String, enum: ["income", "expense", "transfer"], required: true, index: true },

    walletId: { type: mongoose.Types.ObjectId, ref: "GroupWallet", default: null, index: true },
    categoryId: { type: mongoose.Types.ObjectId, ref: "GroupCategory", default: null, index: true },

    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },

    fromWalletId: { type: mongoose.Types.ObjectId, ref: "GroupWallet", default: null, index: true },
    toWalletId: { type: mongoose.Types.ObjectId, ref: "GroupWallet", default: null, index: true },

    paidBy: { type: mongoose.Types.ObjectId, ref: "User", default: null, index: true },
    splits: { type: [splitSchema], default: [] },

    occurredAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true, index: true },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

groupTransactionSchema.index({ groupId: 1, occurredAt: -1 });
groupTransactionSchema.index({ groupId: 1, type: 1, occurredAt: -1 });

module.exports = mongoose.model("GroupTransaction", groupTransactionSchema);
