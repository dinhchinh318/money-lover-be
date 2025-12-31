const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["system", "transaction", "budget", "analytics", "security", "promotion", "reminder"],
      default: "system",
      index: true,
    },

    level: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
    },

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },

    // optional deep link/action/meta
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    deliveredChannels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },

    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

notificationSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Notification", notificationSchema);
