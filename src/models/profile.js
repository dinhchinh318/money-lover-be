const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Thông tin hiển thị (User đã có name/avatar/description, nhưng profile giúp mở rộng)
    displayName: { type: String, trim: true, default: "Người Dùng" },
    bio: { type: String, trim: true, default: "" },
    avatarUrl: {
      type: String,
      trim: true,
      default: "https://res.cloudinary.com/dijy8yams/image/upload/v1742894461/avatars/lgitn3wbciwcm515y0cb.jpg",
      set: (v) => {
        if (typeof v !== "string") return v;
        const t = v.trim();
        return t === "" ? undefined : t; // ✅ để default áp dụng
      },
    },

    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },

    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female", "other", "unknown"], default: "unknown" },

    occupation: { type: String, trim: true, default: "" },

    // Onboarding
    hasCompletedOnboarding: { type: Boolean, default: false },

    // Preferences nhẹ
    favoriteCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" }
    ],
  },
  { timestamps: true }
);

profileSchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all",
});

module.exports = mongoose.model("Profile", profileSchema);
