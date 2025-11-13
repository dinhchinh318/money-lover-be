const jwt = require("jsonwebtoken");
const User = require("../models/user");

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json(
                {
                    status: false,
                    error: -1,
                    message: "Can not found token",
                    data: null
                }
            );
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                status: false,
                error: -1,
                message: "Người dùng không tồn tại",
                data: null,
            });
        }
        if (!user.isActive) {
            return res.status(401).json({
                status: false,
                error: -1,
                message: "Tài khoản đã bị vô hiệu hóa",
                data: null,
            });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            status: false,
            error: -1,
            message: "Token không hợp lệ hoặc đã hết hạn",
            data: null,
        });
    }
}
module.exports = { verifyToken }