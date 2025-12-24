const { response } = require("express");
const authService = require("../services/authService");
const registerAPI = async (req, res) => {
    try {
        const data = await authService.register(req.body);
        if (data.error === 0) {
            res.cookie("refreshToken", data.data.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000 //7 days
            });
            const { refreshToken, ...responseData } = data.data;
            return res.status(200).json(
                {
                    ...data,
                    data: responseData
                }
            )
        }
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json(
            {
                status: false,
                error: -1,
                message: "Error from server!",
                data: null
            }
        )
    }
}
const loginAPI = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json(
                {
                    status: false,
                    error: 1,
                    message: "Missing login info",
                    data: null
                }
            )
        }
        const data = await authService.login(email, password);
        if (data.error === 0) {
            res.cookie("refreshToken", data.data.refreshToken, {
                httpOnly: true,
                secure: false,
                path: "/",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            const { refreshToken, ...responseData } = data.data;
            return res.status(200).json({
                ...data,
                data: responseData,
            });
        }
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            error: -1,
            message: "Error from server",
            data: null,
        });
    }
}
const refreshAPI = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json(
                {
                    status: false,
                    error: 1,
                    message: "Can not found refresh token!",
                    data: null,
                })
        }
        const data = await authService.refreshAccessToken(refreshToken);
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json(
            {
                status: false,
                error: -1,
                message: "Error from server",
                data: null
            }
        );
    }
}
const logoutAPI = async (req, res) => {
    try {
        const data = await authService.logout(req.user._id);
        res.clearCookie("refreshToken");
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            error: -1,
            message: "error from server",
            data: null,
        });
    }
}
const getAccountAPI = async (req, res) => {
    try {
        const delay = parseInt(req.headers.delay) || 0;
        if (delay > 0 && delay <= 5000) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const data = await authService.getAccount(req.user._id);
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            error: -1,
            message: "error from server",
            data: null,
        });
    }
}

const updateAccountAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const userService = require("../services/userService");
        const updateData = {
            id: userId,
            ...req.body,
        };

        const result = await userService.updateUser(updateData);

        if (result && result.status) {
            return res.status(200).json({
                EC: 0,
                message: result.message || "Updated successfully",
                data: result.data,
            });
        }

        return res.status(200).json({
            EC: result?.error || -1,
            message: result?.message || "Update failed",
            data: null,
        });
    } catch (error) {
        console.error("Error updating account:", error);
        return res.status(500).json({
            EC: -1,
            message: error.message || "Server error",
            data: null,
        });
    }
}

const changePasswordAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                EC: 1,
                message: "Vui lòng nhập đầy đủ mật khẩu",
                data: null,
            });
        }

        const result = await authService.changePassword(userId, currentPassword, newPassword);

        if (result && result.status) {
            return res.status(200).json({
                EC: 0,
                message: result.message || "Changed password successfully",
                data: result.data,
            });
        }

        return res.status(200).json({
            EC: result?.error || -1,
            message: result?.message || "Change password failed",
            data: null,
        });
    } catch (error) {
        console.error("Error changing password:", error);
        return res.status(500).json({
            EC: -1,
            message: error.message || "Server error",
            data: null,
        });
    }
}
const forgotPasswordAPI = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                status: false,
                error: 1,
                message: "Please input your email!",
                data: null
            })
        }
        const data = await authService.forgotPassword(email);
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            error: -1,
            message: "Error from server",
            data: null
        })
    }
}
const verifyOTPAPI = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                status: false,
                error: 1,
                message: "Missing email or otp",
                data: null
            })
        }
        const data = await authService.verifyOTP(email, otp);
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json(
            {
                status: false,
                error: -1,
                message: "Error from server",
                data: null
            }
        )
    }
}
const resetPasswordAPI = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json(
                {
                    status: false,
                    error: 1,
                    message: "Missing email or new password",
                    data: null
                }
            )
        }
        const data = await authService.resetPassword(email, password);
        return res.status(200).json(data);
    } catch (error) {
        console.log(error);
        return res.status(500).json(
            {
                status: false,
                error: -1,
                message: "Error from server",
                data: null
            }
        )
    }
}
const googleLoginAPI = async (req, res) => {
    try {
        // Lấy thông tin từ Google token (đã được verify ở middleware)
        const googleUser = req.googleUser;

        const googleProfile = {
            id: googleUser.id,
            emails: [{ value: googleUser.email }],
            displayName: googleUser.name,
            photos: [{ value: googleUser.picture }],
        };

        const data = await authService.loginWithGoogle(googleProfile);

        if (data.error === 0) {
            res.cookie("refreshToken", data.refreshToken, {
                httpOnly: true,
                secure: false,
                path: "/",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });

            const { refreshToken, ...responseData } = data;
            return res.status(200).json({
                ...responseData,
                data: responseData.data,
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Google login API error:", error);
        return res.status(500).json({
            status: false,
            error: -1,
            message: "Lỗi server khi đăng nhập bằng Google",
            data: null,
        });
    }
};

module.exports = {
    getAccountAPI,
    updateAccountAPI,
    changePasswordAPI,
    logoutAPI,
    loginAPI,
    registerAPI,
    refreshAPI,
    forgotPasswordAPI,
    verifyOTPAPI,
    resetPasswordAPI,
    googleLoginAPI,
}