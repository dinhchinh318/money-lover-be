const { createWallet, getAllWallets, getWalletById, updateWallet, setDefaultWallet, deleteWallet, restoreWallet, archiveWallet, unarchiveWallet } = require("../services/walletService");

const createWalletAPI = async (req, res) => {
  let wallet = await createWallet(req.user.id, req.body.data);
  if (wallet && wallet.status !== false){
    return res.status(201).json({
      EC: 0,
      message: wallet.message || "Created successfully",
      data: wallet.data,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Create wallet failed",
    data: null,
  })
}

const getAllWalletsAPI = async (req, res) => {
  let wallets = await getAllWallets(req.user.id);
  if (wallets && wallets.status !== false){
    return res.status(200).json({
      EC: 0,
      data: wallets.data,
    });
  }
  return res.status(200).json({
    EC: wallets?.error || -1,
    message: wallets?.message || "Get wallets failed",
    data: null,
  })
}

const getWalletByIdAPI = async (req, res) => {
  let wallet = await getWalletById(req.params.id, req.user.id);
  if (wallet && wallet.status !== false){
    return res.status(200).json({
      EC: 0,
      data: wallet.data || wallet,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Wallet not found",
    data: null,
  })
}

const updateWalletAPI = async (req, res) => {
  let wallet = await updateWallet(req.params.id, req.user.id, req.body.data);
  if (wallet && wallet.status !== false){
    return res.status(200).json({
      EC: 0,
      message: wallet.message || "Updated successfully",
      data: wallet.data,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Update failed",
    data: null,
  })
}

const setDefaultWalletAPI = async (req, res) => {
  let wallet = await setDefaultWallet(req.params.id, req.user.id);
  if (wallet && wallet.status !== false){
    return res.status(200).json({
      EC: 0,
      message: wallet.message || "Set successfully",
      data: wallet.data,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Set default failed",
    data: null,
  })
}

const deleteWalletAPI = async (req, res) => {
  let wallet = await deleteWallet(req.params.id, req.user.id);
  if (wallet && wallet.status !== false){
    return res.status(200).json({
      EC: 0,
      message: wallet.message || "Deleted successfully",
      data: wallet.data,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Delete failed",
    data: null,
  })
}

const restoreWalletAPI = async (req, res) => {
  let wallet = await restoreWallet(req.body.walletId, req.user.id);
  if (wallet){
    return res.status(201).json({
      EC: 0,
      data: wallet,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

const archiveWalletAPI = async (req, res) => {
  let wallet = await archiveWallet(req.params.id, req.user.id);
  if (wallet && wallet.status !== false){
    return res.status(200).json({
      EC: 0,
      message: wallet.message || "Archived successfully",
      data: wallet.data,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Archive failed",
    data: null,
  })
}

const unarchiveWalletAPI = async (req, res) => {
  let wallet = await unarchiveWallet(req.params.id, req.user.id);
  if (wallet && wallet.status !== false){
    return res.status(200).json({
      EC: 0,
      message: wallet.message || "Unarchived successfully",
      data: wallet.data,
    });
  }
  return res.status(200).json({
    EC: wallet?.error || -1,
    message: wallet?.message || "Unarchive failed",
    data: null,
  })
}

module.exports = {
  createWalletAPI, getAllWalletsAPI, getWalletByIdAPI, updateWalletAPI, setDefaultWalletAPI, deleteWalletAPI,
  restoreWalletAPI, archiveWalletAPI, unarchiveWalletAPI
}