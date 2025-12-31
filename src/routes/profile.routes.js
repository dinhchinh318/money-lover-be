const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { uploadAvatar } = require("../middlewares/uploadMiddleware");

router.get("/me", verifyToken, profileController.getMyProfileAPI);
router.put("/me", verifyToken, profileController.updateMyProfileAPI);
router.put(
  "/me/avatar",
  verifyToken,
  uploadAvatar.single("avatar"),
  profileController.uploadAvatarAPI
);

// optional
router.delete("/me", verifyToken, profileController.deleteMyProfileAPI);
router.patch("/me/restore", verifyToken, profileController.restoreMyProfileAPI);

module.exports = router;
