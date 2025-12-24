const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (req, res, next) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                status: false,
                error: 1,
                message: "Thiếu Google token",
                data: null,
            });
        }

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        // Lưu thông tin Google user vào req để dùng ở controller
        req.googleUser = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            email_verified: payload.email_verified,
        };

        next();
    } catch (error) {
        console.error("Google token verification error:", error);
        return res.status(401).json({
            status: false,
            error: 1,
            message: "Token Google không hợp lệ",
            data: null,
        });
    }
};

module.exports = { verifyGoogleToken };

