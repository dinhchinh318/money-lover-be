const profileService = require("../services/profileService");

const getMyProfileAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileService.getMyProfile(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const updateMyProfileAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileService.upsertMyProfile(userId, req.body);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const uploadAvatarAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileService.uploadAvatar(userId, req.file);
    return res.status(result.status ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: -1,
      message: error.message,
      data: null,
    });
  }
};

const deleteMyProfileAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileService.softDeleteMyProfile(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const restoreMyProfileAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileService.restoreMyProfile(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

module.exports = {
  getMyProfileAPI,
  updateMyProfileAPI,
  uploadAvatarAPI,
  deleteMyProfileAPI,
  restoreMyProfileAPI,
};
