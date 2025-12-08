const mongoose = require("mongoose");
const mongooseDelete = require("mongoose-delete");

const savingGoalSchema = new mongoose.Schema(
  {
    userId: {
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
    name: {
      type: String,
      required: true,
      trim: true
    },
    target_amount: {
      type: Number,
      required: true,
      min: 0
    },
    current_amount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: function (val) {
          return val <= this.target_amount;
        },
        message: "current_amount cannot exceed target_amount"
      }
    },
    target_date: {
      type: Date,
      default: null,
      validate: {
        validator: (val) => !val || val > new Date(),
        message: "target_date must be in the future"
      }
    },
    is_active: {
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

savingGoalSchema.index({ user: 1, wallet: 1, is_active: 1 });

savingGoalSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("SavingGoal", savingGoalSchema);
