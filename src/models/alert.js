const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

/**
 * Schema này lưu trữ các cảnh báo, khuyến nghị được tạo ra từ hệ thống phân tích.
 */
const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Loại cảnh báo để phân loại và hiển thị icon phù hợp ở frontend
    type: {
      type: String,
      enum: [
        "BUDGET_OVERRUN_PREDICTED", // Dự đoán vượt ngân sách
        "UNUSUAL_SPENDING_DETECTED", // Phát hiện chi tiêu bất thường
        "CATEGORY_SPENDING_SPIKE", // Danh mục chi tiêu tăng đột biến
        "MONTHLY_SPENDING_INCREASE", // Chi tiêu tháng tăng so với tháng trước
        "LOW_WALLET_BALANCE", // Ví sắp hết tiền
        "SUGGEST_OPTIMIZE_SPENDING", // Gợi ý tối ưu chi tiêu
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },

    // Dữ liệu liên quan để khi người dùng click vào có thể điều hướng
    // Ví dụ: link đến giao dịch bất thường, hoặc ngân sách sắp vượt
    related: {
      model: String, // Tên model, ví dụ: 'Transaction', 'Budget'
      id: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true, // `createdAt` sẽ là thời điểm cảnh báo được tạo
  }
);

// Index giúp truy vấn nhanh các cảnh báo của người dùng, đặc biệt là các cảnh báo chưa đọc
alertSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Add plugin mongoose-delete
alertSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Alert", alertSchema);
