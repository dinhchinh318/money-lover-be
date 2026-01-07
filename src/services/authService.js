const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Profile = require("../models/profile");
const { sendWelcomeEmail, sendResetPasswordEmail } = require("../utils/emailService");
const { seedDefaultCategoriesForUser } = require("../services/categoryService");

const DEFAULT_AVATAR = "https://res.cloudinary.com/dijy8yams/image/upload/v1742894461/avatars/lgitn3wbciwcm515y0cb.jpg";

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
      return { status: false, error: 1, message: "Email existing. Please try another!", data: null };
    }

    if (!userData.avatar) {
      userData.avatar = DEFAULT_AVATAR; // bạn vẫn giữ avatar trong User như cũ
    }

    const user = new User(userData);

    // ✅ PHẢI save user trước để có user._id
    await user.save();

    // ✅ tạo profile (chỉ tạo nếu chưa có)
    const existedProfile = await Profile.findOne({ userId: user._id });
    if (!existedProfile) {
      await Profile.create({
        userId: user._id,
        displayName: user.name || "Người Dùng",
        avatarUrl: user.avatar || DEFAULT_AVATAR,
        // các field khác để default theo schema cũng được
      });
    }

    // (giữ y nguyên các phần bạn đang có)
    // gửi mail (khuyến nghị await, nhưng nếu bạn muốn giữ y chang thì bỏ qua)
    sendWelcomeEmail(user.email, user.name).catch(err => console.log("Send mail error:", err));

    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    await seedDefaultCategoriesForUser(user._id);

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
        refreshToken,
      },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const login = async (email, password) => {
  try {
    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      return { status: false, error: 1, message: "Invalid email or incorrect password!", data: null };
    }

    const isMatch = await user.isPasswordMatch(password);
    if (!isMatch) {
      return { status: false, error: 1, message: "Invalid email or incorrect password!", data: null };
    }

    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    let profile = await Profile.findOne({ userId: user._id });
    if (!profile) {
        profile = await Profile.create({
            userId: user._id,
            displayName: user.name || "Người Dùng",
            avatarUrl: user.avatar || DEFAULT_AVATAR,
        });
    }


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
        address: user.address,

        // ✅ thêm profile cho FE dùng
        profile: profile || null,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

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

const changePassword = async (userId, currentPassword, newPassword) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return {
                status: false,
                error: 1,
                message: "User not found",
                data: null,
            };
        }

        // Verify current password
        const isMatch = await user.isPasswordMatch(currentPassword);
        if (!isMatch) {
            return {
                status: false,
                error: 1,
                message: "Mật khẩu hiện tại không đúng",
                data: null,
            };
        }

        // Validate new password
        if (!newPassword || newPassword.length < 6) {
            return {
                status: false,
                error: 1,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự",
                data: null,
            };
        }

        // Update password
        user.password = newPassword;
        await user.save();

        return {
            status: true,
            error: 0,
            message: "Đổi mật khẩu thành công",
            data: null,
        };
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: error.message || "Error changing password",
            data: null,
        };
    }
};

const loginWithGoogle = async (googleProfile) => {
    try {
        const { id: googleId, emails, displayName, photos } = googleProfile;
        const email = emails && emails[0] ? emails[0].value : null;
        const name = displayName || 'User';
        const avatar = photos && photos[0] ? photos[0].value : null;

        if (!email) {
            return {
                status: false,
                error: 1,
                message: "Không thể lấy email từ tài khoản Google",
                data: null,
            };
        }

        // Tìm user theo email hoặc providerId
        let user = await User.findOne({
            $or: [
                { email: email },
                { providerId: googleId, provider: 'google' }
            ]
        });

        if (user) {
            // Nếu user tồn tại nhưng chưa có providerId, cập nhật
            if (user.provider !== 'google' || !user.providerId) {
                user.provider = 'google';
                user.providerId = googleId;
                if (avatar && !user.avatar) {
                    user.avatar = avatar;
                }
                await user.save();
            }
        } else {
            // Tạo user mới
            const defaultAvatar = avatar || "https://res.cloudinary.com/dijy8yams/image/upload/v1742894461/avatars/lgitn3wbciwcm515y0cb.jpg";
            user = new User({
                name,
                email,
                avatar: defaultAvatar,
                provider: 'google',
                providerId: googleId,
                password: null, // OAuth users không cần password
                isActive: true,
            });
            await user.save();
        }

        // Tạo tokens
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
            message: "Đăng nhập bằng Google thành công!",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                phone: user.phone,
                address: user.address,
            },
            accessToken,
            refreshToken,
        };
    } catch (error) {
        console.error("Google login error:", error);
        return {
            status: false,
            error: -1,
            message: error.message || "Lỗi đăng nhập bằng Google",
            data: null,
        };
    }
};

module.exports = {
    getAccount, login, logout, register, refreshAccessToken, forgotPassword, verifyOTP, resetPassword, changePassword, loginWithGoogle
}