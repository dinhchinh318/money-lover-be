const express = require("express");
const router = express.Router();

const savingGoalController = require("../controllers/savingGoalController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, savingGoalController.createSavingGoalAPI);
router.get("/", verifyToken, savingGoalController.getAllSavingGoalsAPI);
router.get("/:id", verifyToken, savingGoalController.getSavingGoalByIdAPI);
router.put("/:id", verifyToken, savingGoalController.updateSavingGoalAPI);
router.delete("/:id", verifyToken, savingGoalController.deleteSavingGoalAPI);
router.post("/:id/add", verifyToken, savingGoalController.addAmountAPI);
router.post("/:id/withdraw", verifyToken, savingGoalController.withdrawAmountAPI);

module.exports = router;


