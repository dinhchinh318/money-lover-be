const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyGoogleToken } = require("../middlewares/googleAuthMiddleware");

router.post('/register', authController.registerAPI);
router.post('/login', authController.loginAPI);
router.post('/google', verifyGoogleToken, authController.googleLoginAPI);
router.post('/refreshToken', authController.refreshAPI);
router.post('/logout', verifyToken, authController.logoutAPI);
router.get('/account', verifyToken, authController.getAccountAPI);
router.put('/account', verifyToken, authController.updateAccountAPI);
router.post('/changePassword', verifyToken, authController.changePasswordAPI);
router.post('/forgotPassword', authController.forgotPasswordAPI);
router.post('/verifyOTP', authController.verifyOTPAPI);
router.post('/resetPassword', authController.resetPasswordAPI);

module.exports = router;