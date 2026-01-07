// controllers/analysisController.js
const spendingAnalysisService = require('../services/spendingAnalysisService');
const SpendingAnalysis = require('../models/spendingAnalysis');

const analysisController = {
  /**
   * POST /api/analysis/spending
   * Tạo phân tích chi tiêu
   */
  async analyzeSpending(req, res) {
    try {
      const userId = req.user._id;
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp startDate và endDate'
        });
      }

      const analysis = await spendingAnalysisService.createComprehensiveAnalysis(
        userId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      console.error('Analyze Spending Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi phân tích chi tiêu',
        error: error.message
      });
    }
  },

  /**
   * GET /api/analysis/insights
   * Lấy insights gần nhất
   */
  async getInsights(req, res) {
    try {
      const userId = req.user._id;

      const insights = await spendingAnalysisService.getInsights(userId);

      res.json({
        success: true,
        data: insights
      });

    } catch (error) {
      console.error('Get Insights Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy insights',
        error: error.message
      });
    }
  },

  /**
   * POST /api/analysis/forecast
   * Dự đoán chi tiêu
   */
  async getForecast(req, res) {
    try {
      const userId = req.user._id;
      const { period = 'month' } = req.body;

      const forecast = await spendingAnalysisService.forecastSpending(
        userId,
        period
      );

      res.json({
        success: true,
        data: forecast
      });

    } catch (error) {
      console.error('Get Forecast Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi dự đoán chi tiêu',
        error: error.message
      });
    }
  },

  /**
   * POST /api/analysis/compare
   * So sánh 2 khoảng thời gian
   */
  async comparePeriods(req, res) {
    try {
      const userId = req.user._id;
      const { 
        period1Start, 
        period1End, 
        period2Start, 
        period2End 
      } = req.body;

      if (!period1Start || !period1End || !period2Start || !period2End) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp đầy đủ thông tin 2 khoảng thời gian'
        });
      }

      const comparison = await spendingAnalysisService.comparePeriods(
        userId,
        new Date(period1Start),
        new Date(period1End),
        new Date(period2Start),
        new Date(period2End)
      );

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      console.error('Compare Periods Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi so sánh các khoảng thời gian',
        error: error.message
      });
    }
  },

  /**
   * GET /api/analysis/history
   * Lấy lịch sử các analysis
   */
  async getAnalysisHistory(req, res) {
    try {
      const userId = req.user._id;
      const { 
        page = 1, 
        limit = 20, 
        analysisType 
      } = req.query;

      const query = { userId };
      if (analysisType) {
        query.analysisType = analysisType;
      }

      const analyses = await SpendingAnalysis.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await SpendingAnalysis.countDocuments(query);

      res.json({
        success: true,
        data: {
          analyses,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get Analysis History Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch sử phân tích',
        error: error.message
      });
    }
  },

  /**
   * GET /api/analysis/:analysisId
   * Lấy chi tiết một analysis
   */
  async getAnalysisDetail(req, res) {
    try {
      const userId = req.user._id;
      const { analysisId } = req.params;

      const analysis = await SpendingAnalysis.findOne({
        _id: analysisId,
        userId
      }).lean();

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy analysis'
        });
      }

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      console.error('Get Analysis Detail Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy chi tiết analysis',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/analysis/:analysisId
   * Xóa một analysis
   */
  async deleteAnalysis(req, res) {
    try {
      const userId = req.user._id;
      const { analysisId } = req.params;

      const analysis = await SpendingAnalysis.findOneAndDelete({
        _id: analysisId,
        userId
      });

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy analysis'
        });
      }

      res.json({
        success: true,
        message: 'Đã xóa analysis thành công'
      });

    } catch (error) {
      console.error('Delete Analysis Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa analysis',
        error: error.message
      });
    }
  },

  /**
   * GET /api/analysis/quick/monthly
   * Quick analysis cho tháng hiện tại
   */
  async getMonthlyQuickAnalysis(req, res) {
    try {
      const userId = req.user._id;
      
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const analysis = await spendingAnalysisService.createComprehensiveAnalysis(
        userId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      console.error('Monthly Quick Analysis Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo phân tích tháng',
        error: error.message
      });
    }
  }
};

module.exports = analysisController;