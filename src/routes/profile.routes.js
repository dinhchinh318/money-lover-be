const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.get("/me", verifyToken, profileController.getMyProfileAPI);
router.put("/me", verifyToken, profileController.updateMyProfileAPI);

// optional
router.delete("/me", verifyToken, profileController.deleteMyProfileAPI);
router.patch("/me/restore", verifyToken, profileController.restoreMyProfileAPI);

module.exports = router;
