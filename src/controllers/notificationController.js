const notificationService = require("../services/notificationService");

const createNotificationAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.createNotification(userId, req.body);

    if (!result.status) {
      return res.status(result.error === 1 ? 400 : 500).json(result);
    }
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const getMyNotificationsAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.getMyNotifications(userId, req.query);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const getNotificationByIdAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.getNotificationById(userId, req.params.id);
    return res.status(result.status ? 200 : (result.error === 1 ? 404 : 500)).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const markReadAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.markRead(userId, req.params.id);
    return res.status(result.status ? 200 : (result.error === 1 ? 404 : 500)).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const markAllReadAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.markAllRead(userId);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const deleteNotificationAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.deleteNotification(userId, req.params.id);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

const restoreNotificationAPI = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.restoreNotification(userId, req.params.id);
    return res.status(result.status ? 200 : 500).json(result);
  } catch (error) {
    return res.status(500).json({ status: false, error: -1, message: error.message, data: null });
  }
};

module.exports = {
  createNotificationAPI,
  getMyNotificationsAPI,
  getNotificationByIdAPI,
  markReadAPI,
  markAllReadAPI,
  deleteNotificationAPI,
  restoreNotificationAPI,
};
