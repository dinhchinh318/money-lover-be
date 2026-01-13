const Wallet = require("../models/wallet");

const createWallet = async (userId, walletData) => {
  try {
    const exists = await Wallet.findOne({
      userId,
      name: walletData.name.trim(),
      deleted: false,
    });

    if (exists){
      return {
        status: false,
        error: 1,
        message: "Wallet name already exists. Please try another name.",
        data: null,
      };
    }

    const count = await Wallet.countDocuments({ userId });
    if (count == 0){
      const wallet = await Wallet.create({
        ...walletData,
        userId,
        is_default: true,
      });

      return {
        status: true,
        error: 0,
        message: "Created successfully",
        data: wallet.toObject(),
      };
    }

    if (walletData.is_default == true){
      await Wallet.updateMany({ userId }, { is_default: false });
    }

    const wallet = await Wallet.create({
      ...walletData,
      userId,
    });

    return {
      status: true,
      error: 0,
      message: "Created successfully",
      data: wallet.toObject(),
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const getAllWallets = async (userId) => {
  try{
    const wallets = await Wallet.find({ userId }).sort({ is_default: -1, createdAt: -1 });
    return {
      status: true,
      error: 0,
      data: wallets.map(w => w.toObject()),
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const getWalletById = async (walletId, userId) => {
  try {
    const wallet = await Wallet.findOne({ _id: walletId, userId });

    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found",
        data: null,
      };
    }

    return wallet;
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const updateWallet = async (walletId, userId, data) => {
  try {
    const wallet = await Wallet.findOne({ _id: walletId, userId });

    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found",
        data: null,
      };
    }

    if (data.is_default == true){
      await Wallet.updateMany({ userId }, { is_default: false });
    }

    const updateWallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId },
      data,
      { new: true }
    );

    return {
      status: true,
      error: 0,
      message: "Updated successfully",
      data: updateWallet.toObject(),
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const setDefaultWallet = async (walletId, userId) => {
  try{
    const wallet = await Wallet.findOne({ _id: walletId, userId });

    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found",
        data: null,
      };
    }

    if (wallet.is_archived == true){
      return {
        status: false,
        error: 1,
        message: "Can not set default for archive wallet",
        data: null,
      };
    }

    await Wallet.updateMany({ userId }, { is_default: false });

    const updateWallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId },
      { is_default: true },
      { new: true }
    );

    return {
      status: true,
      error: 0,
      message: "Set successfully",
      data: updateWallet.toObject(),
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const deleteWallet = async (walletId, userId) => {
  try{
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    
    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found",
        data: null,
      };
    }

    if (wallet.is_default){
      return {
        status: false,
        error: 1,
        message: "Cannot delete default wallet",
        data: null,
      };
    }

    await wallet.delete();
    return {
      status: true,
      error: 0,
      message: "Deleted successfully",
      data: null,
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const restoreWallet = async (walletId, userId) => {
  try{
    const wallet = await Wallet.findOneDeleted({ _id: walletId, userId });

    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found or not deleted",
        data: null,
      };
    }

    await wallet.restore();
    return {
      status: true,
      error: 0,
      message: "Restored successfully",
      data: wallet,
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const archiveWallet = async (walletId, userId) => {
  try{
    const wallet = await Wallet.findOne({ _id: walletId, userId });

    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found",
        data: null,
      };
    }

    if (wallet.is_default == true){
      return {
        status: false,
        error: 1,
        message: "Can not archive default wallet",
        data: null,
      };
    }

    const updateWallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId },
      { is_archived: true },
      { new: true }
    );

    return {
      status: true,
      error: 0,
      data: updateWallet.toObject(),
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    }
  }
}

const unarchiveWallet = async (walletId, userId) => {
  try {
    const wallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId },
      { is_archived: false },
      { new: true }
    );

    if (!wallet){
      return {
        status: false,
        error: 1,
        message: "Wallet not found or not deleted",
        data: null,
      };
    }
  
    return {
      status: true,
      error: 0,
      data: wallet.toObject(),
    };
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    }
  }
}

module.exports = {
  createWallet, getAllWallets, getWalletById, updateWallet, setDefaultWallet, deleteWallet,
  restoreWallet, archiveWallet, unarchiveWallet
}