const mongoose = require("mongoose");
const crypto = require("crypto");

const groupInviteSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    token: { type: String, required: true, unique: true, index: true },

    inviteeUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    inviteeEmail: { type: String, default: null, lowercase: true, trim: true, index: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

groupInviteSchema.statics.newToken = function () {
  return crypto.randomBytes(16).toString("hex");
};

groupInviteSchema.index({ groupId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("GroupInvite", groupInviteSchema);
