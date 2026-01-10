const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: { 
    type: String, trim: true, default: "" 
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    validate: {
      validator: async function (catId) {
        const cat = await mongoose.model("Category").findById(catId);
        return cat && cat.type === "expense";
      },
      message: "Budget chỉ áp dụng cho category expense"
    }
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
    default: null
  },
  limit_amount: { 
    type: Number, required: true, min: 0 
  },
  period: {
    type: String,
    enum: ["monthly", "weekly", "yearly", "custom"],
    default: "monthly"
  },
  start_date: { 
    type: Date, default: null 
  },
  end_date: { 
    type: Date, default: null 
  },
  description: { 
    type: String, default: "" 
  }
}, { timestamps: true });

budgetSchema.index({ userId: 1, category: 1, wallet: 1, period: 1, start_date: -1 });

budgetSchema.pre("save", function (next) {
  if (this.period === "custom") {
    if (!this.start_date || !this.end_date) {
      return next(new Error("Budget period=custom phải có start_date và end_date"));
    }
    if (this.start_date > this.end_date) {
      return next(new Error("start_date phải <= end_date"));
    }
  }
  next();
});


budgetSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: "all"
});

module.exports = mongoose.model("Budget", budgetSchema);
