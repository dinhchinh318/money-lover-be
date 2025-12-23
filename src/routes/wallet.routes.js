const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post('/', verifyToken, walletController.createWalletAPI);
router.get('/', verifyToken, walletController.getAllWalletsAPI);
// Specific routes phải đặt trước dynamic routes
router.patch('/:id/default', verifyToken, walletController.setDefaultWalletAPI);
router.patch('/:id/archive', verifyToken, walletController.archiveWalletAPI);
router.patch('/:id/unarchive', verifyToken, walletController.unarchiveWalletAPI);
// Dynamic routes
router.get('/:id', verifyToken, walletController.getWalletByIdAPI);
router.put('/:id', verifyToken, walletController.updateWalletAPI);
router.delete('/:id', verifyToken, walletController.deleteWalletAPI);

module.exports = router;