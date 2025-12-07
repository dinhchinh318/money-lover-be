const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Statistics routes (đặt trước để tránh conflict với /:id)
router.get('/stats/category', verifyToken, transactionController.getStatsByCategoryAPI);
router.get('/stats/overview', verifyToken, transactionController.getOverviewStatsAPI);

// CRUD routes
router.post('/', verifyToken, transactionController.createTransactionAPI);
router.get('/', verifyToken, transactionController.getAllTransactionsAPI);
router.get('/:id', verifyToken, transactionController.getTransactionByIdAPI);
router.put('/:id', verifyToken, transactionController.updateTransactionAPI);
router.delete('/:id', verifyToken, transactionController.deleteTransactionAPI);

// Action routes
router.patch('/:id/restore', verifyToken, transactionController.restoreTransactionAPI);
router.patch('/:id/settle', verifyToken, transactionController.settleDebtLoanAPI);

module.exports = router;