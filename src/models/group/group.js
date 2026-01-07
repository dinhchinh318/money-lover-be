const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    avatar: { type: String, default: null },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

groupSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("Group", groupSchema);
