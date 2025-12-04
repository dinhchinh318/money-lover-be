const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post('/', verifyToken, walletController.createWalletAPI);
router.get('/', verifyToken, walletController.getAllWalletsAPI);
router.get('/:id', verifyToken, walletController.getWalletByIdAPI);
router.put('/:id', verifyToken, walletController.updateWalletAPI);
router.patch('/:id', verifyToken, walletController.setDefaultWalletAPI);
router.delete('/:id', verifyToken, walletController.deleteWalletAPI);
router.patch('/:id/default', verifyToken, walletController.setDefaultWalletAPI);
router.patch('/:id/archive', verifyToken, walletController.archiveWalletAPI);
router.patch('/:id/unarchive', verifyToken, walletController.unarchiveWalletAPI);

module.exports = router;