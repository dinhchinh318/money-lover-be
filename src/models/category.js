const mongoose = require('mongoose');
const mongoose_delete = require('mongoose-delete');

const categorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["expense", "income"],
      required: true,
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    icon: {
      type: String,
      default: "default",
    },
    is_default: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Chống tạo vòng lặp parent
categorySchema.pre("save", async function (next) {
  if (!this.parent_id) return next();

  let parent = await mongoose.model("Category").findById(this.parent_id);
  while (parent) {
    if (parent._id.equals(this._id)) {
      return next(new Error("Không thể tạo vòng lặp category"));
    }
    parent = parent.parent_id
      ? await mongoose.model("Category").findById(parent.parent_id)
      : null;
  }
  next();
});

categorySchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("Category", categorySchema);