const mongoose = require("mongoose");
const crypto = require("crypto");

const groupInviteSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    token: { type: String, required: true},

    inviteeUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    inviteeEmail: { type: String, default: null, lowercase: true, trim: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "revoked", "expired"],
      default: "pending",
    },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

groupInviteSchema.statics.newToken = function () {
  return crypto.randomBytes(16).toString("hex");
};

groupInviteSchema.index({ token: 1 }, { unique: true });

groupInviteSchema.index({ groupId: 1, status: 1, expiresAt: 1 });

groupInviteSchema.index({ inviteeUserId: 1 });
groupInviteSchema.index({ inviteeEmail: 1 });

groupInviteSchema.index(
  { groupId: 1, inviteeUserId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
      inviteeUserId: { $exists: true, $ne: null },
    },
  }
);

groupInviteSchema.index(
  { groupId: 1, inviteeEmail: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
      inviteeEmail: { $exists: true, $ne: null },
    },
  }
);

module.exports = mongoose.model("GroupInvite", groupInviteSchema);
