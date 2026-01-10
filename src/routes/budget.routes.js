const express = require("express");
const router = express.Router();

const budgetController = require("../controllers/budgetController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, budgetController.createBudgetAPI);
router.get("/", verifyToken, budgetController.getAllBudgetsAPI);
router.get("/:id", verifyToken, budgetController.getBudgetByIdAPI);
router.put("/:id", verifyToken, budgetController.updateBudgetAPI);
router.delete("/:id", verifyToken, budgetController.deleteBudgetAPI);
router.get("/:id/transactions", verifyToken, budgetController.getBudgetTransactionsAPI);
router.get("/:id/statistics", verifyToken, budgetController.getBudgetStatisticsAPI);

module.exports = router;
