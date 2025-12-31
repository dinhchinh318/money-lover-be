const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

const settingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // UI/Locale
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    language: { type: String, default: "vi" },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
    currency: { type: String, default: "VND" },

    // App preferences
    startOfWeek: { type: String, enum: ["mon", "sun"], default: "mon" },
    autoCategorize: { type: Boolean, default: true },

    // Notification preferences (global)
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },

      // per-type toggle
      types: {
        system: { type: Boolean, default: true },
        transaction: { type: Boolean, default: true },
        budget: { type: Boolean, default: true },
        analytics: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true },
        promotion: { type: Boolean, default: false },
      },
    },

    // Privacy
    privacy: {
      showProfile: { type: Boolean, default: true },
      showIncome: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

settingSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Setting", settingSchema);
