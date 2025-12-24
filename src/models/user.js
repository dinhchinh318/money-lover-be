const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");
const bcrypt = require("bcrypt");

// Define user schema
const userSchema = new mongoose.Schema(
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
            required: function () {
                return !this.provider || this.provider === 'local';
            },
        },
        provider: {
            type: String,
            enum: ['local', 'google', 'facebook'],
            default: 'local',
        },
        providerId: {
            type: String,
            default: null,
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
    // If password not changed or user is OAuth user -> continue
    if (!this.isModified("password") || (this.provider && this.provider !== 'local')) {
        return next();
    }

    // Only hash password if it exists and user is local
    if (!this.password) {
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
    if (!this.password) {
        return false;
    }
    return await bcrypt.compare(enteredPassword, this.password);
};

// Add plugin mongoose-delete
userSchema.plugin(mongoose_delete, { overrideMethods: "all" });

// Create model from schema
const User = mongoose.model("User", userSchema);

module.exports = User;