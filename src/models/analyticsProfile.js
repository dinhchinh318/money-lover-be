const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

/**
 * Schema này lưu trữ các chỉ số phân tích được tính toán trước cho mỗi người dùng.
 * Dữ liệu này được cập nhật định kỳ (ví dụ: hàng đêm) để tăng tốc độ truy vấn phân tích.
 */
const analyticsProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Mỗi người dùng chỉ có một hồ sơ phân tích
    },

    // --- Phân tích thói quen (Behavior Analytics) ---
    avgDailyExpense: { type: Number, default: 0 },
    avgTransactionsPerWeek: { type: Number, default: 0 },
    // Ngày trong tuần chi tiêu nhiều nhất (1: Chủ Nhật, 2: Thứ Hai, ..., 7: Thứ Bảy)
    mostActiveSpendingDayOfWeek: { type: Number, min: 1, max: 7 },
    mostFrequentExpenseCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    // --- Dùng cho phát hiện bất thường (Anomaly Detection) ---
    // Mức chi trung bình cho một giao dịch
    avgExpenseAmount: { type: Number, default: 0 },
    // Độ lệch chuẩn của các khoản chi (dùng để xác định ngưỡng bất thường)
    stdDevExpenseAmount: { type: Number, default: 0 },

    // --- Dùng cho dự đoán (Predictive Analytics) ---
    // Hệ số thể hiện xu hướng chi tiêu (ví dụ: 1.1 = tăng 10%)
    dailyExpenseTrend: { type: Number, default: 1 },

    // Thời điểm cuối cùng các chỉ số này được tính toán
    lastCalculated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Index để tìm nhanh hồ sơ của một người dùng
analyticsProfileSchema.index({ userId: 1 });

// Add plugin mongoose-delete
analyticsProfileSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("AnalyticsProfile", analyticsProfileSchema);
