// server.js
require("dotenv").config();

const express = require("express");
const connection = require("./configs/db");
const initRoute = require("./routes/index");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// --- CÁC ROUTES ---
// Lưu ý: Nếu chưa tạo file ai.routes.js hoặc analysis.routes.js, hãy comment lại để tránh lỗi crash
// const aiRoutes = require("./routes/ai.routes");
const chatRoutes = require("./routes/chat.routes");
// const analysisRoutes = require("./routes/analysis.routes");

const port = process.env.PORT || 8080;
const app = express();

// Security / perf
app.use(helmet());
app.use(compression());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://money-lover-be-eyca.onrender.com",
      "https://moneylover-iota.vercel.app/login",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "delay"],
    credentials: true,
  })
);

// Body limit
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global rate limit
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: "Too many requests from this IP",
});
app.use("/api", limiter);

// Rate limit riêng cho AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 20, // 20 requests/phút (Gemini Free Tier là 15 RPM, nên để 15-20 là an toàn)
  message: "Too many AI requests, please try again later",
});

// --- API ROUTES ---
// app.use("/api/ai", aiLimiter, aiRoutes); // Bỏ comment khi có file routes/ai.routes.js
app.use("/api/chat", aiLimiter, chatRoutes);
// app.use("/api/analysis", aiLimiter, analysisRoutes); // Bỏ comment khi có file routes/analysis.routes.js

// Các route khác của hệ thống
initRoute(app);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    // Cập nhật: Kiểm tra Gemini Key
    aiEnabled: !!process.env.GEMINI_API_KEY,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const startServer = async () => {
  try {
    await connection();
    app.listen(port, () => {
      console.log(`App is listening on port: ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

      // Cập nhật: Log trạng thái Gemini
      if (process.env.GEMINI_API_KEY) {
        console.log("AI Service: Google Gemini (Configured)");
      } else {
        console.log("AI Service: Not configured (Missing GEMINI_API_KEY)");
      }
    });
  } catch (error) {
    console.log("Error starting server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
