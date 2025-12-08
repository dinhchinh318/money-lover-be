const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { verifyToken } = require("../middlewares/authMiddleware");

// ============================================
// A. DIAGNOSTIC ANALYTICS (Phân tích nguyên nhân)
// ============================================

// A.1 - Phân tích biến động chi tiêu
router.get("/diagnostic/category-spikes", verifyToken, analyticsController.getCategorySpendingSpikesAPI);
router.get("/diagnostic/monthly-spikes", verifyToken, analyticsController.getMonthlySpendingSpikesAPI);
router.get("/diagnostic/wallet-variations", verifyToken, analyticsController.getWalletVariationsAPI);

// A.2 - Phát hiện bất thường
router.get("/diagnostic/unusual-large", verifyToken, analyticsController.detectUnusualLargeExpensesAPI);
router.get("/diagnostic/unusual-time", verifyToken, analyticsController.detectUnusualTimeSpendingAPI);
router.get("/diagnostic/24h-spike", verifyToken, analyticsController.detect24hSpendingSpikeAPI);

// A.3 - Phân tích thói quen chi tiêu
router.get("/diagnostic/spending-day", verifyToken, analyticsController.getMostSpendingDayOfWeekAPI);
router.get("/diagnostic/frequent-categories", verifyToken, analyticsController.getMostFrequentCategoriesAPI);
router.get("/diagnostic/transaction-frequency", verifyToken, analyticsController.getTransactionFrequencyAPI);

// ============================================
// B. PREDICTIVE ANALYTICS (Dự đoán)
// ============================================

// B.1 - Dự đoán chi tiêu cuối tháng
router.get("/predictive/month-end-7days", verifyToken, analyticsController.predictMonthEndExpense7DaysAPI);
router.get("/predictive/month-end-30days", verifyToken, analyticsController.predictMonthEndExpense30DaysAPI);
router.get("/predictive/month-end-trend", verifyToken, analyticsController.predictMonthEndExpenseTrendAPI);

// B.2 - Dự đoán vượt ngân sách
router.get("/predictive/budget-overrun", verifyToken, analyticsController.predictBudgetOverrunAPI);

// B.3 - Dự đoán chi tiêu theo danh mục
router.get("/predictive/category-spending", verifyToken, analyticsController.predictCategorySpendingAPI);

// ============================================
// C. PRESCRIPTIVE ANALYTICS (Khuyến nghị hành động)
// ============================================

// C.1 - Gợi ý tối ưu chi tiêu
router.get("/prescriptive/optimize-spending", verifyToken, analyticsController.suggestOptimizeSpendingAPI);
router.get("/prescriptive/budget-adjustment", verifyToken, analyticsController.suggestBudgetAdjustmentAPI);

// C.2 - Khuyến nghị chuyển tiền
router.get("/prescriptive/wallet-transfer", verifyToken, analyticsController.suggestWalletTransferAPI);

// C.3 - Cảnh báo thông minh
router.post("/prescriptive/create-alerts", verifyToken, analyticsController.createSmartAlertsAPI);
router.get("/prescriptive/alert-history", verifyToken, analyticsController.getAlertHistoryAPI);
router.patch("/prescriptive/alerts/:alertId/read", verifyToken, analyticsController.markAlertAsReadAPI);

module.exports = router;


