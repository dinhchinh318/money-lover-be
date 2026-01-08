const express = require("express");
const router = express.Router();

const savingGoalController = require("../controllers/savingGoalController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, savingGoalController.createSavingGoalAPI);
router.get("/", verifyToken, savingGoalController.getAllSavingGoalsAPI);
router.get("/:id", verifyToken, savingGoalController.getSavingGoalByIdAPI);
router.put("/:id", verifyToken, savingGoalController.updateSavingGoalAPI);
router.delete("/:id", verifyToken, savingGoalController.deleteSavingGoalAPI);


module.exports = router;


