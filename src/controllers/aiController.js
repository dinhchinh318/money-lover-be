const aiService = require("../services/aiService");

const aiController = {
  // Gợi ý khi người dùng chuẩn bị tạo Budget mới (gọi API này khi user chọn Category)
  getBudgetSuggestion: async (req, res) => {
    try {
      const { categoryId } = req.query; // Gửi categoryId lên qua query param
      const userId = req.user._id;      // Lấy từ Token
      
      const suggestion = await aiService.suggestBudget(userId, categoryId);
      return res.status(200).json(suggestion);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  // Dashboard cảnh báo (gọi API này ở trang chủ)
  getBudgetAlerts: async (req, res) => {
    try {
      const userId = req.user._id;
      const report = await aiService.analyzeBudgetHealth(userId);
      return res.status(200).json(report);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
};

module.exports = aiController;