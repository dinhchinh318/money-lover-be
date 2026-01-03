// routes/analysis.routes.js
const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

/**
 * Analysis endpoints
 */

// Tạo analysis
router.post('/spending', analysisController.analyzeSpending);

// Insights
router.get('/insights', analysisController.getInsights);

// Forecast
router.post('/forecast', analysisController.getForecast);

// Compare periods
router.post('/compare', analysisController.comparePeriods);

// Analysis history
router.get('/history', analysisController.getAnalysisHistory);
router.get('/:analysisId', analysisController.getAnalysisDetail);
router.delete('/:analysisId', analysisController.deleteAnalysis);

// Quick analysis
router.get('/quick/monthly', analysisController.getMonthlyQuickAnalysis);

module.exports = router;