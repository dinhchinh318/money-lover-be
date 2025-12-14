require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user");
const Wallet = require("../src/models/wallet");
const Category = require("../src/models/category");
const Transaction = require("../src/models/transaction");

const MONGO_URI = process.env.MONGO_URI;

// Kết nối database
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Kết nối MongoDB thành công!");
  } catch (error) {
    console.error("❌ Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
};

// Xóa dữ liệu cũ (tùy chọn)
const clearData = async () => {
  try {
    await Transaction.deleteMany({});
    await Category.deleteMany({});
    await Wallet.deleteMany({});
    await User.deleteMany({});
    console.log("🗑️  Đã xóa dữ liệu cũ");
  } catch (error) {
    console.error("Lỗi khi xóa dữ liệu:", error);
  }
};

// Tạo dữ liệu test
const seedData = async () => {
  try {
    await connectDB();

    // Hỏi có muốn xóa dữ liệu cũ không
    const args = process.argv.slice(2);
    if (args.includes("--clear")) {
      await clearData();
    }

    console.log("🌱 Bắt đầu chèn dữ liệu test...\n");

    // 1. Tạo User
    const user = new User({
      name: "Nguyễn Văn Test",
      email: "test@example.com",
      password: "123456", // Sẽ được hash tự động
      phone: "0123456789",
      address: "123 Đường Test, Quận 1, TP.HCM",
      role: "user",
      isActive: true,
      avatar: "https://res.cloudinary.com/dijy8yams/image/upload/v1742894461/avatars/lgitn3wbciwcm515y0cb.jpg",
    });
    await user.save();
    console.log("✅ Đã tạo user:", user.email);

    // 2. Tạo Wallets
    const wallet1 = new Wallet({
      userId: user._id,
      name: "Ví tiền mặt",
      type: "cash",
      currency: "VND",
      balance: 5000000,
      is_default: true,
    });
    await wallet1.save();
    console.log("✅ Đã tạo ví:", wallet1.name);

    const wallet2 = new Wallet({
      userId: user._id,
      name: "Tài khoản ngân hàng",
      type: "bank",
      currency: "VND",
      balance: 10000000,
      bankName: "Vietcombank",
      bankAccount: "1234567890",
      bankCode: "VCB",
      is_default: false,
    });
    await wallet2.save();
    console.log("✅ Đã tạo ví:", wallet2.name);

    // 3. Tạo Categories - Income
    const incomeCategories = [
      { name: "Lương", icon: "salary" },
      { name: "Thưởng", icon: "bonus" },
      { name: "Đầu tư", icon: "investment" },
      { name: "Khác", icon: "other" },
    ];

    const createdIncomeCategories = [];
    for (const cat of incomeCategories) {
      const category = new Category({
        userId: user._id,
        name: cat.name,
        type: "income",
        icon: cat.icon,
        is_default: cat.name === "Lương",
      });
      await category.save();
      createdIncomeCategories.push(category);
      console.log(`✅ Đã tạo category (income): ${cat.name}`);
    }

    // 4. Tạo Categories - Expense
    const expenseCategories = [
      { name: "Ăn uống", icon: "food" },
      { name: "Mua sắm", icon: "shopping" },
      { name: "Di chuyển", icon: "transport" },
      { name: "Giải trí", icon: "entertainment" },
      { name: "Hóa đơn", icon: "bills" },
      { name: "Y tế", icon: "health" },
      { name: "Giáo dục", icon: "education" },
      { name: "Khác", icon: "other" },
    ];

    const createdExpenseCategories = [];
    for (const cat of expenseCategories) {
      const category = new Category({
        userId: user._id,
        name: cat.name,
        type: "expense",
        icon: cat.icon,
        is_default: cat.name === "Ăn uống",
      });
      await category.save();
      createdExpenseCategories.push(category);
      console.log(`✅ Đã tạo category (expense): ${cat.name}`);
    }

    // 5. Tạo Transactions - Tạo nhiều dữ liệu cho biểu đồ
    // Tạo dữ liệu rõ ràng cho tháng hiện tại và tháng trước
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    const transactions = [];
    
    console.log(`\n📅 Tạo dữ liệu cho tháng hiện tại: ${currentMonth + 1}/${currentYear}`);
    console.log(`📅 Tạo dữ liệu cho tháng trước: ${currentMonth === 0 ? 12 : currentMonth}/${currentMonth === 0 ? currentYear - 1 : currentYear}`);

    // Helper function để tính ngày đầu tuần (Thứ 2)
    const getWeekStart = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
      return new Date(d.setDate(diff));
    };

    // Tạo dữ liệu cho 7 TUẦN gần nhất (để hiển thị biểu đồ tuần)
    console.log("\n📅 Tạo dữ liệu cho 7 tuần gần nhất...");
    for (let weekOffset = 6; weekOffset >= 0; weekOffset--) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() - (weekOffset * 7));
      const weekStart = getWeekStart(weekDate);
      weekStart.setHours(0, 0, 0, 0);
      
      // Mỗi tuần có 1-2 thu nhập
      if (weekOffset === 0 || weekOffset === 3) {
        // Tuần hiện tại và tuần 3 tuần trước có lương
        transactions.push({
          userId: user._id,
          walletId: wallet1._id,
          categoryId: createdIncomeCategories[0]._id, // Lương
          amount: 15000000 + Math.floor(Math.random() * 2000000),
          type: "income",
          date: new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000), // Thứ 4
          note: `Lương tuần ${weekOffset + 1}`,
        });
      }

      // Mỗi tuần có 3-5 giao dịch chi tiêu (giảm để tăng tốc)
      const expenseCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < expenseCount; i++) {
        const dayOffset = Math.floor(Math.random() * 7);
        const transactionDate = new Date(weekStart);
        transactionDate.setDate(weekStart.getDate() + dayOffset);
        transactionDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
        
        const categoryIndex = Math.floor(Math.random() * createdExpenseCategories.length);
        const category = createdExpenseCategories[categoryIndex];
        const wallet = Math.random() > 0.5 ? wallet1 : wallet2;
        
        let amount = 0;
        if (category.name === "Hóa đơn") {
          amount = 1500000 + Math.floor(Math.random() * 1000000);
        } else if (category.name === "Mua sắm") {
          amount = 200000 + Math.floor(Math.random() * 800000);
        } else if (category.name === "Ăn uống") {
          amount = 50000 + Math.floor(Math.random() * 200000);
        } else if (category.name === "Di chuyển") {
          amount = 30000 + Math.floor(Math.random() * 100000);
        } else {
          amount = 50000 + Math.floor(Math.random() * 500000);
        }

        transactions.push({
          userId: user._id,
          walletId: wallet._id,
          categoryId: category._id,
          amount: amount,
          type: "expense",
          date: transactionDate,
          note: `${category.name} - Tuần ${weekOffset + 1}`,
        });
      }
    }

    // Tạo dữ liệu cho 6 THÁNG gần nhất (để hiển thị biểu đồ tháng)
    console.log("📅 Tạo dữ liệu cho 6 tháng gần nhất...");
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      let year, month;
      if (currentMonth - monthOffset < 0) {
        // Qua năm trước
        year = currentYear - 1;
        month = 12 + (currentMonth - monthOffset);
      } else {
        year = currentYear;
        month = currentMonth - monthOffset;
      }
      
      const monthDate = new Date(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      console.log(`  📆 Tháng ${month + 1}/${year} (${daysInMonth} ngày)`);
      
      // Mỗi tháng có 1 lương vào ngày 1
      const salaryAmount = 15000000 + Math.floor(Math.random() * 3000000);
      transactions.push({
        userId: user._id,
        walletId: wallet1._id,
        categoryId: createdIncomeCategories[0]._id, // Lương
        amount: salaryAmount,
        type: "income",
        date: new Date(year, month, 1, 9, 0, 0),
        note: `Lương tháng ${month + 1}/${year}`,
      });
      console.log(`    ✅ Lương: ${salaryAmount.toLocaleString('vi-VN')} VND`);

      // Mỗi tháng có 1-2 thưởng (đặc biệt cho tháng hiện tại và tháng trước)
      if (monthOffset <= 1 || monthOffset % 2 === 0) {
        const bonusAmount = 1000000 + Math.floor(Math.random() * 2000000);
        const bonusDay = 5 + Math.floor(Math.random() * 10);
        transactions.push({
          userId: user._id,
          walletId: wallet2._id,
          categoryId: createdIncomeCategories[1]._id, // Thưởng
          amount: bonusAmount,
          type: "income",
          date: new Date(year, month, bonusDay, 10, 0, 0),
          note: "Thưởng dự án",
        });
        console.log(`    ✅ Thưởng: ${bonusAmount.toLocaleString('vi-VN')} VND (ngày ${bonusDay})`);
      }

      // Mỗi tháng có 20-35 giao dịch chi tiêu (nhiều hơn cho tháng hiện tại và tháng trước)
      const expenseCount = monthOffset <= 1 
        ? 30 + Math.floor(Math.random() * 6) // Tháng hiện tại và trước: 30-35 giao dịch
        : 20 + Math.floor(Math.random() * 11); // Các tháng khác: 20-30 giao dịch
      
      let totalExpense = 0;
      for (let i = 0; i < expenseCount; i++) {
        const day = Math.floor(Math.random() * daysInMonth) + 1;
        const categoryIndex = Math.floor(Math.random() * createdExpenseCategories.length);
        const category = createdExpenseCategories[categoryIndex];
        const wallet = Math.random() > 0.5 ? wallet1 : wallet2;
        
        // Số tiền khác nhau theo category
        let amount = 0;
        if (category.name === "Hóa đơn") {
          amount = 1500000 + Math.floor(Math.random() * 1000000);
        } else if (category.name === "Mua sắm") {
          amount = 200000 + Math.floor(Math.random() * 800000);
        } else if (category.name === "Ăn uống") {
          amount = 50000 + Math.floor(Math.random() * 200000);
        } else if (category.name === "Di chuyển") {
          amount = 30000 + Math.floor(Math.random() * 100000);
        } else {
          amount = 50000 + Math.floor(Math.random() * 500000);
        }
        
        totalExpense += amount;

        const transactionDate = new Date(year, month, day);
        transactionDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

        transactions.push({
          userId: user._id,
          walletId: wallet._id,
          categoryId: category._id,
          amount: amount,
          type: "expense",
          date: transactionDate,
          note: `${category.name} - ${day}/${month + 1}`,
        });
      }
      console.log(`    ✅ Chi tiêu: ${expenseCount} giao dịch, tổng ${totalExpense.toLocaleString('vi-VN')} VND`);
    }

    // Tạo dữ liệu cho 5 NĂM gần nhất (để hiển thị biểu đồ năm) - Tối ưu: chỉ tạo tổng hợp theo tháng
    console.log("📅 Tạo dữ liệu cho 5 năm gần nhất (tổng hợp theo tháng)...");
    for (let yearOffset = 4; yearOffset >= 0; yearOffset--) {
      const year = today.getFullYear() - yearOffset;
      
      // Mỗi năm có 12 lương (mỗi tháng 1 lần)
      for (let month = 0; month < 12; month++) {
        transactions.push({
          userId: user._id,
          walletId: wallet1._id,
          categoryId: createdIncomeCategories[0]._id, // Lương
          amount: 15000000 + Math.floor(Math.random() * 5000000),
          type: "income",
          date: new Date(year, month, 1, 9, 0, 0),
          note: `Lương tháng ${month + 1}/${year}`,
        });
      }

      // Mỗi năm có khoảng 60-80 giao dịch chi tiêu (giảm từ 100-150 để tăng tốc)
      const expenseCount = 60 + Math.floor(Math.random() * 21);
      for (let i = 0; i < expenseCount; i++) {
        const month = Math.floor(Math.random() * 12);
        const day = Math.floor(Math.random() * 28) + 1;
        const categoryIndex = Math.floor(Math.random() * createdExpenseCategories.length);
        const category = createdExpenseCategories[categoryIndex];
        const wallet = Math.random() > 0.5 ? wallet1 : wallet2;
        
        let amount = 0;
        if (category.name === "Hóa đơn") {
          amount = 1500000 + Math.floor(Math.random() * 1000000);
        } else if (category.name === "Mua sắm") {
          amount = 200000 + Math.floor(Math.random() * 800000);
        } else if (category.name === "Ăn uống") {
          amount = 50000 + Math.floor(Math.random() * 200000);
        } else {
          amount = 50000 + Math.floor(Math.random() * 500000);
        }

        const transactionDate = new Date(year, month, day);
        transactionDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

        transactions.push({
          userId: user._id,
          walletId: wallet._id,
          categoryId: category._id,
          amount: amount,
          type: "expense",
          date: transactionDate,
          note: `${category.name} - ${year}`,
        });
      }
    }

    // Thêm một vài giao dịch chuyển khoản
    transactions.push({
      userId: user._id,
      walletId: wallet2._id,
      toWalletId: wallet1._id,
      amount: 2000000,
      type: "transfer",
      date: new Date(today.getFullYear(), today.getMonth(), 10),
      note: "Rút tiền mặt",
    });

    console.log(`\n💾 Đang lưu ${transactions.length} giao dịch vào database...`);
    
    // Lưu theo batch để tăng tốc độ - tăng batch size lên 200
    const batchSize = 200;
    const totalBatches = Math.ceil(transactions.length / batchSize);
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      await Transaction.insertMany(batch, { ordered: false }); // ordered: false để tăng tốc
      const currentBatch = Math.floor(i / batchSize) + 1;
      console.log(`  ✅ Đã lưu batch ${currentBatch}/${totalBatches} (${Math.min(i + batchSize, transactions.length)}/${transactions.length} giao dịch)`);
    }

    // Tính tổng kết
    const totalIncome = transactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log("\n📊 Tổng kết dữ liệu đã tạo:");
    console.log(`   📈 Tổng thu nhập: ${totalIncome.toLocaleString('vi-VN')} VND`);
    console.log(`   📉 Tổng chi tiêu: ${totalExpense.toLocaleString('vi-VN')} VND`);
    console.log(`   💰 Số dư: ${(totalIncome - totalExpense).toLocaleString('vi-VN')} VND`);
    console.log(`   📝 Tổng số giao dịch: ${transactions.length}`);

    console.log("\n🎉 Hoàn thành chèn dữ liệu test!");
    console.log("\n📋 Thông tin đăng nhập test:");
    console.log("   Email: test@example.com");
    console.log("   Password: 123456");
    console.log("\n💡 Để xóa dữ liệu cũ trước khi chèn, chạy:");
    console.log("   node scripts/seedData.js --clear");

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi chèn dữ liệu:", error);
    process.exit(1);
  }
};

seedData();

