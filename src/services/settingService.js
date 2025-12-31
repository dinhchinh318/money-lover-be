const Setting = require("../models/setting");

const DEFAULT_SETTING = {
  theme: "system",
  language: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  startOfWeek: "mon",
  autoCategorize: true,
  notificationPrefs: {
    inApp: true,
    email: false,
    push: false,
    types: {
      system: true,
      transaction: true,
      budget: true,
      analytics: true,
      security: true,
      reminder: true,
      promotion: false,
    },
  },
  privacy: { showProfile: true, showIncome: false },
};

const getMySetting = async (userId) => {
  try {
    let doc = await Setting.findOne({ userId });

    if (!doc) {
      doc = await Setting.create({ userId, ...DEFAULT_SETTING });
    }

    return { status: true, error: 0, message: "OK", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const upsertMySetting = async (userId, payload) => {
  try {
    const doc = await Setting.findOneAndUpdate(
      { userId },
      { $set: payload, $setOnInsert: { userId, ...DEFAULT_SETTING } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return { status: true, error: 0, message: "Updated successfully", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const resetMySetting = async (userId) => {
  try {
    await Setting.deleteOne({ userId }); // hard delete doc hiện tại (không dùng soft ở đây)
    const doc = await Setting.create({ userId, ...DEFAULT_SETTING });

    return { status: true, error: 0, message: "Reset successfully", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

// soft delete / restore (nếu bạn muốn dùng)
const softDeleteMySetting = async (userId) => {
  try {
    const doc = await Setting.delete({ userId });
    return { status: true, error: 0, message: "Deleted successfully", data: doc };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const restoreMySetting = async (userId) => {
  try {
    const doc = await Setting.restore({ userId });
    return { status: true, error: 0, message: "Restored successfully", data: doc };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  getMySetting,
  upsertMySetting,
  resetMySetting,
  softDeleteMySetting,
  restoreMySetting,
};
