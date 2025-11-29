const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete');

const walletSchema = new mongoose.Schema(
  {
    user: {
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
    is_archived: {
      type: Boolean,
      default: false,
    }
  },
  {timestamps: true}
);

// Soft delete
walletSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Wallet", walletSchema);