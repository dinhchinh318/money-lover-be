const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete');

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["cash", "bank"],
      default: "cash",
    },
    currency: {
      type: String,
      default: "VND",
    },
    balance: {
      type: Number,
      default: 0,
    },
    // Optional info for bank
    bankName: String,
    bankAccount: String,
    bankCode: String,
    is_default: {
      type: Boolean,
      default: false,
    },
    is_archived: {
      type: Boolean,
      default: false,
    }
  },
  {timestamps: true}
);

// Không cho trùng tên ví trong cùng 1 user
walletSchema.index({ user: 1, name: 1 }, { unique: true });

// Soft delete
walletSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Wallet", walletSchema);