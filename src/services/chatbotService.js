// services/chatbotService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ChatbotService {
  constructor() {
    // Khởi tạo Google Gemini
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
- ALERT_SETUP: Cài đặt cảnh báo
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
}`;

      // Cấu hình Model
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt 
      });

      // Chuyển đổi lịch sử chat sang định dạng Gemini
      const chatHistory = conversationHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: chatHistory
      });

      const result = await chat.sendMessage(message);
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
${JSON.stringify(userData, null, 2)}

Nhiệm vụ của bạn:
1. Trả lời các câu hỏi về tài chính cá nhân
2. Cung cấp insights về chi tiêu
3. Đưa ra lời khuyên tài chính
4. Giúp người dùng quản lý ngân sách tốt hơn
5. Phân tích xu hướng chi tiêu

Phong cách:
- Thân thiện, dễ hiểu
- Sử dụng tiếng Việt
- Cung cấp số liệu cụ thể khi có
- Đưa ra gợi ý thực tế`;

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt 
      });

      const chatHistory = conversationHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: chatHistory
      });

      const result = await chat.sendMessage(message);
      return result.response.text();

    } catch (error) {
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
      "type": "OVERSPENDING/SAVING_OPPORTUNITY/UNUSUAL_PATTERN/etc",
      "title": "Tiêu đề insight",
      "description": "Mô tả chi tiết",
      "priority": "high/medium/low",
      "actionable": true/false,
      "suggestedAction": "Hành động đề xuất",
      "relatedCategories": ["category1", "category2"],
      "impact": 100000
    }
  ],
  "summary": "Tóm tắt tổng quan",
  "topSpendingCategories": ["category1", "category2"],
  "trends": "Xu hướng chi tiêu",
  "recommendations": ["Gợi ý 1", "Gợi ý 2"]
}`;

      const dataPrompt = `
Dữ liệu giao dịch:
${JSON.stringify(transactionData, null, 2)}

Dữ liệu ngân sách:
${JSON.stringify(budgetData, null, 2)}

Dữ liệu danh mục:
${JSON.stringify(categoryData, null, 2)}

Hãy phân tích và đưa ra insights.`;

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
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
        topSpendingCategories: [],
        trends: '',
        recommendations: []
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Dự đoán chi tiêu tương lai
   */
  async forecastSpending(historicalData, period = 'month') {
    try {
      const systemPrompt = `Bạn là chuyên gia dự báo tài chính.
Dựa trên dữ liệu lịch sử, dự đoán chi tiêu trong tương lai.

Trả về JSON format:
{
  "forecast": [
    {
      "date": "YYYY-MM-DD",
      "predictedAmount": 1000000,
      "confidence": 0.85,
      "breakdown": {
        "category1": 300000,
        "category2": 200000
      }
    }
  ],
  "method": "Phương pháp dự đoán",
  "factors": ["Yếu tố 1", "Yếu tố 2"],
  "warnings": ["Cảnh báo nếu có"]
}`;

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt 
      });

      const result = await model.generateContent(
        `Dữ liệu lịch sử:\n${JSON.stringify(historicalData, null, 2)}\n\nDự đoán cho khoảng thời gian: ${period}`
      );
      
      const content = result.response.text();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        forecast: [],
        method: 'AI prediction',
        factors: [],
        warnings: []
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Phát hiện chi tiêu bất thường
   */
  async detectAnomalies(recentTransactions, historicalAverage) {
    try {
      const systemPrompt = `Phát hiện các giao dịch bất thường so với mức chi tiêu trung bình.
      
Trả về JSON format:
{
  "anomalies": [
    {
      "transactionId": "id",
      "date": "YYYY-MM-DD",
      "amount": 1000000,
      "category": "category_name",
      "reason": "Lý do bất thường",
      "severity": "high/medium/low",
      "recommendation": "Gợi ý xử lý"
    }
  ],
  "summary": "Tóm tắt"
}`;

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt 
      });

      const result = await model.generateContent(
        `Giao dịch gần đây:\n${JSON.stringify(recentTransactions, null, 2)}\n\nMức trung bình:\n${JSON.stringify(historicalAverage, null, 2)}`
      );

      const content = result.response.text();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { anomalies: [], summary: '' };

    } catch (error) {
      throw error;
    }
  }
}

// Đổi tên export khớp với tên file chatbotService
module.exports = new ChatbotService();