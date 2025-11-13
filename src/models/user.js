const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");
const bcrypt = require("bcrypt");

// Define user schema
const userSchema = new mongoose.Schema (
    {
        name:
        {
            type: String,
            required: true,
        },
        address: String,
        email:
        {
            type: String,
            required: true,
            unique: true,
        },
        password:
        {
            type: String,
            required: true,
        },
        phone: String,
        role:
        {
            type: String,
            default: "user",
        },
        refreshToken:
        {
            type: String,
            default: null,
        },
        isActive:
        {
            type: Boolean,
            default: true,
        },
        avatar: String,
        description: String,
        otp: String,
        otpExpires: Date,
    },
    {
        timestamps: true,
    }
);

// Middleware "pre-save": Autosave Password before save
userSchema.pre("save", async function (next) {
    // If password not changed -> continue
    if (!this.isModified("password")) {
        return next();
    }

    try {
        // Create salt string
        const salt = await bcrypt.genSalt(10);
        // Hash password
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Add check-password method
userSchema.methods.isPasswordMatch = async function (enteredPassword) {
    return await bcrypt.compare(endterdPassword, this.password);
};

// Add plugin mongoose-delete
userSchema.plugin(mongoose_delete, { overrideMethods: "all"});

// Create model from schema
const User = mongoose.model("User", userSchema);

module.exports = User;