const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

const transactionSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, ref: "User", required: true 
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: function () {
        return this.type === "income" || this.type === "expense";
      },
    },
    amount: { 
      type: Number, required: true, min: 1 
    },
    type: {
      type: String,
      enum: ["income", "expense", "debt", "loan", "transfer", "adjust"],
      required: true,
    },
    toWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      validate: {
        validator: function (v) {
          if (this.type !== "transfer") return true;
          return v != null;
        },
        message: "Transfer phải có ví đích",
      },
    },
    counterpartyName: String,
    counterpartyContact: String,
    dueDate: Date,
    isSettled: {
      type: Boolean, default: false 
    },
    adjustReason: {
      type: String,
      validate: {
        validator: function (v) {
          if (this.type !== "adjust") return true;
          return v != null && v.length > 0;
        },
        message: "Adjust cần lý do",
      },
    },
    date: { 
      type: Date, default: Date.now 
    },
    note: { 
      type: String, default: "" 
    },
    imageUrl: { 
      type: String, default: "" 
    },
    isRecurring: { 
      type: Boolean, default: false 
    },
    recurringType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      default: null,
    },
  },
  { timestamps: true }
);

// Không cho ví chuyển sang chính nó
transactionSchema.pre("save", function (next) {
  if (this.type === "transfer" && this.walletId.equals(this.toWalletId)) {
    return next(new Error("Không thể chuyển trong cùng 1 ví"));
  }
  next();
});

transactionSchema.plugin(mongoose_delete, { 
  deletedAt: true,
  overrideMethods: "all" 
});

module.exports = mongoose.model("Transaction", transactionSchema);
