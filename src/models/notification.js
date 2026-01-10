// models/notification.js
const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // ✅ FIX: thêm system + mở rộng type theo nhu cầu
    type: {
      type: String,
      enum: [
        "system",
        "transaction",
        "wallet",
        "budget",
        "analytics",
        "security",
        "promotion",
        "reminder",

        // ✅ thêm loại bạn cần
        "group",     // mời vào nhóm / out nhóm / kick
        "bill",      // hóa đơn
        "saving",    // tiết kiệm
        "report",    // báo cáo tuần/tháng
      ],
      default: "system",
      index: true,
    },

    level: { type: String, enum: ["info", "success", "warning", "error"], default: "info", index: true },

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },

    // ✅ ADD: meta cho deep-link & event tracking
    event: { type: String, default: "", index: true },     // vd: budget.exceeded
    link: { type: String, default: "" },                   // vd: /budgets/:id
    entity: {
      kind: { type: String, default: "" },                 // vd: budget, group, bill
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },

    // ✅ ADD: chống spam noti
    dedupeKey: { type: String, default: null },

    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    deliveredChannels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },

    expiresAt: { type: Date, default: null }, // optional
  },
  { timestamps: true }
);

// ✅ sort index
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// ✅ IMPORTANT: unique dedupe per user (chỉ unique khi dedupeKey tồn tại)
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

// ✅ OPTIONAL: auto-expire notification (TTL) nếu bạn muốn
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.plugin(mongoose_delete, { deletedAt: true, overrideMethods: "all" });

module.exports = mongoose.model("Notification", notificationSchema);
