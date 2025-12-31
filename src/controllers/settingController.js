const settingService = require("../services/settingService");

const getMySettingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await settingService.getMySetting(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const updateMySettingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await settingService.upsertMySetting(userId, req.body);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const resetMySettingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await settingService.resetMySetting(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const deleteMySettingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await settingService.softDeleteMySetting(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const restoreMySettingAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await settingService.restoreMySetting(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

module.exports = {
  getMySettingAPI,
  updateMySettingAPI,
  resetMySettingAPI,
  deleteMySettingAPI,
  restoreMySettingAPI,
};
