const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Định nghĩa các đường dẫn API cho AI
// GET /api/ai/suggest-budget?categoryId=...
router.get("/suggest-budget", verifyToken, aiController.getBudgetSuggestion);

// GET /api/ai/alerts
router.get("/alerts", verifyToken, aiController.getBudgetAlerts);

module.exports = router;