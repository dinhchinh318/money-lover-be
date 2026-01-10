// services/spendingAnalysisService.js - UPDATED VERSION
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SpendingAnalysis = require('../models/spendingAnalysis');
const Transaction = require('../models/transaction');
const Budget = require('../models/budget');
const Category = require('../models/category');

class SpendingAnalysisService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Tạo phân tích chi tiêu tổng hợp
   */
  async createComprehensiveAnalysis(userId, startDate, endDate) {
    const startTime = Date.now();

    try {
      // 1. Lấy dữ liệu
      const [transactions, budgets, categories] = await Promise.all([
        Transaction.find({
          user: userId,
          date: { $gte: startDate, $lte: endDate }
        }).populate('category').lean(),
        Budget.find({ userId }).populate('category').lean(),
        Category.find({ userId }).lean()
      ]);

      // 2. Tính toán metrics cơ bản
      const metrics = this.calculateBasicMetrics(transactions);

      // 3. Phân tích theo category
      const categoryBreakdown = this.analyzeCategoryBreakdown(transactions, categories);

      // 4. Phân tích trend
      const trends = this.analyzeTrends(transactions);

      // 5. Phát hiện anomalies
      const anomalies = await this.detectAnomalies(transactions);

      // 6. So sánh với kỳ trước
      const comparison = await this.compareWithPreviousPeriod(
        userId, 
        startDate, 
        endDate, 
        metrics
      );

      // 7. Sử dụng Gemini để tạo insights
      const aiInsights = await this.generateAIInsights(
        transactions,
        budgets,
        categoryBreakdown,
        comparison
      );

      // 8. Lưu analysis
      const analysis = await SpendingAnalysis.create({
        userId,
        analysisType: 'MONTHLY_SUMMARY',
        period: { startDate, endDate },
        data: {
          totalIncome: metrics.totalIncome,
          totalExpense: metrics.totalExpense,
          netSavings: metrics.netSavings,
          categoryBreakdown,
          trends,
          anomalies,
          comparison
        },
        insights: aiInsights.insights || [],
        generatedBy: 'AI',
        aiModel: this.model,
        processingTime: Date.now() - startTime,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      return analysis;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate AI Insights với Gemini
   */
  async generateAIInsights(transactions, budgets, categoryBreakdown, comparison) {
    try {
      const systemPrompt = `Bạn là chuyên gia phân tích tài chính cá nhân.
Phân tích dữ liệu chi tiêu và đưa ra insights chi tiết, thực tế.

Trả về JSON format:
{
  "insights": [
    {
      "type": "OVERSPENDING/SAVING_OPPORTUNITY/UNUSUAL_PATTERN/BUDGET_ALERT/POSITIVE_TREND/NEGATIVE_TREND/RECOMMENDATION",
      "title": "Tiêu đề ngắn gọn",
      "description": "Mô tả chi tiết với số liệu cụ thể",
      "priority": "high/medium/low",
      "actionable": true/false,
      "suggestedAction": "Hành động cụ thể người dùng nên làm",
      "relatedCategories": ["category1"],
      "impact": 100000
    }
  ],
  "summary": "Tóm tắt tổng quan về tình hình tài chính (2-3 câu)",
  "recommendations": ["Gợi ý cụ thể 1", "Gợi ý cụ thể 2"]
}

YÊU CẦU:
- Insights phải CỤ THỂ với SỐ LIỆU
- Gợi ý phải THỰC TẾ, có thể THỰC HIỆN được
- Ưu tiên insights có IMPACT cao
- Tối thiểu 3 insights, tối đa 7`;

      const dataPrompt = `Phân tích dữ liệu chi tiêu:

📊 TỔNG QUAN:
- Tổng giao dịch: ${transactions.length}
- Chi tiêu: ${transactions.filter(t => t.type === 'expense').length}
- Thu nhập: ${transactions.filter(t => t.type === 'income').length}

💰 CHI TIÊU THEO DANH MỤC (Top 10):
${categoryBreakdown.slice(0, 10).map(c => 
  `- ${c.categoryName}: ${c.amount.toLocaleString('vi-VN')} VNĐ (${c.percentage.toFixed(1)}%, ${c.transactionCount} giao dịch)`
).join('\n')}

📈 SO SÁNH KỲ TRƯỚC:
${comparison ? `
- Chi tiêu kỳ trước: ${comparison.previousPeriod?.totalExpense?.toLocaleString('vi-VN')} VNĐ
- Thay đổi: ${comparison.change?.toLocaleString('vi-VN')} VNĐ (${comparison.changePercentage?.toFixed(1)}%)
- Xu hướng: ${comparison.trend}
` : 'Chưa có dữ liệu so sánh'}

💳 NGÂN SÁCH:
${budgets.map(b => 
  `- ${b.category?.name || b.name}: ${b.limit_amount?.toLocaleString('vi-VN')} VNĐ/tháng`
).join('\n')}

Hãy phân tích và đưa ra insights CỤ THỂ, THỰC TẾ.`;

      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        systemInstruction: systemPrompt 
      });

      const result = await model.generateContent(dataPrompt);
      const content = result.response.text();
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        insights: [],
        summary: content,
        recommendations: []
      };

    } catch (error) {
      console.error('AI Insights Generation Error:', error);
      return {
        insights: [],
        summary: 'Không thể tạo insights lúc này',
        recommendations: []
      };
    }
  }

  /**
   * Tính toán metrics cơ bản
   */
  calculateBasicMetrics(transactions) {
    const income = transactions.filter(t => t.type === 'income');
    const expense = transactions.filter(t => t.type === 'expense');

    return {
      totalIncome: income.reduce((sum, t) => sum + t.amount, 0),
      totalExpense: expense.reduce((sum, t) => sum + t.amount, 0),
      netSavings: income.reduce((sum, t) => sum + t.amount, 0) - 
                  expense.reduce((sum, t) => sum + t.amount, 0),
      incomeTransactionCount: income.length,
      expenseTransactionCount: expense.length
    };
  }

  /**
   * Phân tích theo category
   */
  analyzeCategoryBreakdown(transactions, categories) {
    const categoryMap = new Map();
    
    categories.forEach(cat => {
      categoryMap.set(cat._id.toString(), {
        categoryId: cat._id,
        categoryName: cat.name,
        amount: 0,
        transactionCount: 0
      });
    });

    transactions.filter(t => t.type === 'expense').forEach(t => {
      const catId = t.category?._id?.toString();
      if (catId && categoryMap.has(catId)) {
        const cat = categoryMap.get(catId);
        cat.amount += t.amount;
        cat.transactionCount += 1;
      }
    });

    const totalExpense = Array.from(categoryMap.values())
      .reduce((sum, cat) => sum + cat.amount, 0);

    return Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        percentage: totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Phân tích trend theo ngày
   */
  analyzeTrends(transactions) {
    const dailyData = new Map();

    transactions.forEach(t => {
      const dateKey = new Date(t.date).toISOString().split('T')[0];
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, { date: dateKey, income: 0, expense: 0 });
      }

      const day = dailyData.get(dateKey);
      if (t.type === 'income') {
        day.income += t.amount;
      } else {
        day.expense += t.amount;
      }
    });

    return Array.from(dailyData.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Phát hiện anomalies
   */
  async detectAnomalies(transactions) {
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .map(t => t.amount);

    if (expenses.length < 3) return [];

    const mean = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const variance = expenses.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / expenses.length;
    const stdDev = Math.sqrt(variance);
    const threshold = mean + (2 * stdDev);

    const anomalies = transactions
      .filter(t => t.type === 'expense' && t.amount > threshold)
      .map(t => ({
        date: t.date,
        amount: t.amount,
        categoryId: t.category?._id,
        reason: `Cao hơn ${((t.amount - mean) / mean * 100).toFixed(0)}% so với trung bình`,
        severity: t.amount > mean + (3 * stdDev) ? 'high' : 'medium'
      }));

    return anomalies;
  }

  /**
   * So sánh với kỳ trước
   */
  async compareWithPreviousPeriod(userId, startDate, endDate, currentMetrics) {
    try {
      const duration = endDate - startDate;
      const previousStart = new Date(startDate - duration);
      const previousEnd = new Date(startDate);

      const previousTransactions = await Transaction.find({
        user: userId,
        date: { $gte: previousStart, $lte: previousEnd }
      }).lean();

      const previousMetrics = this.calculateBasicMetrics(previousTransactions);

      const expenseChange = currentMetrics.totalExpense - previousMetrics.totalExpense;
      const expenseChangePercentage = previousMetrics.totalExpense > 0
        ? (expenseChange / previousMetrics.totalExpense) * 100
        : 0;

      return {
        previousPeriod: {
          startDate: previousStart,
          endDate: previousEnd,
          totalIncome: previousMetrics.totalIncome,
          totalExpense: previousMetrics.totalExpense,
          netSavings: previousMetrics.netSavings
        },
        change: expenseChange,
        changePercentage: expenseChangePercentage,
        trend: expenseChange > 0 ? 'increasing' : 
               expenseChange < 0 ? 'decreasing' : 'stable'
      };
    } catch (error) {
      console.error('Comparison error:', error);
      return null;
    }
  }

  /**
   * Dự đoán chi tiêu
   */
  async forecastSpending(userId, period = 'month') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate }
      }).populate('category').lean();

      const monthlyData = this.groupByMonth(transactions);

      // Sử dụng Gemini để dự đoán
      const systemPrompt = `Bạn là chuyên gia dự báo tài chính.
Dựa trên dữ liệu lịch sử, dự đoán chi tiêu trong tương lai.

Trả về JSON format:
{
  "forecast": [
    {
      "date": "YYYY-MM-DD",
      "predictedAmount": 1000000,
      "confidence": 0.85
    }
  ],
  "method": "Phương pháp dự đoán",
  "factors": ["Yếu tố 1", "Yếu tố 2"]
}`;

      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        systemInstruction: systemPrompt 
      });

      const result = await model.generateContent(
        `Dữ liệu lịch sử:\n${JSON.stringify(monthlyData, null, 2)}\n\nDự đoán cho: ${period}`
      );

      const content = result.response.text();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const forecast = JSON.parse(jsonMatch[0]);
        
        // Lưu forecast vào DB
        await SpendingAnalysis.create({
          userId,
          analysisType: 'FORECAST',
          period: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          data: { forecast: forecast.forecast },
          insights: [{
            type: 'RECOMMENDATION',
            title: 'Dự đoán chi tiêu',
            description: forecast.method,
            priority: 'medium'
          }],
          generatedBy: 'AI',
          aiModel: this.model,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        return forecast;
      }

      return { forecast: [], method: 'AI prediction', factors: [] };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy insights tổng hợp
   */
  async getInsights(userId) {
    try {
      const recentAnalysis = await SpendingAnalysis.findOne({
        userId,
        analysisType: { $in: ['MONTHLY_SUMMARY', 'INSIGHTS'] }
      })
      .sort({ createdAt: -1 })
      .lean();

      if (!recentAnalysis) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        
        return await this.createComprehensiveAnalysis(userId, startDate, endDate);
      }

      return recentAnalysis;

    } catch (error) {
      throw error;
    }
  }

  /**
   * So sánh 2 khoảng thời gian
   */
  async comparePeriods(userId, period1Start, period1End, period2Start, period2End) {
    const [transactions1, transactions2] = await Promise.all([
      Transaction.find({
        user: userId,
        date: { $gte: period1Start, $lte: period1End }
      }).populate('category').lean(),
      Transaction.find({
        user: userId,
        date: { $gte: period2Start, $lte: period2End }
      }).populate('category').lean()
    ]);

    const metrics1 = this.calculateBasicMetrics(transactions1);
    const metrics2 = this.calculateBasicMetrics(transactions2);

    const categories = await Category.find({ userId }).lean();
    const categories1 = this.analyzeCategoryBreakdown(transactions1, categories);
    const categories2 = this.analyzeCategoryBreakdown(transactions2, categories);

    return {
      period1: {
        start: period1Start,
        end: period1End,
        metrics: metrics1,
        categories: categories1
      },
      period2: {
        start: period2Start,
        end: period2End,
        metrics: metrics2,
        categories: categories2
      },
      comparison: {
        expenseChange: metrics2.totalExpense - metrics1.totalExpense,
        expenseChangePercent: ((metrics2.totalExpense - metrics1.totalExpense) / 
          metrics1.totalExpense * 100).toFixed(2),
        incomeChange: metrics2.totalIncome - metrics1.totalIncome,
        savingsChange: metrics2.netSavings - metrics1.netSavings
      }
    };
  }

  /**
   * Helper: Group by month
   */
  groupByMonth(transactions) {
    const monthlyData = {};

    transactions.forEach(t => {
      const month = new Date(t.date).toISOString().substring(0, 7);
      
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          income: 0,
          expense: 0,
          transactions: []
        };
      }

      if (t.type === 'income') {
        monthlyData[month].income += t.amount;
      } else {
        monthlyData[month].expense += t.amount;
      }
      
      monthlyData[month].transactions.push(t);
    });

    return Object.values(monthlyData).sort((a, b) => 
      a.month.localeCompare(b.month)
    );
  }
}

module.exports = new SpendingAnalysisService();