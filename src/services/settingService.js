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

// ✅ helper: deep default (để doc cũ thiếu field thì tự bổ sung)
const applyDefaultsDeep = (target, defaults) => {
  let changed = false;
  for (const k of Object.keys(defaults)) {
    const dv = defaults[k];
    const tv = target[k];

    if (tv === undefined) {
      target[k] = dv;
      changed = true;
      continue;
    }

    if (
      dv &&
      typeof dv === "object" &&
      !Array.isArray(dv) &&
      tv &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      const innerChanged = applyDefaultsDeep(tv, dv);
      if (innerChanged) changed = true;
    }
  }
  return changed;
};

// ✅ helper: build update object an toàn (lọc field + dot update nested)
const buildSafeUpdate = (payload = {}) => {
  const update = {};

  const setIfDefined = (path, value) => {
    if (value === undefined) return;
    update[path] = value;
  };

  // top-level allowlist
  setIfDefined("theme", payload.theme);
  setIfDefined("language", payload.language);
  setIfDefined("timezone", payload.timezone);
  setIfDefined("currency", payload.currency);
  setIfDefined("startOfWeek", payload.startOfWeek);
  setIfDefined("autoCategorize", payload.autoCategorize);

  // privacy (nested)
  if (payload.privacy && typeof payload.privacy === "object") {
    setIfDefined("privacy.showProfile", payload.privacy.showProfile);
    setIfDefined("privacy.showIncome", payload.privacy.showIncome);
  }

  // notificationPrefs (nested)
  if (payload.notificationPrefs && typeof payload.notificationPrefs === "object") {
    setIfDefined("notificationPrefs.inApp", payload.notificationPrefs.inApp);
    setIfDefined("notificationPrefs.email", payload.notificationPrefs.email);
    setIfDefined("notificationPrefs.push", payload.notificationPrefs.push);

    if (payload.notificationPrefs.types && typeof payload.notificationPrefs.types === "object") {
      const allowedTypes = Object.keys(DEFAULT_SETTING.notificationPrefs.types);
      for (const t of allowedTypes) {
        setIfDefined(`notificationPrefs.types.${t}`, payload.notificationPrefs.types[t]);
      }
    }
  }

  return update;
};

const getMySetting = async (userId) => {
  try {
    let doc = await Setting.findOne({ userId });

    if (!doc) {
      doc = await Setting.create({ userId, ...DEFAULT_SETTING });
      return { status: true, error: 0, message: "OK", data: doc.toObject() };
    }

    // ✅ nếu doc cũ thiếu field mới -> tự bù defaults và save
    const obj = doc.toObject();
    const changed = applyDefaultsDeep(obj, DEFAULT_SETTING);
    if (changed) {
      doc.set(obj);
      await doc.save();
    }

    return { status: true, error: 0, message: "OK", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const upsertMySetting = async (userId, payload) => {
  try {
    // optional: bỏ key undefined để tránh set sai
    const cleanPayload = Object.fromEntries(
      Object.entries(payload || {}).filter(([, v]) => v !== undefined)
    );

    let doc = await Setting.findOne({ userId });

    if (!doc) {
      // ✅ chưa có -> tạo mới: defaults + payload
      doc = await Setting.create({
        userId,
        ...DEFAULT_SETTING,
        ...cleanPayload,
      });
    } else {
      // ✅ đã có -> update những gì user gửi
      doc.set(cleanPayload);
      await doc.save();
    }

    return { status: true, error: 0, message: "Updated successfully", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};


const resetMySetting = async (userId) => {
  try {
    await Setting.deleteOne({ userId });
    const doc = await Setting.create({ userId, ...DEFAULT_SETTING });

    return { status: true, error: 0, message: "Reset successfully", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

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
