const express = require("express");
const router = express.Router();

const recurringBillController = require("../controllers/recurringBillController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, recurringBillController.createRecurringBillAPI);
router.get("/", verifyToken, recurringBillController.getAllRecurringBillsAPI);
router.get("/:id", verifyToken, recurringBillController.getRecurringBillByIdAPI);
router.put("/:id", verifyToken, recurringBillController.updateRecurringBillAPI);
router.delete("/:id", verifyToken, recurringBillController.deleteRecurringBillAPI);
router.post("/:id/pay", verifyToken, recurringBillController.payRecurringBillAPI);

module.exports = router;



