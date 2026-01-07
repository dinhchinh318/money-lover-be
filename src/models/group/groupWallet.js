const mongoose = require("mongoose");

const groupWalletSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Types.ObjectId, ref: "Group", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    currency: { type: String, default: "VND" },

    balance: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

groupWalletSchema.index({ groupId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("GroupWallet", groupWalletSchema);
