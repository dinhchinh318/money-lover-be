const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete')

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Ví nguồn (bắt buộc với tất cả loại trừ trường hợp special)
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true },

  // Category (có thể null cho transfer/adjust)
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: false },

  // Số tiền (luôn dương)
  amount: { type: Number, required: true, min: 0 },

  // Loại transaction giống Money Lover
  type: {
    type: String,
    enum: ["income", "expense", "debt", "loan", "transfer", "adjust"],
    required: true
  },

  // Dùng cho transfer: ví đích
  toWalletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet" },

  // Dùng cho debt/loan: thông tin người cho/mượn
  counterpartyName: { type: String },    // tên người vay/cho vay
  counterpartyContact: { type: String }, // số điện thoại/email nếu có
  dueDate: { type: Date },               // hạn trả nợ (nếu có)
  isSettled: { type: Boolean, default: false }, // đã thu/đã trả?

  // adjust: mô tả nguyên nhân điều chỉnh
  adjustReason: { type: String },

  date: { type: Date, default: Date.now },
  note: { type: String, default: "" },
  imageUrl: { type: String, default: "" },

  // recurring
  isRecurring: { type: Boolean, default: false },
  recurringType: { type: String, enum: ["daily","weekly","monthly","yearly", null], default: null }
}, { timestamps: true });

TransactionSchema.plugin(mongoose_delete, { overrideMethods: "all"});

module.exports = mongoose.model('Transaction', TransactionSchema);
