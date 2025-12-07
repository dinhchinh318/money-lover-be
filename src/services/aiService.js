const Budget = require("../models/budget"); // Import schema bạn vừa cung cấp
const Transaction = require("../models/transaction"); // Giả sử bạn đã có model này
const mongoose = require("mongoose");

const aiService = {
  // ---------------------------------------------------------
  // TÍNH NĂNG 1: Gợi ý hạn mức (limit_amount) dựa trên lịch sử
  // ---------------------------------------------------------
  suggestBudget: async (userId, categoryId) => {
    // 1. Xác định khung thời gian: Lấy dữ liệu 3 tháng gần nhất
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 2. Dùng Aggregation của MongoDB để tính toán
    const stats = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(String(userId)),
          category: new mongoose.Types.ObjectId(String(categoryId)),
          date: { $gte: threeMonthsAgo } // Giả sử model Transaction có trường date
        }
      },
      {
        // Gom nhóm theo tháng để tính tổng chi tiêu từng tháng
        $group: {
          _id: { 
            month: { $month: "$date" }, 
            year: { $year: "$date" } 
          },
          totalSpent: { $sum: "$amount" }
        }
      },
      {
        // Tính trung bình cộng của các tháng
        $group: {
          _id: null,
          avgMonthlySpent: { $avg: "$totalSpent" }
        }
      }
    ]);

    const average = stats.length > 0 ? stats[0].avgMonthlySpent : 0;

    // 3. Đưa ra các gói gợi ý
    return {
      categoryId,
      basedOn: "Average spending of last 3 months",
      suggestions: {
        strict: Math.ceil(average),           // Gói tiết kiệm (bằng đúng trung bình)
        moderate: Math.ceil(average * 1.1),   // Gói vừa phải (thêm 10% dư dả)
        relaxed: Math.ceil(average * 1.2)     // Gói thoải mái (thêm 20%)
      }
    };
  },

  // ---------------------------------------------------------
  // TÍNH NĂNG 2: Kiểm tra sức khỏe ngân sách hiện tại
  // ---------------------------------------------------------
  analyzeBudgetHealth: async (userId) => {
    const today = new Date();

    // 1. Tìm tất cả các Budget đang hiệu lực của user
    const activeBudgets = await Budget.find({
      userId: userId,
      start_date: { $lte: today },
      end_date: { $gte: today }
    });

    const report = [];

    for (const budget of activeBudgets) {
      // 2. Tính tổng tiền đã tiêu cho category này trong khoảng thời gian của budget
      const spentStats = await Transaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            category: budget.category,
            date: { $gte: budget.start_date, $lte: budget.end_date }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);

      const totalSpent = spentStats.length > 0 ? spentStats[0].total : 0;
      const usagePercent = (totalSpent / budget.limit_amount) * 100;

      // 3. Logic AI cảnh báo
      let status = "SAFE";
      let message = "Chi tiêu hợp lý.";

      if (usagePercent > 100) {
        status = "DANGER";
        message = `Bạn đã lố ngân sách ${(totalSpent - budget.limit_amount).toLocaleString()}đ!`;
      } else if (usagePercent > 80) {
        status = "WARNING";
        message = "Cảnh báo: Bạn sắp chạm trần ngân sách.";
      } else if (usagePercent > 50 && isEarlyPeriod(budget.start_date, budget.end_date)) {
        // Ví dụ: Mới đi nửa tháng mà tiêu hơn 50% -> Cảnh báo nhẹ
        status = "NOTICE";
        message = "Bạn đang tiêu hơi nhanh so với thời gian.";
      }

      report.push({
        budgetName: budget.name,
        limit: budget.limit_amount,
        spent: totalSpent,
        remaining: budget.limit_amount - totalSpent,
        percentage: usagePercent.toFixed(1) + "%",
        status: status,
        advice: message
      });
    }

    return report;
  }
};

// Hàm phụ trợ: Kiểm tra xem có đang ở nửa đầu kỳ hạn không
function isEarlyPeriod(start, end) {
  const today = new Date();
  const totalDays = (end - start) / (1000 * 60 * 60 * 24);
  const passedDays = (today - start) / (1000 * 60 * 60 * 24);
  return (passedDays / totalDays) < 0.5;
}

module.exports = aiService;