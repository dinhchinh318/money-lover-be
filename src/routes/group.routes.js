const express = require("express");

const groupCtl = require("../controllers/group/groupController");
const inviteCtl = require("../controllers/group/groupInviteController");
const walletCtl = require("../controllers/group/groupWalletController");
const catCtl = require("../controllers/group/groupCategoryController");
const budgetCtl = require("../controllers/group/groupBudgetController");
const txCtl = require("../controllers/group/groupTransactionController");
const reportCtl = require("../controllers/group/groupReportController");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// group
router.post("/", verifyToken, groupCtl.create);
router.get("/me", verifyToken, groupCtl.myGroups);
router.get("/:groupId", verifyToken, groupCtl.detail);
router.post("/:groupId/leave", verifyToken, groupCtl.leave);
router.delete("/:groupId/members/:userId", verifyToken, groupCtl.removeMember);
router.patch("/:groupId/members/:userId/role", verifyToken, groupCtl.setMemberRole);
router.patch("/:groupId", verifyToken, groupCtl.update);
router.delete("/:groupId", verifyToken, groupCtl.disable);

// invite
router.post("/:groupId/invites", verifyToken, inviteCtl.create);
router.get("/invites/me", verifyToken, inviteCtl.myInvites);
router.post("/invites/:token/accept", verifyToken, inviteCtl.accept);
router.post("/invites/:token/decline", verifyToken, inviteCtl.decline);
router.post("/invites/:inviteId/revoke", verifyToken, inviteCtl.revoke);

// wallets
router.get("/:groupId/wallets", verifyToken, walletCtl.list);
router.post("/:groupId/wallets", verifyToken, walletCtl.create);
router.patch("/:groupId/wallets/:walletId", verifyToken, walletCtl.update);
router.delete("/:groupId/wallets/:walletId", verifyToken, walletCtl.disable);
router.post("/:groupId/wallets/:walletId/recalc", verifyToken, walletCtl.recalc);

// categories
router.get("/:groupId/categories", verifyToken, catCtl.list);
router.post("/:groupId/categories", verifyToken, catCtl.create);
router.patch("/:groupId/categories/:categoryId", verifyToken, catCtl.update);
router.delete("/:groupId/categories/:categoryId", verifyToken, catCtl.disable);

// budgets
router.get("/:groupId/budgets", verifyToken, budgetCtl.list);
router.post("/:groupId/budgets", verifyToken, budgetCtl.create);
router.delete("/:groupId/budgets/:budgetId", verifyToken, budgetCtl.disable);
router.get("/:groupId/budgets/:budgetId/progress", verifyToken, budgetCtl.progress);

// transactions
router.get("/:groupId/transactions", verifyToken, txCtl.list);
router.post("/:groupId/transactions", verifyToken, txCtl.create);
router.patch("/:groupId/transactions/:txId", verifyToken, txCtl.update);
router.delete("/:groupId/transactions/:txId", verifyToken, txCtl.remove);

// reports
router.get("/:groupId/reports/summary", verifyToken, reportCtl.summary);
router.get("/:groupId/reports/by-category", verifyToken, reportCtl.byCategory);
router.get("/:groupId/reports/by-wallet", verifyToken, reportCtl.byWallet);

module.exports = router;
