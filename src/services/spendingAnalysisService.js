// services/spendingAnalysisService.js
const SpendingAnalysis = require('../models/spendingAnalysis');
const aiService = require('./aiService');
const transactionService = require('./transactionService');
const budgetService = require('./budgetService');
const categoryService = require('./categoryService');

class SpendingAnalysisService {
  /**
   * Tạo phân tích chi tiêu tổng hợp
   */
  async createComprehensiveAnalysis(userId, startDate, endDate) {
    const startTime = Date.now();

    try {
      // 1. Lấy dữ liệu
      const [transactions, budgets, categories] = await Promise.all([
        transactionService.getTransactionsByDateRange(userId, startDate, endDate),
        budgetService.getBudgetsByUserId(userId),
        categoryService.getCategoriesByUserId(userId)
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

      // 7. Sử dụng AI để tạo insights
      const aiInsights = await aiService.analyzeSpendingPatterns(
        transactions,
        budgets,
        categories
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
        aiModel: 'gemini-1.5-flash',
        processingTime: Date.now() - startTime,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      return analysis;

    } catch (error) {
      console.error('Spending Analysis Error:', error);
      throw error;
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
      expenseTransactionCount: expense.length,
      averageIncome: income.length > 0 ? 
        income.reduce((sum, t) => sum + t.amount, 0) / income.length : 0,
      averageExpense: expense.length > 0 ?
        expense.reduce((sum, t) => sum + t.amount, 0) / expense.length : 0
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

    // Tính tổng theo category
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const catId = t.categoryId?.toString();
      if (catId && categoryMap.has(catId)) {
        const cat = categoryMap.get(catId);
        cat.amount += t.amount;
        cat.transactionCount += 1;
      }
    });

    // Chuyển sang array và tính percentage
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
    // Tính trung bình và std deviation
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .map(t => t.amount);

    if (expenses.length < 3) {
      return []; // Không đủ data để phát hiện anomaly
    }

    const mean = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const variance = expenses.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / expenses.length;
    const stdDev = Math.sqrt(variance);

    // Threshold: 2 standard deviations
    const threshold = mean + (2 * stdDev);

    const anomalies = transactions
      .filter(t => t.type === 'expense' && t.amount > threshold)
      .map(t => ({
        date: t.date,
        amount: t.amount,
        categoryId: t.categoryId,
        reason: `Cao hơn ${((t.amount - mean) / mean * 100).toFixed(0)}% so với trung bình`,
        severity: t.amount > mean + (3 * stdDev) ? 'high' : 'medium'
      }));

    return anomalies;
  }

  /**
   * So sánh với kỳ trước
   */
  async compareWithPreviousPeriod(userId, startDate, endDate, currentMetrics) {
    const duration = endDate - startDate;
    const previousStart = new Date(startDate - duration);
    const previousEnd = new Date(startDate);

    const previousTransactions = await transactionService.getTransactionsByDateRange(
      userId,
      previousStart,
      previousEnd
    );

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
  }

  /**
   * Dự đoán chi tiêu
   */
  async forecastSpending(userId, period = 'month') {
    try {
      // Lấy dữ liệu lịch sử (3 tháng gần nhất)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);

      const historicalTransactions = await transactionService.getTransactionsByDateRange(
        userId,
        startDate,
        endDate
      );

      // Chuẩn bị dữ liệu cho AI
      const monthlyData = this.groupByMonth(historicalTransactions);

      // Sử dụng AI để dự đoán
      const forecast = await aiService.forecastSpending(monthlyData, period);

      // Lưu forecast
      const analysis = await SpendingAnalysis.create({
        userId,
        analysisType: 'FORECAST',
        period: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        data: {
          forecast: forecast.forecast
        },
        insights: [{
          type: 'RECOMMENDATION',
          title: 'Dự đoán chi tiêu',
          description: forecast.method,
          priority: 'medium',
          actionable: true
        }],
        generatedBy: 'AI',
        aiModel: 'gemini-1.5-flash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      return analysis;

    } catch (error) {
      console.error('Forecast Error:', error);
      throw error;
    }
  }

  /**
   * Lấy insights tổng hợp
   */
  async getInsights(userId) {
    try {
      // Lấy analysis gần nhất
      const recentAnalysis = await SpendingAnalysis.findOne({
        userId,
        analysisType: { $in: ['MONTHLY_SUMMARY', 'INSIGHTS'] }
      })
      .sort({ createdAt: -1 })
      .lean();

      if (!recentAnalysis) {
        // Tạo analysis mới nếu chưa có
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        
        return await this.createComprehensiveAnalysis(userId, startDate, endDate);
      }

      return recentAnalysis;

    } catch (error) {
      console.error('Get Insights Error:', error);
      throw error;
    }
  }

  /**
   * Helper: Group transactions by month
   */
  groupByMonth(transactions) {
    const monthlyData = {};

    transactions.forEach(t => {
      const month = new Date(t.date).toISOString().substring(0, 7); // YYYY-MM
      
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

  /**
   * So sánh 2 khoảng thời gian
   */
  async comparePeriods(userId, period1Start, period1End, period2Start, period2End) {
    const [transactions1, transactions2] = await Promise.all([
      transactionService.getTransactionsByDateRange(userId, period1Start, period1End),
      transactionService.getTransactionsByDateRange(userId, period2Start, period2End)
    ]);

    const metrics1 = this.calculateBasicMetrics(transactions1);
    const metrics2 = this.calculateBasicMetrics(transactions2);

    const categories1 = this.analyzeCategoryBreakdown(transactions1, 
      await categoryService.getCategoriesByUserId(userId));
    const categories2 = this.analyzeCategoryBreakdown(transactions2,
      await categoryService.getCategoriesByUserId(userId));

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
}

module.exports = new SpendingAnalysisService();