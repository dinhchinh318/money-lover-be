// models/chatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  intent: {
    type: String,
    enum: [
      'QUERY_BALANCE',
      'QUERY_SPENDING',
      'QUERY_BUDGET',
      'ADD_TRANSACTION',
      'ANALYZE_SPENDING',
      'COMPARE_PERIODS',
      'GET_INSIGHTS',
      'GET_FORECAST',
      'ALERT_SETUP',
      'GENERAL_CHAT',
      'UNKNOWN'
    ]
  },
  metadata: {
    // Lưu thông tin bổ sung từ AI
    confidence: Number,
    extractedData: mongoose.Schema.Types.Mixed,
    processingTime: Number
  },
  relatedTransactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  relatedBudgets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Budget'
  }],
  responseGenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh
chatMessageSchema.index({ userId: 1, createdAt: -1 });
chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

// Virtual để lấy context
chatMessageSchema.virtual('conversationContext').get(function() {
  return {
    messageId: this._id,
    timestamp: this.createdAt,
    role: this.role,
    intent: this.intent
  };
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);