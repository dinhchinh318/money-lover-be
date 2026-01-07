<<<<<<< HEAD
// routes/index.js - UPDATED VERSION
const express = require('express');
const rateLimit = require('express-rate-limit');

// Existing routes
const authRoute = require("./auth.routes");
const walletRoute = require("./wallet.routes");
const categoryRoute = require("./category.routes");
const transactionRoute = require("./transaction.routes");
const reportRoute = require("./report.routes");
const analyticsRoute = require("./analytics.routes");
const budgetRoute = require("./budget.routes");
const recurringBillRoute = require("./recurringBill.routes");
const savingGoalRoute = require("./savingGoal.routes");
const settingRoute = require("./setting.routes");
const profileRoute = require("./profile.routes");
const notificationRoute = require("./notification.routes");

// ===== NEW: AI & CHATBOT ROUTES =====
const aiRoute = require("./ai.routes");
const chatRoute = require("./chat.routes");
const analysisRoute = require("./analysis.routes");

// ===== AI RATE LIMITER =====
// Giới hạn riêng cho AI endpoints để tránh vượt quota Gemini
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: parseInt(process.env.GEMINI_RATE_LIMIT_RPM, 10) || 15, // 15 requests/phút cho free tier
  message: {
    success: false,
    error: 1,
    message: 'Quá nhiều yêu cầu AI. Vui lòng thử lại sau 1 phút.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit nếu là development và muốn test
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && process.env.SKIP_AI_RATE_LIMIT === 'true';
  }
});

const initRoute = (app) => {
  // ===== HEALTH CHECK ENDPOINT =====
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date(),
      version: '2.0.0',
      features: {
        aiChatbot: !!process.env.GEMINI_API_KEY,
        spendingAnalysis: !!process.env.GEMINI_API_KEY,
        aiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
      },
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // ===== API INFO ENDPOINT =====
  app.get('/v1/api', (req, res) => {
    res.json({
      name: 'Money Lover API',
      version: '2.0.0',
      description: 'Personal Finance Management with AI Chatbot',
      endpoints: {
        auth: '/v1/api/auth',
        wallet: '/v1/api/wallet',
        category: '/v1/api/category',
        transaction: '/v1/api/transaction',
        budget: '/v1/api/budget',
        recurringBill: '/v1/api/recurring-bill',
        savingGoal: '/v1/api/saving-goal',
        report: '/v1/api/report',
        analytics: '/v1/api/analytics',
        setting: '/v1/api/setting',
        profile: '/v1/api/profile',
        notification: '/v1/api/notification',
        // New AI endpoints
        ai: '/v1/api/ai',
        chat: '/v1/api/chat',
        analysis: '/v1/api/analysis'
      },
      aiFeatures: {
        enabled: !!process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL,
        rateLimit: {
          requests: parseInt(process.env.GEMINI_RATE_LIMIT_RPM, 10) || 15,
          window: '1 minute'
        }
      }
    });
  });

  // ===== EXISTING ROUTES =====
  app.use("/v1/api/auth", authRoute);
  app.use("/v1/api/wallet", walletRoute);
  app.use("/v1/api/category", categoryRoute);
  app.use("/v1/api/transaction", transactionRoute);
  app.use("/v1/api/budget", budgetRoute);
  app.use("/v1/api/recurring-bill", recurringBillRoute);
  app.use("/v1/api/saving-goal", savingGoalRoute);
  app.use("/v1/api/report", reportRoute);
  app.use("/v1/api/analytics", analyticsRoute);
  app.use("/v1/api/setting", settingRoute);
  app.use("/v1/api/profile", profileRoute);
  app.use("/v1/api/notification", notificationRoute);

  // ===== NEW: AI & CHATBOT ROUTES (với rate limiter riêng) =====
  app.use("/v1/api/ai", aiLimiter, aiRoute);
  app.use("/v1/api/chat", aiLimiter, chatRoute);
  app.use("/v1/api/analysis", aiLimiter, analysisRoute);

  // ===== 404 HANDLER cho API routes =====
  app.use('/v1/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: 1,
      message: `API endpoint không tồn tại: ${req.originalUrl}`,
      availableEndpoints: [
        '/v1/api/auth',
        '/v1/api/wallet',
        '/v1/api/transaction',
        '/v1/api/budget',
        '/v1/api/chat',
        '/v1/api/analysis'
      ],
      suggestion: 'Xem danh sách đầy đủ tại /v1/api'
    });
  });
=======
const authRoute = require("../routes/auth.routes");
const walletRoute = require("../routes/wallet.routes");
const categoryRoute = require("../routes/category.routes");
const transactionRoute = require("../routes/transaction.routes");
const reportRoute = require("../routes/report.routes");
const analyticsRoute = require("../routes/analytics.routes");
const budgetRoute = require("../routes/budget.routes");
const recurringBillRoute = require("../routes/recurringBill.routes");
const savingGoalRoute = require("../routes/savingGoal.routes");
const settingRoute = require("../routes/setting.routes");
const profileRoute = require("../routes/profile.routes");
const notificationRoute = require("../routes/notification.routes");
const uploadRoutes = require("./upload.routes");

const initRoute = (app) => {
    app.use("/v1/api/auth", authRoute);
    app.use("/v1/api/wallet", walletRoute);
    app.use("/v1/api/category", categoryRoute);
    app.use("/v1/api/transaction", transactionRoute);
    app.use("/v1/api/budget", budgetRoute);
    app.use("/v1/api/recurring-bill", recurringBillRoute);
    app.use("/v1/api/saving-goal", savingGoalRoute);
    app.use("/v1/api/report", reportRoute);
    app.use("/v1/api/analytics", analyticsRoute);
    app.use("/v1/api/setting", settingRoute);
    app.use("/v1/api/profile", profileRoute);
    app.use("/v1/api/notification", notificationRoute);
    app.use("/v1/api/upload", uploadRoutes);

>>>>>>> 9920827 (fix: vercel)
}

module.exports = initRoute;