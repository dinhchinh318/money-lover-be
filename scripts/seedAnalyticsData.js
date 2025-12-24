require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user");
const Wallet = require("../src/models/wallet");
const Category = require("../src/models/category");
const Transaction = require("../src/models/transaction");
const Budget = require("../src/models/budget");

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

// Seed data cho analytics testing
const seedAnalyticsData = async () => {
    try {
        await connectDB();

        console.log("🌱 Bắt đầu chèn dữ liệu test cho Analytics...\n");

        // Tìm user (dùng user đầu tiên hoặc tạo mới)
        let user = await User.findOne({ email: "test@example.com" });

        if (!user) {
            console.log("⚠️  Không tìm thấy user test@example.com, đang tạo user mới...");
            const bcrypt = require("bcrypt");
            const hashedPassword = await bcrypt.hash("123456", 10);
            user = new User({
                name: "Nguyễn Văn Test",
                email: "test@example.com",
                password: hashedPassword,
                phone: "0123456789",
                role: "user",
                isActive: true,
            });
            await user.save();
            console.log("✅ Đã tạo user:", user.email);
        } else {
            console.log("✅ Tìm thấy user:", user.email);
        }

        // 1. Tạo/Update Wallets với số dư khác nhau để test transfer suggestions
        let wallet1 = await Wallet.findOne({ userId: user._id, name: "Ví tiền mặt" });
        if (!wallet1) {
            wallet1 = new Wallet({
                userId: user._id,
                name: "Ví tiền mặt",
                type: "cash",
                currency: "VND",
                balance: 150000, // Sắp hết tiền (< 200k) để trigger low balance alert
                is_default: true,
            });
            await wallet1.save();
        } else {
            wallet1.balance = 150000; // Set số dư thấp để test
            await wallet1.save();
        }
        console.log("✅ Đã tạo/cập nhật ví:", wallet1.name, "- Số dư:", wallet1.balance.toLocaleString("vi-VN"));

        let wallet2 = await Wallet.findOne({ userId: user._id, name: "Tài khoản ngân hàng" });
        if (!wallet2) {
            wallet2 = new Wallet({
                userId: user._id,
                name: "Tài khoản ngân hàng",
                type: "bank",
                currency: "VND",
                balance: 5000000, // Dư tiền để có thể chuyển
                is_default: false,
            });
            await wallet2.save();
        } else {
            wallet2.balance = 5000000;
            await wallet2.save();
        }
        console.log("✅ Đã tạo/cập nhật ví:", wallet2.name, "- Số dư:", wallet2.balance.toLocaleString("vi-VN"));

        // 2. Tạo/Get Categories
        let categoryFood = await Category.findOne({ userId: user._id, name: "Ăn uống" });
        if (!categoryFood) {
            categoryFood = new Category({
                userId: user._id,
                name: "Ăn uống",
                type: "expense",
                icon: "food",
            });
            await categoryFood.save();
        }

        let categoryShopping = await Category.findOne({ userId: user._id, name: "Mua sắm" });
        if (!categoryShopping) {
            categoryShopping = new Category({
                userId: user._id,
                name: "Mua sắm",
                type: "expense",
                icon: "shopping",
            });
            await categoryShopping.save();
        }
        console.log("✅ Đã có categories cần thiết");

        // 3. Tạo Budgets để test budget alerts và suggestions
        let budgetFood = await Budget.findOne({ userId: user._id, category: categoryFood._id });
        if (!budgetFood) {
            budgetFood = new Budget({
                userId: user._id,
                category: categoryFood._id,
                limit_amount: 3000000, // Hạn mức 3 triệu
                period: "monthly",
            });
            await budgetFood.save();
        }
        console.log("✅ Đã tạo/cập nhật budget Ăn uống:", budgetFood.limit_amount.toLocaleString("vi-VN"));

        let budgetShopping = await Budget.findOne({ userId: user._id, category: categoryShopping._id });
        if (!budgetShopping) {
            budgetShopping = new Budget({
                userId: user._id,
                category: categoryShopping._id,
                limit_amount: 2000000, // Hạn mức 2 triệu
                period: "monthly",
            });
            await budgetShopping.save();
        }
        console.log("✅ Đã tạo/cập nhật budget Mua sắm:", budgetShopping.limit_amount.toLocaleString("vi-VN"));

        // 4. Tạo Transactions cho tháng hiện tại (chi tiêu cao để trigger optimize suggestions)
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Xóa transactions cũ của tháng này để seed lại
        await Transaction.deleteMany({
            userId: user._id,
            date: { $gte: currentMonthStart, $lte: now },
        });

        // Chi tiêu Ăn uống: 2.5 triệu (83% của budget 3 triệu - sắp hết)
        // Bao gồm các giao dịch vào giờ cao điểm ban ngày để test phân tích khung giờ
        const foodTransactions = [
            // Giờ cao điểm: 8:00-9:00 (Cà phê sáng, đồ ăn sáng)
            { date: new Date(now.getFullYear(), now.getMonth(), 5, 8, 30, 0), amount: 50000, note: "Cà phê sáng" },
            { date: new Date(now.getFullYear(), now.getMonth(), 10, 8, 15, 0), amount: 40000, note: "Bánh mì sáng" },
            { date: new Date(now.getFullYear(), now.getMonth(), 15, 9, 0, 0), amount: 35000, note: "Trà sữa sáng" },
            { date: new Date(now.getFullYear(), now.getMonth(), 20, 8, 45, 0), amount: 45000, note: "Cà phê sáng" },
            { date: new Date(now.getFullYear(), now.getMonth(), 25, 8, 20, 0), amount: 50000, note: "Bánh mì + cà phê" },

            // Giờ cao điểm: 12:00-13:00 (Ăn trưa)
            { date: new Date(now.getFullYear(), now.getMonth(), 5, 12, 15, 0), amount: 80000, note: "Cơm trưa văn phòng" },
            { date: new Date(now.getFullYear(), now.getMonth(), 10, 12, 30, 0), amount: 120000, note: "Grab Food trưa" },
            { date: new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0), amount: 150000, note: "Nhà hàng trưa" },
            { date: new Date(now.getFullYear(), now.getMonth(), 20, 12, 45, 0), amount: 100000, note: "Phở trưa" },
            { date: new Date(now.getFullYear(), now.getMonth(), 25, 12, 20, 0), amount: 90000, note: "Bún bò trưa" },

            // Giờ cao điểm: 17:00-18:00 (Tan làm, mua đồ)
            { date: new Date(now.getFullYear(), now.getMonth(), 5, 17, 30, 0), amount: 60000, note: "Trà sữa chiều" },
            { date: new Date(now.getFullYear(), now.getMonth(), 10, 17, 15, 0), amount: 50000, note: "Bánh ngọt chiều" },
            { date: new Date(now.getFullYear(), now.getMonth(), 15, 17, 45, 0), amount: 40000, note: "Nước uống chiều" },

            // Giờ cao điểm: 18:00-19:00 (Ăn tối)
            { date: new Date(now.getFullYear(), now.getMonth(), 5, 18, 30, 0), amount: 250000, note: "Nhà hàng tối" },
            { date: new Date(now.getFullYear(), now.getMonth(), 10, 18, 15, 0), amount: 180000, note: "Grab Food tối" },
            { date: new Date(now.getFullYear(), now.getMonth(), 15, 19, 0, 0), amount: 200000, note: "Ăn tối với bạn" },
            { date: new Date(now.getFullYear(), now.getMonth(), 20, 18, 45, 0), amount: 220000, note: "Lẩu tối" },
            { date: new Date(now.getFullYear(), now.getMonth(), 25, 18, 20, 0), amount: 150000, note: "Cơm tối" },

            // Các giao dịch khác vào giờ thường
            { date: new Date(now.getFullYear(), now.getMonth(), 15, 14, 30, 0), amount: 800000, note: "Siêu thị thực phẩm" },
        ];

        for (const trans of foodTransactions) {
            // Chỉ tạo transaction nếu ngày chưa qua
            if (trans.date <= now) {
                const transaction = new Transaction({
                    userId: user._id,
                    walletId: wallet1._id,
                    categoryId: categoryFood._id,
                    type: "expense",
                    amount: trans.amount,
                    note: trans.note,
                    date: trans.date,
                });
                await transaction.save();
            }
        }
        console.log(`✅ Đã tạo ${foodTransactions.filter(t => t.date <= now).length} giao dịch Ăn uống cho tháng này (bao gồm giờ cao điểm)`);

        // Chi tiêu Mua sắm: 1.8 triệu (90% của budget 2 triệu - sắp hết)
        // Thêm các giao dịch vào giờ cao điểm chiều tối (17:00-19:00)
        const shoppingTransactions = [
            // Giờ cao điểm: 17:00-18:00 (Tan làm, đi mua sắm)
            { date: new Date(now.getFullYear(), now.getMonth(), 3, 17, 30, 0), amount: 600000, note: "Quần áo" },
            { date: new Date(now.getFullYear(), now.getMonth(), 12, 17, 45, 0), amount: 500000, note: "Đồ dùng nhà cửa" },
            { date: new Date(now.getFullYear(), now.getMonth(), 18, 18, 0, 0), amount: 400000, note: "Mỹ phẩm" },
            { date: new Date(now.getFullYear(), now.getMonth(), 22, 17, 15, 0), amount: 300000, note: "Phụ kiện" },
        ];

        for (const trans of shoppingTransactions) {
            // Chỉ tạo transaction nếu ngày chưa qua
            if (trans.date <= now) {
                const transaction = new Transaction({
                    userId: user._id,
                    walletId: wallet1._id,
                    categoryId: categoryShopping._id,
                    type: "expense",
                    amount: trans.amount,
                    note: trans.note,
                    date: trans.date,
                });
                await transaction.save();
            }
        }
        console.log(`✅ Đã tạo ${shoppingTransactions.filter(t => t.date <= now).length} giao dịch Mua sắm cho tháng này`);

        // 5. Tạo Transactions cho tháng trước (ít hơn để có sự so sánh)
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Xóa transactions cũ của tháng trước
        await Transaction.deleteMany({
            userId: user._id,
            date: { $gte: previousMonthStart, $lte: previousMonthEnd },
        });

        // Tháng trước chi ít hơn để có cảnh báo tăng chi tiêu
        const previousMonthFood = [
            { date: new Date(now.getFullYear(), now.getMonth() - 1, 5), amount: 300000 },
            { date: new Date(now.getFullYear(), now.getMonth() - 1, 15), amount: 400000 },
            { date: new Date(now.getFullYear(), now.getMonth() - 1, 25), amount: 300000 },
        ];

        for (const trans of previousMonthFood) {
            const transaction = new Transaction({
                userId: user._id,
                walletId: wallet1._id,
                categoryId: categoryFood._id,
                type: "expense",
                amount: trans.amount,
                note: "Chi tiêu tháng trước",
                date: trans.date,
            });
            await transaction.save();
        }
        console.log(`✅ Đã tạo ${previousMonthFood.length} giao dịch Ăn uống cho tháng trước (tổng: 1 triệu)`);

        // 6. Tạo Transactions cho tuần này và tuần trước (để test weekly spike alert)
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay()); // Chủ nhật của tuần này
        currentWeekStart.setHours(0, 0, 0, 0);

        const previousWeekEnd = new Date(currentWeekStart);
        previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
        previousWeekEnd.setHours(23, 59, 59, 999);

        const previousWeekStart = new Date(previousWeekEnd);
        previousWeekStart.setDate(previousWeekStart.getDate() - 6);
        previousWeekStart.setHours(0, 0, 0, 0);

        // Tuần này chi nhiều (để trigger weekly spike)
        // Thêm các giao dịch vào giờ cao điểm
        const thisWeekTransactions = [
            { date: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000), hour: 12, minute: 30, amount: 150000, note: "Ăn trưa thứ 2" }, // Thứ 2, 12:30
            { date: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000), hour: 18, minute: 15, amount: 200000, note: "Ăn tối thứ 2" }, // Thứ 2, 18:15
            { date: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000), hour: 8, minute: 45, amount: 50000, note: "Cà phê sáng thứ 2" }, // Thứ 2, 8:45
            { date: new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000), hour: 12, minute: 0, amount: 120000, note: "Ăn trưa thứ 4" }, // Thứ 4, 12:00
            { date: new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000), hour: 17, minute: 30, amount: 80000, note: "Trà sữa chiều thứ 4" }, // Thứ 4, 17:30
            { date: new Date(currentWeekStart.getTime() + 5 * 24 * 60 * 60 * 1000), hour: 18, minute: 30, amount: 250000, note: "Nhà hàng tối thứ 6" }, // Thứ 6, 18:30
            { date: new Date(currentWeekStart.getTime() + 5 * 24 * 60 * 60 * 1000), hour: 12, minute: 45, amount: 180000, note: "Grab Food trưa thứ 6" }, // Thứ 6, 12:45
        ];

        for (const trans of thisWeekTransactions) {
            const transactionDate = new Date(trans.date);
            transactionDate.setHours(trans.hour, trans.minute, 0, 0);

            if (transactionDate <= now) {
                const transaction = new Transaction({
                    userId: user._id,
                    walletId: wallet1._id,
                    categoryId: categoryFood._id,
                    type: "expense",
                    amount: trans.amount,
                    note: trans.note,
                    date: transactionDate,
                });
                await transaction.save();
            }
        }
        console.log(`✅ Đã tạo giao dịch cho tuần này với giờ cao điểm (tổng: ~1.1 triệu)`);

        // Tuần trước chi ít hơn
        const lastWeekTransactions = [
            { date: new Date(previousWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000), amount: 200000 }, // Thứ 3
            { date: new Date(previousWeekStart.getTime() + 5 * 24 * 60 * 60 * 1000), amount: 300000 }, // Thứ 6
        ];

        for (const trans of lastWeekTransactions) {
            const transaction = new Transaction({
                userId: user._id,
                walletId: wallet1._id,
                categoryId: categoryFood._id,
                type: "expense",
                amount: trans.amount,
                note: "Chi tiêu tuần trước",
                date: trans.date,
            });
            await transaction.save();
        }
        console.log(`✅ Đã tạo giao dịch cho tuần trước (tổng: ~500k)`);

        // Lưu ý: Để test analytics, giữ số dư như đã set:
        // - Ví tiền mặt: 150k (sắp hết) để trigger low balance alert
        // - Tài khoản ngân hàng: 5 triệu (dư) để có thể chuyển
        console.log("\n📊 Tóm tắt dữ liệu đã seed:");
        console.log("- Ví tiền mặt:", wallet1.balance.toLocaleString("vi-VN"), "VND (sắp hết)");
        console.log("- Tài khoản ngân hàng:", wallet2.balance.toLocaleString("vi-VN"), "VND (dư)");
        console.log("- Budget Ăn uống:", budgetFood.limit_amount.toLocaleString("vi-VN"), "VND");
        console.log("- Chi tiêu Ăn uống tháng này: ~2.5 triệu (83% budget)");
        console.log("- Budget Mua sắm:", budgetShopping.limit_amount.toLocaleString("vi-VN"), "VND");
        console.log("- Chi tiêu Mua sắm tháng này: ~1.8 triệu (90% budget)");
        console.log("- Chi tiêu tháng này > tháng trước (sẽ trigger monthly increase alert)");
        console.log("- Chi tiêu tuần này > tuần trước (sẽ trigger weekly spike alert)");
        console.log("\n⏰ Giao dịch giờ cao điểm đã thêm:");
        console.log("  • 8:00-9:00: Cà phê sáng, bánh mì (5 giao dịch)");
        console.log("  • 12:00-13:00: Ăn trưa (5 giao dịch)");
        console.log("  • 17:00-18:00: Tan làm, trà sữa chiều, mua sắm (7 giao dịch)");
        console.log("  • 18:00-19:00: Ăn tối (5 giao dịch)");
        console.log("\n✅ Hoàn thành seed data cho Analytics!");

        await mongoose.disconnect();
        console.log("✅ Đã ngắt kết nối database");
    } catch (error) {
        console.error("❌ Lỗi khi seed data:", error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

// Chạy script
seedAnalyticsData();

