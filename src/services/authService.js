const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { sendWelcomeEmail, sendResetPasswordEmail } = require("../utils/emailService");

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: "1h"
    });
}
const generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '7d'
    })
}

const register = async (userData) => {
    try {
        const existingEmail = await User.findOne({ email: userData.email });
        if (existingEmail) {
            return {
                status: false,
                error: 1,
                message: "Email existing. Please try another!",
                data: null
            }
        }
        if (!userData.avatar) {
            userData.avatar = "https://res.cloudinary.com/dijy8yams/image/upload/v1742894461/avatars/lgitn3wbciwcm515y0cb.jpg";
        }
        const user = new User(userData);
        await user.save();

        const emailResult = await sendWelcomeEmail(user.email, user.name);

        if (!emailResult.status) {
            console.log("Lỗi gửi email chào mừng:", emailResult.message);
        }

        const accessToken = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        await user.save();

        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.refreshToken;
        return {
            status: true,
            error: 0,
            message: "Register successfully!",
            data: {
                user: userObj,
                accessToken,
                refreshToken
            }
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message,
            data: null
        };
    }
}
const login = async (email, password) => {
    try {
        const user = await User.findOne({ email });

        if (!user || !user.isActive) {
            return {
                status: false,
                error: 1,
                message: "Invalid email or incorrect password!",
                data: null,
            };
        }
        const isMatch = await user.isPasswordMatch(password);
        if (!isMatch) {
            return {
                status: false,
                error: 1,
                message: "Invalid email or incorrect password!",
                data: null
            }
        }
        const accessToken = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        await user.save();
        return {
            status: true,
            error: 0,
            message: "Login successfully!",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                phone: user.phone,
                address: user.address
            },
            accessToken,
            refreshToken
        }
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message,
            data: null
        }
    }
}
const refreshAccessToken = async (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findOne({
            _id: decoded.id,
            refreshToken: refreshToken,
            isActive: true
        });
        if (!user) {
            return {
                status: false,
                error: 1,
                message: "Invalid refresh token!",
                data: null
            }
        }
        const newAccessToken = generateToken(user._id);
        return {
            status: true,
            error: 0,
            message: "Create new accessToken successfully!",
            data: {
                accessToken: newAccessToken
            }
        }
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: "Invalid or expired refresh token!",
            data: null
        }
    }
}
const logout = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, { refreshToken: null });
        return {
            status: true,
            error: 0,
            message: "Log out successfully!",
            data: null
        }
    } catch (error) {
        return {
            status: false,
            error: 1,
            message: error.message,
            data: null
        }
    }
}
const getAccount = async (userId) => {
    try {
        const user = await User.findById(userId).select("-password");;
        if (!user) {
            return {
                status: false,
                error: 1,
                message: "Can not found this account!",
                data: null,
            }
        }
        return {
            status: true,
            error: 0,
            message: "Get info account successfully!",
            data: {
                user: user
            }
        }
    } catch (error) {
        return {
            status: false,
            error: 0,
            message: error.message,
            data: null
        }
    }
}
const forgotPassword = async (email) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return {
                status: false,
                error: -1,
                message: "Email not existed in system!",
                data: null
            }
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        const emailResult = await sendResetPasswordEmail(
            user.email,
            user.name,
            otp
        );
        if (!emailResult.status) {
            return {
                status: false,
                error: -1,
                message: "Error when sending email",
                data: null
            }
        }
        return {
            status: true,
            error: 1,
            message: "Verify OTP has sent to your email!",
            data: null
        }
    } catch (error) {
        console.log(error);
        return {
            status: false,
            error: -1,
            message: error.message,
            data: null
        }
    }
}

const verifyOTP = async (email, otp) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return {
                status: false,
                error: -1,
                message: "Email not existed in system!",
                data: null,
            }
        }
        if (!user.otp || !user.otpExpires || user.otp != otp || user.otpExpires < Date.now()) {
            return {
                status: false,
                error: -1,
                message: "Invalid OTP or expired!",
                data: null
            }
        }
        return {
            status: true,
            error: 0,
            message: "Send OTP successfully!",
            data: null
        }
    } catch (error) {
        console.log(error);
        return {
            status: false,
            error: -1,
            message: error.message,
            data: null
        }
    }
}
const resetPassword = async (email, newPassword) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return {
                status: false,
                error: -1,
                message: "Email not existed in system!",
                data: null
            }
        }
        user.password = newPassword,
            user.otp = undefined,
            user.otpExpire = undefined,
            await user.save();
        return {
            status: true,
            error: 0,
            message: "Reset password successfully!",
            data: null
        }
    } catch (error) {
        console.log(error);
        return {
            status: false,
            error: -1,
            message: error.message,
            data: null
        }
    }
}
module.exports = {
    getAccount, login, logout, register, refreshAccessToken, forgotPassword, verifyOTP, resetPassword
}