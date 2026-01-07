// server.js - UPDATED FINAL VERSION
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// Database connection
const connection = require("./configs/DB"); 

// Routes
const initRoute = require("./routes/index");

const port = process.env.PORT || 8080;
const app = express();

// ==========================================
// SECURITY & PERFORMANCE MIDDLEWARES
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false, // Tắt CSP nếu cần cho development
}));
app.use(compression());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined")); // Production logging
}

// ==========================================
// CORS CONFIGURATION
// ==========================================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  process.env.FRONTEND_URL, // Thêm URL frontend từ env
].filter(Boolean); // Loại bỏ undefined

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "delay"],
    credentials: true,
  })
);

// ==========================================
// BODY PARSER
// ==========================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==========================================
// GLOBAL RATE LIMITER
// ==========================================
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100, // 100 requests per window
  message: {
    success: false,
    error: 1,
    message: "Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit cho health check
  skip: (req) => req.path === '/health'
});

app.use("/v1/api", globalLimiter);

// ==========================================
// ROUTES INITIALIZATION
// ==========================================
initRoute(app);

// ==========================================
// ROOT ENDPOINT
// ==========================================
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Money Lover API',
    version: '2.0.0',
    documentation: '/v1/api',
    health: '/health',
    features: {
      aiChatbot: !!process.env.GEMINI_API_KEY,
      spendingAnalysis: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    },
    endpoints: {
      api: '/v1/api',
      chat: '/v1/api/chat',
      analysis: '/v1/api/analysis',
      transactions: '/v1/api/transaction',
      budgets: '/v1/api/budget'
    }
  });
});

// ==========================================
// ERROR HANDLING
// ==========================================

// Handle CORS errors
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 1,
      message: 'CORS policy: Origin not allowed',
      origin: req.headers.origin
    });
  }
  next(err);
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 1,
      message: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 1,
      message: 'Invalid ID format',
      field: err.path
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 1,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 1,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.code || -1,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { 
      stack: err.stack,
      details: err 
    }),
  });
});

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 1,
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
    suggestion: "Check API documentation at /v1/api"
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================
const startServer = async () => {
  try {
    // Connect to database
    await connection();
    console.log('✓ Database connected successfully');

    // Start server
    app.listen(port, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 Money Lover API Server Started');
      console.log('='.repeat(50));
      console.log(`📍 Port: ${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 URL: http://localhost:${port}`);
      console.log(`📚 API Docs: http://localhost:${port}/v1/api`);
      console.log(`💚 Health Check: http://localhost:${port}/health`);
      
      // AI Service status
      console.log('\n' + '-'.repeat(50));
      console.log('🤖 AI SERVICE STATUS');
      console.log('-'.repeat(50));
      if (process.env.GEMINI_API_KEY) {
        console.log('✓ Google Gemini: CONFIGURED');
        console.log(`  Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`);
        console.log(`  Rate Limit: ${process.env.GEMINI_RATE_LIMIT_RPM || 15} requests/minute`);
        console.log(`  Endpoints:`);
        console.log(`    - Chat: /v1/api/chat`);
        console.log(`    - Analysis: /v1/api/analysis`);
        console.log(`    - AI Suggestions: /v1/api/ai`);
      } else {
        console.log('⚠ Google Gemini: NOT CONFIGURED');
        console.log('  Add GEMINI_API_KEY to .env to enable AI features');
        console.log('  Get API key: https://aistudio.google.com/app/apikey');
      }
      
      console.log('\n' + '='.repeat(50));
      console.log('✓ Server is ready to accept connections');
      console.log('='.repeat(50) + '\n');
    });
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ ERROR STARTING SERVER');
    console.error('='.repeat(50));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(50) + '\n');
    process.exit(1);
  }
};

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = app;