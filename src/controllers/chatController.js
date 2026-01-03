// controllers/chatController.js
const chatbotService = require('../services/chatbotService');
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');

const chatController = {
  /**
   * POST /api/chat/message
   * Gửi tin nhắn đến chatbot
   */
  async sendMessage(req, res) {
    try {
      const userId = req.user._id; // Từ auth middleware
      const { message, sessionId } = req.body;

      if (!message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Tin nhắn không được để trống'
        });
      }

      const response = await chatbotService.handleMessage(
        userId,
        message,
        sessionId
      );

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Send Message Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý tin nhắn',
        error: error.message
      });
    }
  },

  /**
   * GET /api/chat/sessions
   * Lấy danh sách sessions của user
   */
  async getSessions(req, res) {
    try {
      const userId = req.user._id;
      const { page = 1, limit = 20, status = 'active' } = req.query;

      const sessions = await ChatSession.find({ 
        userId,
        status 
      })
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await ChatSession.countDocuments({ userId, status });

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get Sessions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách sessions',
        error: error.message
      });
    }
  },

  /**
   * GET /api/chat/session/:sessionId
   * Lấy chi tiết một session
   */
  async getSessionDetail(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;

      const session = await ChatSession.findOne({
        _id: sessionId,
        userId
      }).lean();

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy session'
        });
      }

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      console.error('Get Session Detail Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy chi tiết session',
        error: error.message
      });
    }
  },

  /**
   * GET /api/chat/history/:sessionId
   * Lấy lịch sử chat của một session
   */
  async getChatHistory(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Verify session belongs to user
      const session = await ChatSession.findOne({
        _id: sessionId,
        userId
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy session'
        });
      }

      const messages = await ChatMessage.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('relatedTransactions', 'amount type date')
        .populate('relatedBudgets', 'name amount')
        .lean();

      const total = await ChatMessage.countDocuments({ sessionId });

      res.json({
        success: true,
        data: {
          messages,
          session,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get Chat History Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch sử chat',
        error: error.message
      });
    }
  },

  /**
   * POST /api/chat/session/new
   * Tạo session mới
   */
  async createNewSession(req, res) {
    try {
      const userId = req.user._id;
      const { title } = req.body;

      const session = await ChatSession.create({
        userId,
        title: title || 'Cuộc trò chuyện mới',
        status: 'active'
      });

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      console.error('Create Session Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo session mới',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/chat/session/:sessionId
   * Cập nhật session (title, status)
   */
  async updateSession(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;
      const { title, status } = req.body;

      const session = await ChatSession.findOneAndUpdate(
        { _id: sessionId, userId },
        { 
          ...(title && { title }),
          ...(status && { status })
        },
        { new: true }
      );

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy session'
        });
      }

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      console.error('Update Session Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật session',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/chat/session/:sessionId
   * Xóa session
   */
  async deleteSession(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;

      // Xóa session
      const session = await ChatSession.findOneAndDelete({
        _id: sessionId,
        userId
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy session'
        });
      }

      // Xóa tất cả messages của session
      await ChatMessage.deleteMany({ sessionId });

      res.json({
        success: true,
        message: 'Đã xóa session thành công'
      });

    } catch (error) {
      console.error('Delete Session Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa session',
        error: error.message
      });
    }
  },

  /**
   * POST /api/chat/quick-query
   * Quick query không cần session (cho các câu hỏi đơn giản)
   */
  async quickQuery(req, res) {
    try {
      const userId = req.user._id;
      const { query } = req.body;

      if (!query || query.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Query không được để trống'
        });
      }

      // Tạo temporary session
      const response = await chatbotService.handleMessage(userId, query);

      res.json({
        success: true,
        data: {
          answer: response.message,
          intent: response.intent,
          confidence: response.confidence
        }
      });

    } catch (error) {
      console.error('Quick Query Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý query',
        error: error.message
      });
    }
  }
};

module.exports = chatController;