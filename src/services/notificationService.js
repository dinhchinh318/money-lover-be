const Notification = require("../models/notification");

const createNotification = async (userId, payload) => {
  try {
    const doc = await Notification.create({ userId, ...payload });
    return { status: true, error: 0, message: "Created successfully", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getMyNotifications = async (userId, query) => {
  try {
    const page = Math.max(parseInt(query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = { userId };

    if (query.isRead === "true") filter.isRead = true;
    if (query.isRead === "false") filter.isRead = false;
    if (query.type) filter.type = query.type;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return {
      status: true,
      error: 0,
      message: "OK",
      data: {
        items: items.map((x) => x.toObject()),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        unreadCount,
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const getNotificationById = async (userId, id) => {
  try {
    const doc = await Notification.findOne({ _id: id, userId });
    if (!doc) return { status: false, error: 1, message: "Notification not found", data: null };

    return { status: true, error: 0, message: "OK", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const markRead = async (userId, id) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!doc) return { status: false, error: 1, message: "Notification not found", data: null };
    return { status: true, error: 0, message: "Marked as read", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const markAllRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return { status: true, error: 0, message: "Marked all as read", data: result };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const deleteNotification = async (userId, id) => {
  try {
    const doc = await Notification.delete({ _id: id, userId });
    return { status: true, error: 0, message: "Deleted successfully", data: doc };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const restoreNotification = async (userId, id) => {
  try {
    const doc = await Notification.restore({ _id: id, userId });
    return { status: true, error: 0, message: "Restored successfully", data: doc };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  createNotification,
  getMyNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  deleteNotification,
  restoreNotification,
};
