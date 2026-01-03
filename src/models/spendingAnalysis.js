// models/spendingAnalysis.js
const mongoose = require('mongoose');

const spendingAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  analysisType: {
    type: String,
    enum: [
      'MONTHLY_SUMMARY',
      'CATEGORY_BREAKDOWN',
      'TREND_ANALYSIS',
      'ANOMALY_DETECTION',
      'FORECAST',
      'COMPARISON',
      'INSIGHTS'
    ],
    required: true
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  data: {
    // Summary data
    totalIncome: Number,
    totalExpense: Number,
    netSavings: Number,
    
    // Category breakdown
    categoryBreakdown: [{
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      },
      categoryName: String,
      amount: Number,
      percentage: Number,
      transactionCount: Number
    }],
    
    // Trends
    trends: [{
      date: Date,
      amount: Number,
      type: String // income/expense
    }],
    
    // Anomalies
    anomalies: [{
      date: Date,
      amount: Number,
      categoryId: mongoose.Schema.Types.ObjectId,
      reason: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      }
    }],
    
    // Forecast
    forecast: [{
      date: Date,
      predictedAmount: Number,
      confidence: Number
    }],
    
    // Comparison
    comparison: {
      previousPeriod: mongoose.Schema.Types.Mixed,
      change: Number,
      changePercentage: Number
    }
  },
  insights: [{
    type: {
      type: String,
      enum: [
        'OVERSPENDING',
        'SAVING_OPPORTUNITY',
        'UNUSUAL_PATTERN',
        'BUDGET_ALERT',
        'POSITIVE_TREND',
        'NEGATIVE_TREND',
        'RECOMMENDATION'
      ]
    },
    title: String,
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    actionable: Boolean,
    suggestedAction: String,
    relatedCategories: [String],
    impact: Number // Potential savings or impact amount
  }],
  generatedBy: {
    type: String,
    enum: ['AI', 'SYSTEM', 'USER_REQUEST'],
    default: 'SYSTEM'
  },
  aiModel: String, // e.g., 'gpt-4', 'claude-sonnet-4'
  processingTime: Number,
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true
});

// Index
spendingAnalysisSchema.index({ userId: 1, analysisType: 1, createdAt: -1 });
spendingAnalysisSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
spendingAnalysisSchema.methods.addInsight = function(insight) {
  this.insights.push(insight);
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  this.insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

spendingAnalysisSchema.methods.getTopCategories = function(limit = 5) {
  return this.data.categoryBreakdown
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
};

module.exports = mongoose.model('SpendingAnalysis', spendingAnalysisSchema);