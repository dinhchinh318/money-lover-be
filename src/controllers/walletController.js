const { createWallet, getAllWallets, getWalletById, updateWallet, setDefaultWallet, deleteWallet, restoreWallet, archiveWallet, unarchiveWallet } = require("../services/walletService");

const createWalletAPI = async (req, res) => {
  let wallet = await createWallet(req.user.id, req.body.data);
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

const getAllWalletsAPI = async (req, res) => {
  let wallets = await getAllWallets(req.user.id);
  if (wallets){
    return res.status(201).json({
      EC: 0,
      data: wallets,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

const getWalletByIdAPI = async (req, res) => {
  let wallet = await getWalletById(req.body.walletId, req.user.id);
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

const updateWalletAPI = async (req, res) => {
  let wallet = await updateWallet(req.body.walletId, req.user.id, req.body.data);
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

const setDefaultWalletAPI = async (req, res) => {
  let wallet = await setDefaultWallet(req.body.walletId, req.user.id);
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

const deleteWalletAPI = async (req, res) => {
  let wallet = await deleteWallet(req.body.walletId, req.user.id);
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
  let wallet = await archiveWallet(req.body.walletId, req.user.id);
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

const unarchiveWalletAPI = async (req, res) => {
  let wallet = await unarchiveWallet(req.body.walletId, req.user.id);
  if (wallet){
    return res.status(201).json({
      EC: 0,
      data: wallet,
    });
  }
  return res.status(200).json({
    EC: 0,
    data: null,
  })
}

module.exports = {
  createWalletAPI, getAllWalletsAPI, getWalletByIdAPI, updateWalletAPI, setDefaultWalletAPI, deleteWalletAPI,
  restoreWalletAPI, archiveWalletAPI, unarchiveWalletAPI
}