const mongoose = require('mongoose');
const mongoose = require('mongoose-delete');

const categorySchema = new mongoose.Schema(
  {
    user: {
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

CategorySchema.plugin(mongoose_delete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("Category", categorySchema);