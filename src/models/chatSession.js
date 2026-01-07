const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Cuộc trò chuyện mới' },
  status: { 
    type: String, 
    enum: ['active', 'archived', 'deleted'],
    default: 'active' 
  },
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

chatSessionSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);