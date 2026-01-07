const mongoose = require("mongoose");

const groupCategorySchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Types.ObjectId, ref: "Group", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["income", "expense"], required: true, index: true },

    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

groupCategorySchema.index({ groupId: 1, name: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model("GroupCategory", groupCategorySchema);
