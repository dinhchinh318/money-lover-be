// const mongoose = require("mongoose");
// const mongoose_delete = require("mongoose-delete");

// const transactionSchema = new mongoose.Schema(
//   {
//     userId: { 
//       type: mongoose.Schema.Types.ObjectId, ref: "User", required: true 
//     },
//     walletId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Wallet",
//       required: true
//     },
//     categoryId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Category",
//       required: function () {
//         return this.type === "income" || this.type === "expense";
//       },
//     },
//     amount: { 
//       type: Number, required: true, min: 1 
//     },
//     type: {
//       type: String,
//       enum: ["income", "expense", "debt", "loan", "transfer", "adjust"],
//       required: true,
//     },
//     toWalletId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Wallet",
//       validate: {
//         validator: function (v) {
//           if (this.type !== "transfer") return true;
//           return v != null;
//         },
//         message: "Transfer phải có ví đích",
//       },
//     },
//     counterpartyName: String,
//     counterpartyContact: String,
//     dueDate: Date,
//     isSettled: {
//       type: Boolean, default: false 
//     },
//     adjustReason: {
//       type: String,
//       validate: {
//         validator: function (v) {
//           if (this.type !== "adjust") return true;
//           return v != null && v.length > 0;
//         },
//         message: "Adjust cần lý do",
//       },
//     },
//     date: { 
//       type: Date, default: Date.now 
//     },
//     note: { 
//       type: String, default: "" 
//     },
//     imageUrl: { 
//       type: String, default: "" 
//     },
//     isRecurring: { 
//       type: Boolean, default: false 
//     },
//     recurringType: {
//       type: String,
//       enum: ["daily", "weekly", "monthly", "yearly"],
//       default: null,
//     },
//   },
//   { timestamps: true }
// );

// // Không cho ví chuyển sang chính nó
// transactionSchema.pre("save", function (next) {
//   if (this.type === "transfer" && this.walletId.equals(this.toWalletId)) {
//     return next(new Error("Không thể chuyển trong cùng 1 ví"));
//   }
//   next();
// });

// transactionSchema.plugin(mongoose_delete, { 
//   deletedAt: true,
//   overrideMethods: "all" 
// });

// module.exports = mongoose.model("Transaction", transactionSchema);
const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },

    // Chỉ bắt buộc cho income/expense (giữ đúng như bạn)
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: function () {
        return this.type === "income" || this.type === "expense";
      },
    },

    // Amount chỉ bắt buộc khi KHÔNG phải adjust
    amount: {
      type: Number,
      default: 0,
      required: function () {
        return this.type !== "adjust";
      },
      validate: {
        validator: function (v) {
          // adjust: cho phép 0 (hoặc null/undefined)
          if (this.type === "adjust") return v === 0 || v == null;

          // các type khác: bắt buộc >= 1
          return typeof v === "number" && v >= 1;
        },
        message: "Amount phải >= 1 (trừ adjust)",
      },
    },

    type: {
      type: String,
      enum: ["income", "expense", "debt", "loan", "transfer", "adjust"],
      required: true,
      index: true,
    },

    // Transfer
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

    // Debt/Loan metadata
    counterpartyName: { type: String, default: "" },
    counterpartyContact: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    isSettled: { type: Boolean, default: false },

    // Adjust metadata
    adjustReason: {
      type: String,
      validate: {
        validator: function (v) {
          if (this.type !== "adjust") return true;
          return v != null && String(v).trim().length > 0;
        },
        message: "Adjust cần lý do",
      },
      default: "",
    },

    // Lưu balance trước/sau để rollback chuẩn
    adjustTo: {
      type: Number,
      required: function () {
        return this.type === "adjust";
      },
      min: 0,
    },
    adjustFrom: { type: Number, default: null },


    date: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
    imageUrl: { type: String, default: "" },

    isRecurring: { type: Boolean, default: false },
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
  if (this.type === "transfer" && this.walletId && this.toWalletId && this.walletId.equals(this.toWalletId)) {
    return next(new Error("Không thể chuyển trong cùng 1 ví"));
  }

  // Validate adjustFrom/adjustTo khi adjust
  if (this.type === "adjust") {
    if (this.adjustTo == null || typeof this.adjustTo !== "number" || this.adjustTo < 0) {
      return next(new Error("Adjust cần số dư mới (adjustTo) hợp lệ"));
    }
    // adjustFrom có thể null nếu dữ liệu cũ, nhưng tạo mới/update chuẩn sẽ set
  }

  next();
});

transactionSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Transaction", transactionSchema);
