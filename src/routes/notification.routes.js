const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, notificationController.createNotificationAPI);

router.get("/", verifyToken, notificationController.getMyNotificationsAPI);
router.get("/:id", verifyToken, notificationController.getNotificationByIdAPI);

router.patch("/:id/read", verifyToken, notificationController.markReadAPI);
router.patch("/read-all", verifyToken, notificationController.markAllReadAPI);

router.delete("/:id", verifyToken, notificationController.deleteNotificationAPI);
router.patch("/:id/restore", verifyToken, notificationController.restoreNotificationAPI);

module.exports = router;
