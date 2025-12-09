const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { verifyToken } = require("../middlewares/authMiddleware");

// A. Financial Dashboard routes
router.get("/financial-dashboard", verifyToken, reportController.getFinancialDashboardAPI);
router.get("/wallet-changes", verifyToken, reportController.getWalletChangesAPI);

// A. Comparison routes - So sánh kỳ trước
router.get("/compare/month", verifyToken, reportController.compareCurrentMonthWithPreviousAPI);
router.get("/compare/week", verifyToken, reportController.compareCurrentWeekWithPreviousAPI);
router.get("/compare/year", verifyToken, reportController.compareCurrentYearWithPreviousAPI);

// B. Báo cáo theo thời gian (Time-based Reports)
router.get("/time-based", verifyToken, reportController.getTimeBasedReportAPI);

// C. Báo cáo theo danh mục (Category Reports)
router.get("/category/expense", verifyToken, reportController.getCategoryExpenseReportAPI);
router.get("/category/top-expense", verifyToken, reportController.getTopExpenseCategoriesAPI);
router.get("/category/top-income", verifyToken, reportController.getTopIncomeCategoriesAPI);
router.get("/category/compare-months", verifyToken, reportController.compareCategoryExpenseBetweenMonthsAPI);

// D. Báo cáo theo ví (Wallet Reports)
router.get("/wallet/expense", verifyToken, reportController.getWalletExpenseReportAPI);
router.get("/wallet/distribution", verifyToken, reportController.getWalletExpenseDistributionAPI);
router.get("/wallet/compare-time", verifyToken, reportController.compareWalletExpenseOverTimeAPI);

module.exports = router;

