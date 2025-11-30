const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete');

const savingGoalSchema = new mongoose.Schema(
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

    // cache giá trị hiện tại — cập nhật khi có transaction liên quan
    current_amount: {
      type: Number,
      default: 0,
      min: 0
    },

    currency: {
      type: String,
      default: "VND"
    },

    target_date: {
      type: Date,
      default: null
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

// Index phổ biến
savingGoalSchema.index({ userId: 1, walletId: 1, is_active: 1 });

savingGoalSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("SavingGoal", savingGoalSchema);
