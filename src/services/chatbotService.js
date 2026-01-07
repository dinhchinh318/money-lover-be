// services/chatbotService.js - WITH FALLBACK MECHANISM
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/chatMessage');
const ChatSession = require('../models/chatSession');
const Transaction = require('../models/transaction');
const Budget = require('../models/budget');
const Category = require('../models/category');
const Wallet = require('../models/wallet');

class ChatbotService {
  constructor() {
    // Khởi tạo Google Gemini
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Danh sách models theo thứ tự ưu tiên
    this.models = [
      'gemini-2.5-flash',      // Model chính
      'gemini-2.0-flash',      // Fallback 1
      'gemini-2.0-flash-001'   // Fallback 2
    ];
    
    this.currentModelIndex = 0;
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
  }

  /**
   * Lấy model hiện tại
   */
  getCurrentModel() {
    return this.models[this.currentModelIndex];
  }

  /**
   * Chuyển sang model tiếp theo
   */
  switchToNextModel() {
    if (this.currentModelIndex < this.models.length - 1) {
      this.currentModelIndex++;
      console.log(`🔄 Switched to fallback model: ${this.getCurrentModel()}`);
      return true;
    }
    return false;
  }

  /**
   * Reset về model chính
   */
  resetToMainModel() {
    this.currentModelIndex = 0;
  }

  /**
   * Retry với exponential backoff và fallback
   */
  async retryWithBackoffAndFallback(fn, retries = this.maxRetries, attempt = 1) {
    const currentModel = this.getCurrentModel();
    
    try {
      console.log(`🤖 Attempting with model: ${currentModel} (attempt ${attempt})`);
      return await fn(currentModel);
      
    } catch (error) {
      const isOverloaded = error.status === 503;
      const isNotFound = error.status === 404;
      const hasRetriesLeft = retries > 0;
      const canFallback = this.currentModelIndex < this.models.length - 1;

      // Nếu model không tồn tại (404), chuyển sang model khác ngay
      if (isNotFound && canFallback) {
        console.log(`❌ Model ${currentModel} not found (404)`);
        this.switchToNextModel();
        return this.retryWithBackoffAndFallback(fn, this.maxRetries, 1);
      }

      // Nếu model bị overload (503)
      if (isOverloaded) {
        if (hasRetriesLeft) {
          // Retry với cùng model sau khi delay
          const delay = this.baseRetryDelay * Math.pow(2, this.maxRetries - retries);
          console.log(`⚠️ Model ${currentModel} overloaded (503). Retrying in ${delay}ms... (${retries} retries left)`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.retryWithBackoffAndFallback(fn, retries - 1, attempt + 1);
          
        } else if (canFallback) {
          // Hết retries, chuyển sang model khác
          console.log(`⚠️ Max retries reached for ${currentModel}. Switching to next model...`);
          this.switchToNextModel();
          return this.retryWithBackoffAndFallback(fn, this.maxRetries, 1);
        }
      }

      // Nếu không thể retry hoặc fallback, throw error
      console.error(`❌ All models failed or error is not recoverable:`, error.message);
      throw error;
    }
  }

  /**
   * Xử lý tin nhắn chính
   */
  async handleMessage(userId, message, sessionId = null) {
    const startTime = Date.now();
    
    try {
      // Reset về model chính cho mỗi request mới
      this.resetToMainModel();

      // 1. Tạo hoặc lấy session
      let session = sessionId 
        ? await ChatSession.findById(sessionId)
        : await this.createNewSession(userId);

      if (!session) {
        session = await this.createNewSession(userId);
      }

      // 2. Lưu tin nhắn của user
      const userMessage = await ChatMessage.create({
        userId,
        sessionId: session._id,
        role: 'user',
        content: message
      });

      // 3. Lấy lịch sử hội thoại
      const conversationHistory = await this.getConversationHistory(session._id, 10);

      // 4. Phân tích intent với Gemini
      const intentAnalysis = await this.analyzeIntent(message, conversationHistory);

      // Update intent vào user message
      userMessage.intent = intentAnalysis.intent;
      userMessage.metadata = {
        confidence: intentAnalysis.confidence,
        extractedData: intentAnalysis.extractedData
      };
      await userMessage.save();

      // 5. Lấy dữ liệu tài chính
      const userData = await this.getUserFinancialData(userId, intentAnalysis.extractedData);

      // 6. Xử lý theo intent
      let responseContent = '';
      let relatedData = {};

      switch (intentAnalysis.intent) {
        case 'QUERY_BALANCE':
          relatedData = await this.handleBalanceQuery(userId);
          responseContent = await this.generateBalanceResponse(relatedData);
          break;

        case 'QUERY_SPENDING':
          relatedData = await this.handleSpendingQuery(userId, intentAnalysis.extractedData);
          responseContent = await this.generateSpendingResponse(relatedData);
          break;

        case 'QUERY_BUDGET':
          relatedData = await this.handleBudgetQuery(userId, intentAnalysis.extractedData);
          responseContent = await this.generateBudgetResponse(relatedData);
          break;

        case 'ADD_TRANSACTION':
          relatedData = await this.handleAddTransaction(userId, intentAnalysis.extractedData);
          responseContent = await this.generateTransactionAddedResponse(relatedData);
          break;

        case 'ANALYZE_SPENDING':
        case 'GET_INSIGHTS':
          relatedData = await this.handleSpendingAnalysis(userId, intentAnalysis.extractedData);
          responseContent = await this.generateAnalysisResponse(relatedData);
          break;

        default:
          // General chat - sử dụng Gemini với context
          responseContent = await this.generateChatResponse(message, userData, conversationHistory);
      }

      // 7. Lưu tin nhắn phản hồi
      const assistantMessage = await ChatMessage.create({
        userId,
        sessionId: session._id,
        role: 'assistant',
        content: responseContent,
        intent: intentAnalysis.intent,
        metadata: {
          processingTime: Date.now() - startTime,
          model: this.getCurrentModel()
        },
        relatedTransactions: relatedData.transactions || [],
        relatedBudgets: relatedData.budgets || [],
        responseGenerated: true
      });

      // 8. Update session
      await ChatSession.findByIdAndUpdate(session._id, {
        lastMessage: responseContent.substring(0, 100),
        lastMessageAt: new Date()
      });

      return {
        sessionId: session._id,
        message: responseContent,
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        relatedData,
        processingTime: Date.now() - startTime,
        modelUsed: this.getCurrentModel()
      };

    } catch (error) {
      console.error('Chatbot Service Error:', error);
      throw error;
    }
  }

  /**
   * Phân tích intent từ tin nhắn người dùng
   */
  async analyzeIntent(message, conversationHistory = []) {
    try {
      const systemPrompt = `Bạn là trợ lý tài chính thông minh của ứng dụng Money Lover.
Nhiệm vụ: Phân tích ý định (intent) của người dùng và trích xuất thông tin.

Các intent có thể có:
- QUERY_BALANCE: Hỏi về số dư tài khoản
- QUERY_SPENDING: Hỏi về chi tiêu
- QUERY_BUDGET: Hỏi về ngân sách
- ADD_TRANSACTION: Thêm giao dịch mới
- ANALYZE_SPENDING: Yêu cầu phân tích chi tiêu
- COMPARE_PERIODS: So sánh các khoảng thời gian
- GET_INSIGHTS: Xem insights/gợi ý
- GET_FORECAST: Dự đoán chi tiêu
- GENERAL_CHAT: Chat chung chung
- UNKNOWN: Không xác định được

Trả về JSON format:
{
  "intent": "INTENT_TYPE",
  "confidence": 0.95,
  "extractedData": {
    "amount": number,
    "category": "string",
    "date": "YYYY-MM-DD",
    "period": "day/week/month/year",
    "timeRange": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    }
  },
  "response": "Phản hồi ngắn gọn bằng tiếng Việt"
}

VÍ DỤ:
Input: "Tôi đã chi bao nhiêu tuần này?"
Output: {"intent":"QUERY_SPENDING","confidence":0.95,"extractedData":{"period":"week"},"response":"Tôi sẽ kiểm tra chi tiêu tuần này của bạn."}

Input: "Thêm chi tiêu 50k cho cà phê"
Output: {"intent":"ADD_TRANSACTION","confidence":0.98,"extractedData":{"amount":50000,"category":"cà phê"},"response":"Tôi sẽ thêm 50,000 VNĐ cho cà phê."}`;

      const result = await this.retryWithBackoffAndFallback(async (modelName) => {
        const model = this.genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: systemPrompt 
        });

        const chatHistory = conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history: chatHistory });
        return await chat.sendMessage(message);
      });

      const content = result.response.text();
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        intent: 'UNKNOWN',
        confidence: 0.5,
        extractedData: {},
        response: content
      };

    } catch (error) {
      console.error('AI Intent Analysis Error:', error);
      throw error;
    }
  }

  /**
   * Tạo phản hồi chatbot với context tài chính
   */
  async generateChatResponse(message, userData, conversationHistory = []) {
    try {
      const systemPrompt = `Bạn là trợ lý tài chính cá nhân thông minh của Money Lover.
      
Thông tin người dùng hiện tại:
- Tổng số dư: ${this.formatCurrency(userData.totalBalance || 0)}
- Thu nhập: ${this.formatCurrency(userData.totalIncome || 0)}
- Chi tiêu: ${this.formatCurrency(userData.totalExpense || 0)}
- Tiết kiệm: ${this.formatCurrency(userData.netSavings || 0)}

Nhiệm vụ:
1. Trả lời câu hỏi về tài chính cá nhân
2. Cung cấp insights về chi tiêu
3. Đưa ra lời khuyên tài chính thực tế
4. Giúp quản lý ngân sách tốt hơn

Phong cách:
- Thân thiện, dễ hiểu
- Tiếng Việt tự nhiên
- Số liệu cụ thể khi có
- Gợi ý thực tế, ngắn gọn (2-3 câu)`;

      const result = await this.retryWithBackoffAndFallback(async (modelName) => {
        const model = this.genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: systemPrompt 
        });

        const chatHistory = conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history: chatHistory });
        return await chat.sendMessage(message);
      });

      return result.response.text();

    } catch (error) {
      console.error('AI Chat Response Error:', error);
      throw error;
    }
  }

  /**
   * Phân tích chi tiêu và tạo insights
   */
  async analyzeSpendingPatterns(transactionData, budgetData, categoryData) {
    try {
      const systemPrompt = `Bạn là chuyên gia phân tích tài chính cá nhân.
Phân tích dữ liệu chi tiêu và đưa ra insights chi tiết.

Trả về JSON format:
{
  "insights": [
    {
      "type": "OVERSPENDING/SAVING_OPPORTUNITY/UNUSUAL_PATTERN/RECOMMENDATION",
      "title": "Tiêu đề insight",
      "description": "Mô tả chi tiết",
      "priority": "high/medium/low",
      "actionable": true/false,
      "suggestedAction": "Hành động đề xuất",
      "impact": 100000
    }
  ],
  "summary": "Tóm tắt tổng quan",
  "recommendations": ["Gợi ý 1", "Gợi ý 2"]
}`;

      const summarized = this.summarizeTransactions(transactionData);
      
      const dataPrompt = `Phân tích dữ liệu sau:

Giao dịch (${transactionData.length} giao dịch):
${JSON.stringify(summarized, null, 2)}

Ngân sách (${budgetData.length} budgets):
${JSON.stringify(budgetData.slice(0, 5), null, 2)}

Danh mục:
${JSON.stringify(categoryData.map(c => ({name: c.name, type: c.type})), null, 2)}

Hãy phân tích và đưa ra insights.`;

      const result = await this.retryWithBackoffAndFallback(async (modelName) => {
        const model = this.genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: systemPrompt 
        });

        return await model.generateContent(dataPrompt);
      });

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
      console.error('AI Spending Analysis Error:', error);
      throw error;
    }
  }

  /**
   * Tạo session mới
   */
  async createNewSession(userId) {
    return await ChatSession.create({
      userId,
      status: 'active',
      title: 'Cuộc trò chuyện mới',
      lastMessageAt: new Date()
    });
  }

  /**
   * Lấy lịch sử hội thoại
   */
  async getConversationHistory(sessionId, limit = 10) {
    const messages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages.reverse().map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Lấy dữ liệu tài chính của user
   */
  async getUserFinancialData(userId, extractedData = {}) {
    const { timeRange, period } = extractedData;
    
    let startDate, endDate;
    if (timeRange) {
      startDate = new Date(timeRange.start);
      endDate = new Date(timeRange.end);
    } else {
      endDate = new Date();
      startDate = this.getStartDateByPeriod(period || 'month');
    }

    const [wallets, transactions, budgets, categories] = await Promise.all([
      Wallet.find({ userId, is_archived: false }).lean(),
      Transaction.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate }
      }).populate('category').lean(),
      Budget.find({ userId }).populate('category').lean(),
      Category.find({ userId }).lean()
    ]);

    const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      userId,
      period: { startDate, endDate },
      wallets,
      totalBalance,
      transactions,
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      budgets,
      categories
    };
  }

  /**
   * Xử lý query số dư
   */
  async handleBalanceQuery(userId) {
    const wallets = await Wallet.find({ userId, is_archived: false }).lean();
    const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    return {
      wallets,
      totalBalance,
      currency: 'VND'
    };
  }

  /**
   * Xử lý query chi tiêu
   */
  async handleSpendingQuery(userId, extractedData) {
    const userData = await this.getUserFinancialData(userId, extractedData);
    
    const spendingByCategory = {};
    userData.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const catName = t.category?.name || 'Khác';
        spendingByCategory[catName] = (spendingByCategory[catName] || 0) + t.amount;
      });

    return {
      period: userData.period,
      totalExpense: userData.totalExpense,
      transactionCount: userData.transactions.filter(t => t.type === 'expense').length,
      spendingByCategory,
      transactions: userData.transactions.filter(t => t.type === 'expense')
    };
  }

  /**
   * Xử lý query ngân sách
   */
  async handleBudgetQuery(userId, extractedData) {
    const budgets = await Budget.find({ userId }).populate('category').lean();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const budgetStatus = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await Transaction.aggregate([
          {
            $match: {
              user: userId,
              category: budget.category._id,
              type: 'expense',
              date: { $gte: monthStart, $lte: monthEnd }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]);

        const spentAmount = spent[0]?.total || 0;
        
        return {
          budget,
          spent: spentAmount,
          remaining: budget.limit_amount - spentAmount,
          percentage: (spentAmount / budget.limit_amount) * 100,
          status: spentAmount > budget.limit_amount ? 'exceeded' : 
                  spentAmount > budget.limit_amount * 0.8 ? 'warning' : 'normal'
        };
      })
    );

    return {
      budgets: budgetStatus,
      totalBudget: budgets.reduce((sum, b) => sum + b.limit_amount, 0),
      totalSpent: budgetStatus.reduce((sum, b) => sum + b.spent, 0)
    };
  }

  /**
   * Xử lý thêm giao dịch
   */
  async handleAddTransaction(userId, extractedData) {
    const { amount, category, date, note } = extractedData;
    
    let categoryId = null;
    if (category) {
      const categories = await Category.find({ userId }).lean();
      const foundCategory = categories.find(c => 
        c.name.toLowerCase().includes(category.toLowerCase())
      );
      categoryId = foundCategory?._id;
    }

    const wallets = await Wallet.find({ userId, is_archived: false }).lean();
    const defaultWallet = wallets[0];

    if (!defaultWallet) {
      throw new Error('Không tìm thấy ví nào');
    }

    const transaction = await Transaction.create({
      user: userId,
      wallet: defaultWallet._id,
      category: categoryId,
      amount: amount || 0,
      type: 'expense',
      date: date || new Date(),
      note: note || 'Thêm qua chatbot'
    });

    return { transaction, wallet: defaultWallet };
  }

  /**
   * Xử lý phân tích chi tiêu
   */
  async handleSpendingAnalysis(userId, extractedData) {
    const userData = await this.getUserFinancialData(userId, extractedData);
    
    const analysis = await this.analyzeSpendingPatterns(
      userData.transactions,
      userData.budgets,
      userData.categories
    );

    return { ...userData, analysis };
  }

  /**
   * Generate responses
   */
  async generateBalanceResponse(data) {
    return `Tổng số dư của bạn hiện tại là: ${this.formatCurrency(data.totalBalance)}\n\n` +
           `Chi tiết theo ví:\n` +
           data.wallets.map(w => `• ${w.name}: ${this.formatCurrency(w.balance || 0)}`).join('\n');
  }

  async generateSpendingResponse(data) {
    const topCategories = Object.entries(data.spendingByCategory)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    return `Tổng chi tiêu của bạn: ${this.formatCurrency(data.totalExpense)}\n` +
           `Số giao dịch: ${data.transactionCount}\n\n` +
           `Top danh mục chi tiêu:\n` +
           topCategories.map(([cat, amount]) => 
             `• ${cat}: ${this.formatCurrency(amount)}`
           ).join('\n');
  }

  async generateBudgetResponse(data) {
    return `Tổng ngân sách: ${this.formatCurrency(data.totalBudget)}\n` +
           `Đã chi: ${this.formatCurrency(data.totalSpent)}\n\n` +
           `Chi tiết:\n` +
           data.budgets.map(b => 
             `• ${b.budget.name || b.budget.category?.name}: ${this.formatCurrency(b.spent)}/${this.formatCurrency(b.budget.limit_amount)} ` +
             `(${b.percentage.toFixed(1)}%) - ${b.status === 'exceeded' ? '⚠️ Vượt' : '✅'}`
           ).join('\n');
  }

  async generateTransactionAddedResponse(data) {
    return `✅ Đã thêm giao dịch thành công!\n\n` +
           `Số tiền: ${this.formatCurrency(data.transaction.amount)}\n` +
           `Ví: ${data.wallet.name}\n` +
           `Ngày: ${new Date(data.transaction.date).toLocaleDateString('vi-VN')}`;
  }

  async generateAnalysisResponse(data) {
    const analysis = data.analysis;
    
    let response = `📊 Phân tích chi tiêu của bạn:\n\n`;
    response += `${analysis.summary}\n\n`;
    
    if (analysis.insights && analysis.insights.length > 0) {
      response += `💡 Insights quan trọng:\n`;
      analysis.insights.slice(0, 3).forEach((insight, idx) => {
        response += `${idx + 1}. ${insight.title}\n`;
        response += `   ${insight.description}\n\n`;
      });
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      response += `🎯 Khuyến nghị:\n`;
      analysis.recommendations.forEach((rec, idx) => {
        response += `${idx + 1}. ${rec}\n`;
      });
    }

    return response;
  }

  /**
   * Helper functions
   */
  getStartDateByPeriod(period) {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.setHours(0, 0, 0, 0));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setMonth(now.getMonth() - 1));
    }
  }

  summarizeTransactions(transactions) {
    if (!transactions || transactions.length === 0) return [];

    const byCategory = {};
    transactions.forEach(t => {
      const cat = t.category?.name || 'Khác';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          category: cat,
          count: 0,
          totalAmount: 0,
          transactions: []
        };
      }
      byCategory[cat].count += 1;
      byCategory[cat].totalAmount += t.amount;
      byCategory[cat].transactions.push({
        date: t.date,
        amount: t.amount
      });
    });

    return Object.values(byCategory).map(cat => ({
      ...cat,
      transactions: cat.transactions.slice(0, 3) // Chỉ lấy 3 transactions mẫu
    }));
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  }
}

module.exports = new ChatbotService();