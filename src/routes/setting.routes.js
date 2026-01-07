const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settingController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.get("/me", verifyToken, settingController.getMySettingAPI);
router.put("/me", verifyToken, settingController.updateMySettingAPI);
router.post("/me/reset", verifyToken, settingController.resetMySettingAPI);

// optional
router.delete("/me", verifyToken, settingController.deleteMySettingAPI);
router.patch("/me/restore", verifyToken, settingController.restoreMySettingAPI);

module.exports = router;
