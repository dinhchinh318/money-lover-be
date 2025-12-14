require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("../src/models/transaction");
const User = require("../src/models/user");

const MONGO_URI = process.env.MONGO_URI;

const checkData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Kết nối MongoDB thành công!\n");

    const user = await User.findOne({ email: "test@example.com" });
    if (!user) {
      console.log("❌ User không tìm thấy");
      process.exit(0);
    }

    console.log(`👤 User: ${user.email} (${user._id})\n`);

    // Kiểm tra tháng hiện tại
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Kiểm tra tháng trước
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    console.log("📅 THÁNG HIỆN TẠI:");
    console.log(`   Start: ${currentMonthStart.toISOString()}`);
    console.log(`   End: ${currentMonthEnd.toISOString()}`);
    console.log(`   Local: ${currentMonthStart.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} - ${currentMonthEnd.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    
    const currentMonthCount = await Transaction.countDocuments({
      userId: user._id,
      date: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    console.log(`   📊 Số giao dịch: ${currentMonthCount}`);

    const currentMonthData = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          date: { $gte: currentMonthStart, $lte: currentMonthEnd }
        }
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);
    console.log("   📈 Dữ liệu:", JSON.stringify(currentMonthData, null, 2));

    // Lấy mẫu
    const currentSamples = await Transaction.find({
      userId: user._id,
      date: { $gte: currentMonthStart, $lte: currentMonthEnd }
    }).limit(3).sort({ date: 1 });
    console.log("   📝 Mẫu giao dịch:");
    currentSamples.forEach(t => {
      console.log(`      - ${t.date.toISOString()} | ${t.type} | ${t.amount.toLocaleString('vi-VN')} VND`);
    });

    console.log("\n📅 THÁNG TRƯỚC:");
    console.log(`   Start: ${previousMonthStart.toISOString()}`);
    console.log(`   End: ${previousMonthEnd.toISOString()}`);
    console.log(`   Local: ${previousMonthStart.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} - ${previousMonthEnd.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    
    const previousMonthCount = await Transaction.countDocuments({
      userId: user._id,
      date: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    console.log(`   📊 Số giao dịch: ${previousMonthCount}`);

    const previousMonthData = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          date: { $gte: previousMonthStart, $lte: previousMonthEnd }
        }
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);
    console.log("   📈 Dữ liệu:", JSON.stringify(previousMonthData, null, 2));

    // Tổng số giao dịch
    const totalCount = await Transaction.countDocuments({ userId: user._id });
    console.log(`\n📊 TỔNG SỐ GIAO DỊCH: ${totalCount}`);

    // Kiểm tra một vài giao dịch gần nhất
    const recentTransactions = await Transaction.find({ userId: user._id })
      .sort({ date: -1 })
      .limit(5);
    console.log("\n📝 5 GIAO DỊCH GẦN NHẤT:");
    recentTransactions.forEach(t => {
      console.log(`   - ${t.date.toISOString()} | ${t.type} | ${t.amount.toLocaleString('vi-VN')} VND`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
};

checkData();


