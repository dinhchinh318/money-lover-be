require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Import models
const User = require("../models/user");
const Wallet = require("../models/wallet");
const Category = require("../models/category");
const Transaction = require("../models/transaction");
const Budget = require("../models/budget");
const RecurringBill = require("../models/recurringBill");
const SavingGoal = require("../models/savingGoal");

// Kết nối database
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Đã kết nối database thành công");
    } catch (error) {
        console.error("❌ Lỗi kết nối database:", error);
        process.exit(1);
    }
};

// Xóa dữ liệu cũ của user (tùy chọn)
const clearUserData = async (userId) => {
    try {
        await Transaction.deleteMany({ userId });
        await Budget.deleteMany({ userId });
        await RecurringBill.deleteMany({ userId });
        await SavingGoal.deleteMany({ userId });
        await Category.deleteMany({ userId });
        await Wallet.deleteMany({ userId });
        console.log("✅ Đã xóa dữ liệu cũ của user");
    } catch (error) {
        console.error("❌ Lỗi khi xóa dữ liệu:", error);
    }
};

// Tạo hoặc tìm user mẫu
const createOrFindUser = async () => {
    try {
        let user = await User.findOne({ email: "test@example.com" });

        if (!user) {
            const hashedPassword = await bcrypt.hash("123456", 10);
            user = await User.create({
                name: "Người dùng Test",
                email: "test@example.com",
                password: hashedPassword,
                phone: "0901234567",
                address: "Thành phố Hồ Chí Minh",
                role: "user",
                isActive: true,
            });
            console.log("✅ Đã tạo user mẫu:", user.email);
        } else {
            console.log("✅ Đã tìm thấy user:", user.email);
        }

        return user;
    } catch (error) {
        console.error("❌ Lỗi khi tạo/tìm user:", error);
        throw error;
    }
};

// Tạo wallets
const createWallets = async (userId) => {
    try {
        const wallets = [
            {
                userId,
                name: "Ví tiền mặt",
                type: "cash",
                currency: "VND",
                balance: 5000000,
                is_default: true,
                is_archived: false,
                description: "Ví tiền mặt chính",
            },
            {
                userId,
                name: "Vietcombank",
                type: "bank",
                currency: "VND",
                balance: 15000000,
                bankName: "Ngân hàng Ngoại thương Việt Nam",
                bankAccount: "****1234",
                bankCode: "VCB",
                is_default: false,
                is_archived: false,
                description: "Tài khoản ngân hàng chính",
            },
            {
                userId,
                name: "Ví tiết kiệm",
                type: "cash",
                currency: "VND",
                balance: 20000000,
                is_default: false,
                is_archived: false,
                description: "Ví dành cho tiết kiệm",
            },
            {
                userId,
                name: "Techcombank",
                type: "bank",
                currency: "VND",
                balance: 8000000,
                bankName: "Ngân hàng Kỹ thương Việt Nam",
                bankAccount: "****5678",
                bankCode: "TCB",
                is_default: false,
                is_archived: false,
                description: "Tài khoản phụ",
            },
            {
                userId,
                name: "Momo",
                type: "cash",
                currency: "VND",
                balance: 2000000,
                is_default: false,
                is_archived: false,
                description: "Ví điện tử MoMo",
            },
            {
                userId,
                name: "ZaloPay",
                type: "cash",
                currency: "VND",
                balance: 1500000,
                is_default: false,
                is_archived: false,
                description: "Ví điện tử ZaloPay",
            },
            {
                userId,
                name: "Thẻ tín dụng VCB",
                type: "bank",
                currency: "VND",
                balance: -3000000, // Số dư âm cho thẻ tín dụng
                bankName: "Ngân hàng Ngoại thương Việt Nam",
                bankAccount: "****9876",
                bankCode: "VCB",
                creditLimit: 50000000,
                is_default: false,
                is_archived: false,
                description: "Thẻ tín dụng",
            },
            {
                userId,
                name: "Ví đầu tư",
                type: "cash",
                currency: "VND",
                balance: 10000000,
                is_default: false,
                is_archived: false,
                description: "Ví dành cho đầu tư",
            },
        ];

        const createdWallets = await Wallet.insertMany(wallets);
        console.log(`✅ Đã tạo ${createdWallets.length} ví`);
        return createdWallets;
    } catch (error) {
        console.error("❌ Lỗi khi tạo wallets:", error);
        throw error;
    }
};

// Tạo categories
const createCategories = async (userId) => {
    try {
        const categories = [
            // Expense categories
            { userId, name: "Ăn uống", type: "expense", icon: "🍔", is_default: true },
            { userId, name: "Di chuyển", type: "expense", icon: "🚗", is_default: true },
            { userId, name: "Mua sắm", type: "expense", icon: "🛍️", is_default: true },
            { userId, name: "Hóa đơn", type: "expense", icon: "📄", is_default: true },
            { userId, name: "Giải trí", type: "expense", icon: "🎮", is_default: true },
            { userId, name: "Y tế", type: "expense", icon: "🏥", is_default: true },
            { userId, name: "Giáo dục", type: "expense", icon: "📚", is_default: true },
            { userId, name: "Khác", type: "expense", icon: "📦", is_default: true },

            // Income categories
            { userId, name: "Lương", type: "income", icon: "💰", is_default: true },
            { userId, name: "Thưởng", type: "income", icon: "🎁", is_default: true },
            { userId, name: "Đầu tư", type: "income", icon: "📈", is_default: true },
            { userId, name: "Khác", type: "income", icon: "💵", is_default: true },
        ];

        const createdCategories = await Category.insertMany(categories);
        console.log(`✅ Đã tạo ${createdCategories.length} danh mục`);
        return createdCategories;
    } catch (error) {
        console.error("❌ Lỗi khi tạo categories:", error);
        throw error;
    }
};

// Tạo transactions
const createTransactions = async (userId, wallets, categories) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const incomeCategories = categories.filter(c => c.type === "income");

        const now = new Date();
        const transactions = [];

        // Tạo transactions cho 6 tháng gần nhất (từ tháng 7 đến tháng 12)
        const monthsToGenerate = 6;
        const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthsToGenerate - 1), 1);

        // Tạo transactions cho mỗi tháng
        for (let monthOffset = 0; monthOffset < monthsToGenerate; monthOffset++) {
            const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + monthOffset, 1);
            const monthEnd = new Date(startMonth.getFullYear(), startMonth.getMonth() + monthOffset + 1, 0);

            // Thu nhập - Lương vào Vietcombank (mỗi tháng)
            transactions.push({
                userId,
                walletId: wallets[1]._id, // Vietcombank
                categoryId: incomeCategories.find(c => c.name === "Lương")._id,
                amount: 15000000,
                type: "income",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 5),
                note: `Lương tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`,
            });

            // Thu nhập - Thưởng vào Techcombank (tháng 11, 12)
            if (monthOffset >= 4) {
                transactions.push({
                    userId,
                    walletId: wallets[3]._id, // Techcombank
                    categoryId: incomeCategories.find(c => c.name === "Thưởng")._id,
                    amount: monthOffset === 4 ? 5000000 : 3000000,
                    type: "income",
                    date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 10),
                    note: `Thưởng tháng ${monthDate.getMonth() + 1}`,
                });
            }

            // Thu nhập - Đầu tư vào Ví đầu tư (mỗi tháng)
            transactions.push({
                userId,
                walletId: wallets[7]._id, // Ví đầu tư
                categoryId: incomeCategories.find(c => c.name === "Đầu tư")._id,
                amount: Math.floor(Math.random() * 2000000) + 1000000, // 1M - 3M
                type: "income",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 15),
                note: `Lợi nhuận đầu tư tháng ${monthDate.getMonth() + 1}`,
            });

            // Chi tiêu - Hóa đơn (mỗi tháng)
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: expenseCategories.find(c => c.name === "Hóa đơn")._id,
                amount: Math.floor(Math.random() * 500000) + 2000000, // 2M - 2.5M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 3),
                note: `Tiền điện nước tháng ${monthDate.getMonth() + 1}`,
            });

            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: expenseCategories.find(c => c.name === "Hóa đơn")._id,
                amount: 500000,
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 10),
                note: "Internet",
            });

            // Chi tiêu - Ăn uống (mỗi tháng, phân bổ vào các ví khác nhau)
            const eatingWallets = [wallets[0]._id, wallets[4]._id, wallets[5]._id]; // Ví tiền mặt, Momo, ZaloPay
            for (let i = 0; i < 15; i++) {
                const randomWallet = eatingWallets[Math.floor(Math.random() * eatingWallets.length)];
                transactions.push({
                    userId,
                    walletId: randomWallet,
                    categoryId: expenseCategories.find(c => c.name === "Ăn uống")._id,
                    amount: Math.floor(Math.random() * 200000) + 50000, // 50k - 250k
                    type: "expense",
                    date: new Date(
                        monthDate.getFullYear(),
                        monthDate.getMonth(),
                        Math.floor(Math.random() * 28) + 1
                    ),
                    note: `Bữa ${i + 1} tháng ${monthDate.getMonth() + 1}`,
                });
            }

            // Chi tiêu - Di chuyển (mỗi tháng)
            for (let i = 0; i < 12; i++) {
                transactions.push({
                    userId,
                    walletId: wallets[0]._id,
                    categoryId: expenseCategories.find(c => c.name === "Di chuyển")._id,
                    amount: Math.floor(Math.random() * 100000) + 20000, // 20k - 120k
                    type: "expense",
                    date: new Date(
                        monthDate.getFullYear(),
                        monthDate.getMonth(),
                        Math.floor(Math.random() * 28) + 1
                    ),
                    note: "Xăng/xe",
                });
            }

            // Chi tiêu - Mua sắm (Vietcombank) - mỗi tháng
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: expenseCategories.find(c => c.name === "Mua sắm")._id,
                amount: Math.floor(Math.random() * 2000000) + 1500000, // 1.5M - 3.5M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 8),
                note: `Mua sắm tháng ${monthDate.getMonth() + 1}`,
            });

            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: expenseCategories.find(c => c.name === "Mua sắm")._id,
                amount: Math.floor(Math.random() * 1000000) + 1000000, // 1M - 2M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 15),
                note: "Đồ dùng gia đình",
            });

            // Chi tiêu - Mua sắm (Momo) - mỗi tháng
            transactions.push({
                userId,
                walletId: wallets[4]._id, // Momo
                categoryId: expenseCategories.find(c => c.name === "Mua sắm")._id,
                amount: Math.floor(Math.random() * 500000) + 500000, // 500k - 1M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 12),
                note: "Mua online qua Momo",
            });

            // Chi tiêu - Ăn uống (ZaloPay) - mỗi tháng
            for (let i = 0; i < 5; i++) {
                transactions.push({
                    userId,
                    walletId: wallets[5]._id, // ZaloPay
                    categoryId: expenseCategories.find(c => c.name === "Ăn uống")._id,
                    amount: Math.floor(Math.random() * 150000) + 30000, // 30k - 180k
                    type: "expense",
                    date: new Date(
                        monthDate.getFullYear(),
                        monthDate.getMonth(),
                        Math.floor(Math.random() * 28) + 1
                    ),
                    note: `Thanh toán qua ZaloPay`,
                });
            }

            // Chi tiêu - Giải trí (Techcombank) - mỗi tháng
            transactions.push({
                userId,
                walletId: wallets[3]._id, // Techcombank
                categoryId: expenseCategories.find(c => c.name === "Giải trí")._id,
                amount: Math.floor(Math.random() * 800000) + 800000, // 800k - 1.6M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 20),
                note: "Xem phim, chơi game",
            });

            transactions.push({
                userId,
                walletId: wallets[3]._id,
                categoryId: expenseCategories.find(c => c.name === "Giải trí")._id,
                amount: Math.floor(Math.random() * 500000) + 500000, // 500k - 1M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 25),
                note: "Karaoke",
            });

            // Chi tiêu - Giáo dục (tháng 9, 12)
            if (monthOffset === 2 || monthOffset === 5) {
                transactions.push({
                    userId,
                    walletId: wallets[1]._id,
                    categoryId: expenseCategories.find(c => c.name === "Giáo dục")._id,
                    amount: 2000000,
                    type: "expense",
                    date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 18),
                    note: "Học phí",
                });
            }

            // Chi tiêu - Y tế (tháng 7, 10)
            if (monthOffset === 0 || monthOffset === 3) {
                transactions.push({
                    userId,
                    walletId: wallets[0]._id,
                    categoryId: expenseCategories.find(c => c.name === "Y tế")._id,
                    amount: Math.floor(Math.random() * 500000) + 300000, // 300k - 800k
                    type: "expense",
                    date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 7),
                    note: "Khám sức khỏe",
                });
            }

            // Chi tiêu - Thẻ tín dụng (mỗi tháng)
            transactions.push({
                userId,
                walletId: wallets[6]._id, // Thẻ tín dụng VCB
                categoryId: expenseCategories.find(c => c.name === "Mua sắm")._id,
                amount: Math.floor(Math.random() * 2000000) + 2000000, // 2M - 4M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 14),
                note: "Mua sắm qua thẻ tín dụng",
            });

            transactions.push({
                userId,
                walletId: wallets[6]._id,
                categoryId: expenseCategories.find(c => c.name === "Giải trí")._id,
                amount: Math.floor(Math.random() * 1000000) + 1000000, // 1M - 2M
                type: "expense",
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 22),
                note: "Du lịch, giải trí",
            });
        }

        const createdTransactions = await Transaction.insertMany(transactions);
        console.log(`✅ Đã tạo ${createdTransactions.length} giao dịch`);
        return createdTransactions;
    } catch (error) {
        console.error("❌ Lỗi khi tạo transactions:", error);
        throw error;
    }
};

// Tạo transactions cho tháng hiện tại để test dự đoán vượt ngân sách
const createCurrentMonthTransactions = async (userId, wallets, categories) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentDay = now.getDate();

        const currentMonthTransactions = [];

        // 1. Ăn uống: Đã chi ~2.5M/5M (50%) - An toàn nhưng có thể vượt nếu tiếp tục
        // Budget: 5M, đã chi 2.5M, còn 8 ngày -> dự đoán sẽ chi thêm ~1.5M -> tổng ~4M (an toàn)
        const eatingCategory = expenseCategories.find(c => c.name === "Ăn uống");
        if (!eatingCategory) {
            console.error("❌ Không tìm thấy category 'Ăn uống'");
            return [];
        }
        const eatingWallet = wallets[0]._id; // Ví tiền mặt
        let eatingTotal = 0;
        const eatingTarget = 2500000; // Mục tiêu chi 2.5M
        console.log(`📝 Tạo transactions cho 'Ăn uống': CategoryId=${eatingCategory._id}, WalletId=${eatingWallet}`);

        // Phân bổ chi tiêu ăn uống trong tháng (từ ngày 1 đến ngày hiện tại)
        for (let day = 1; day <= currentDay && eatingTotal < eatingTarget; day++) {
            const dailyAmount = Math.floor(Math.random() * 150000) + 80000; // 80k - 230k mỗi ngày
            if (eatingTotal + dailyAmount <= eatingTarget) {
                // Đảm bảo date được set đúng (không có giờ/phút/giây)
                const transactionDate = new Date(now.getFullYear(), now.getMonth(), day);
                transactionDate.setHours(12, 0, 0, 0); // Set giữa ngày để tránh vấn đề timezone

                currentMonthTransactions.push({
                    userId,
                    walletId: eatingWallet,
                    categoryId: eatingCategory._id,
                    amount: dailyAmount,
                    type: "expense",
                    date: transactionDate,
                    note: `Ăn uống ngày ${day}`,
                });
                eatingTotal += dailyAmount;
            }
        }

        // 2. Hóa đơn: Đã chi ~2.8M/3M (93%) - Sắp vượt ngân sách
        // Budget: 3M, đã chi 2.8M, còn 8 ngày -> dự đoán sẽ vượt
        const billsCategory = expenseCategories.find(c => c.name === "Hóa đơn");
        if (!billsCategory) {
            console.error("❌ Không tìm thấy category 'Hóa đơn'");
            return [];
        }
        const billsWallet = wallets[1]._id; // Vietcombank
        const billsTotal = 2800000; // Đã chi 2.8M
        console.log(`📝 Tạo transactions cho 'Hóa đơn': CategoryId=${billsCategory._id}, WalletId=${billsWallet}`);

        // Đảm bảo date được set đúng
        const billDate1 = new Date(now.getFullYear(), now.getMonth(), 3);
        billDate1.setHours(12, 0, 0, 0);
        const billDate2 = new Date(now.getFullYear(), now.getMonth(), 10);
        billDate2.setHours(12, 0, 0, 0);
        const billDate3 = new Date(now.getFullYear(), now.getMonth(), 15);
        billDate3.setHours(12, 0, 0, 0);

        currentMonthTransactions.push({
            userId,
            walletId: billsWallet,
            categoryId: billsCategory._id,
            amount: 2000000, // Tiền điện nước
            type: "expense",
            date: billDate1,
            note: "Tiền điện nước tháng này",
        });

        currentMonthTransactions.push({
            userId,
            walletId: billsWallet,
            categoryId: billsCategory._id,
            amount: 500000, // Internet
            type: "expense",
            date: billDate2,
            note: "Internet",
        });

        currentMonthTransactions.push({
            userId,
            walletId: billsWallet,
            categoryId: billsCategory._id,
            amount: 300000, // Điện thoại
            type: "expense",
            date: billDate3,
            note: "Tiền điện thoại",
        });

        // 3. Mua sắm: Đã chi ~4.2M/5M (84%) - Có nguy cơ vượt
        // Budget: 5M, đã chi 4.2M, còn 8 ngày -> dự đoán sẽ vượt
        const shoppingCategory = expenseCategories.find(c => c.name === "Mua sắm");
        if (!shoppingCategory) {
            console.error("❌ Không tìm thấy category 'Mua sắm'");
            return [];
        }
        const shoppingWallet = wallets[1]._id; // Vietcombank
        const shoppingTotal = 4200000; // Đã chi 4.2M
        console.log(`📝 Tạo transactions cho 'Mua sắm': CategoryId=${shoppingCategory._id}, WalletId=${shoppingWallet}`);

        // Đảm bảo date được set đúng
        const shopDate1 = new Date(now.getFullYear(), now.getMonth(), 5);
        shopDate1.setHours(12, 0, 0, 0);
        const shopDate2 = new Date(now.getFullYear(), now.getMonth(), 12);
        shopDate2.setHours(12, 0, 0, 0);
        const shopDate3 = new Date(now.getFullYear(), now.getMonth(), 18);
        shopDate3.setHours(12, 0, 0, 0);

        currentMonthTransactions.push({
            userId,
            walletId: shoppingWallet,
            categoryId: shoppingCategory._id,
            amount: 2000000, // Mua sắm lớn
            type: "expense",
            date: shopDate1,
            note: "Mua sắm đầu tháng",
        });

        currentMonthTransactions.push({
            userId,
            walletId: shoppingWallet,
            categoryId: shoppingCategory._id,
            amount: 1500000, // Mua sắm giữa tháng
            type: "expense",
            date: shopDate2,
            note: "Đồ dùng gia đình",
        });

        currentMonthTransactions.push({
            userId,
            walletId: shoppingWallet,
            categoryId: shoppingCategory._id,
            amount: 700000, // Mua sắm nhỏ
            type: "expense",
            date: shopDate3,
            note: "Mua sắm linh tinh",
        });

        // Thêm một số transactions nhỏ khác để tăng tính thực tế
        for (let i = 0; i < 3; i++) {
            const randomDay = Math.floor(Math.random() * currentDay) + 1;
            const randomDate = new Date(now.getFullYear(), now.getMonth(), randomDay);
            randomDate.setHours(12, 0, 0, 0);

            currentMonthTransactions.push({
                userId,
                walletId: wallets[4]._id, // Momo
                categoryId: shoppingCategory._id,
                amount: Math.floor(Math.random() * 200000) + 100000, // 100k - 300k
                type: "expense",
                date: randomDate,
                note: "Mua online qua Momo",
            });
        }

        if (currentMonthTransactions.length === 0) {
            console.warn("⚠️ Không có transactions nào để tạo!");
            return [];
        }

        console.log(`📊 Tổng số transactions sẽ tạo: ${currentMonthTransactions.length}`);
        console.log(`   - Ăn uống: ${currentMonthTransactions.filter(t => t.categoryId.toString() === eatingCategory._id.toString()).length} transactions, ~${eatingTotal.toLocaleString('vi-VN')} VND`);
        console.log(`   - Hóa đơn: ${currentMonthTransactions.filter(t => t.categoryId.toString() === billsCategory._id.toString()).length} transactions, ~${billsTotal.toLocaleString('vi-VN')} VND`);
        console.log(`   - Mua sắm: ${currentMonthTransactions.filter(t => t.categoryId.toString() === shoppingCategory._id.toString()).length} transactions, ~${shoppingTotal.toLocaleString('vi-VN')} VND`);

        const createdCurrentMonthTransactions = await Transaction.insertMany(currentMonthTransactions);
        console.log(`✅ Đã tạo ${createdCurrentMonthTransactions.length} giao dịch cho tháng hiện tại (test dự đoán vượt ngân sách)`);
        console.log(`   - Ăn uống: ~${eatingTotal.toLocaleString('vi-VN')} VND`);
        console.log(`   - Hóa đơn: ~${billsTotal.toLocaleString('vi-VN')} VND`);
        console.log(`   - Mua sắm: ~${shoppingTotal.toLocaleString('vi-VN')} VND`);

        // Log một vài transactions mẫu để verify
        console.log(`\n📋 Sample transactions (first 3):`);
        createdCurrentMonthTransactions.slice(0, 3).forEach((t, idx) => {
            console.log(`   ${idx + 1}. CategoryId: ${t.categoryId}, WalletId: ${t.walletId}, Amount: ${t.amount.toLocaleString('vi-VN')} VND, Date: ${t.date.toISOString()}`);
        });

        return createdCurrentMonthTransactions;
    } catch (error) {
        console.error("❌ Lỗi khi tạo transactions tháng hiện tại:", error);
        throw error;
    }
};

// Tạo budgets
const createBudgets = async (userId, categories, wallets) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const budgets = [
            {
                userId,
                name: "Ngân sách Ăn uống",
                category: expenseCategories.find(c => c.name === "Ăn uống")._id,
                wallet: wallets[0]._id,
                limit_amount: 5000000,
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách ăn uống hàng tháng",
            },
            {
                userId,
                name: "Ngân sách Hóa đơn",
                category: expenseCategories.find(c => c.name === "Hóa đơn")._id,
                wallet: null, // Tất cả ví
                limit_amount: 3000000,
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách hóa đơn hàng tháng",
            },
            {
                userId,
                name: "Ngân sách Mua sắm",
                category: expenseCategories.find(c => c.name === "Mua sắm")._id,
                wallet: wallets[1]._id,
                limit_amount: 5000000,
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách mua sắm hàng tháng",
            },
        ];

        const createdBudgets = await Budget.insertMany(budgets);
        console.log(`✅ Đã tạo ${createdBudgets.length} ngân sách`);
        return createdBudgets;
    } catch (error) {
        console.error("❌ Lỗi khi tạo budgets:", error);
        throw error;
    }
};

// Tạo recurring bills
const createRecurringBills = async (userId, categories, wallets) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Tạo từng recurring bill một để tránh lỗi validation
        const recurringBillsData = [
            {
                userId,
                name: "Tiền điện",
                wallet: wallets[1]._id,
                category: expenseCategories.find(c => c.name === "Hóa đơn")._id,
                amount: 2000000,
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Hóa đơn tiền điện hàng tháng",
            },
            {
                userId,
                name: "Tiền nước",
                wallet: wallets[1]._id,
                category: expenseCategories.find(c => c.name === "Hóa đơn")._id,
                amount: 200000,
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Hóa đơn tiền nước hàng tháng",
            },
            {
                userId,
                name: "Netflix",
                wallet: wallets[1]._id,
                category: expenseCategories.find(c => c.name === "Giải trí")._id,
                amount: 180000,
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Gói Netflix Premium",
            },
        ];

        const createdRecurringBills = [];
        for (const billData of recurringBillsData) {
            const bill = await RecurringBill.create(billData);
            createdRecurringBills.push(bill);
        }

        console.log(`✅ Đã tạo ${createdRecurringBills.length} hóa đơn định kỳ`);
        return createdRecurringBills;
    } catch (error) {
        console.error("❌ Lỗi khi tạo recurring bills:", error);
        throw error;
    }
};

// Tạo saving goals
const createSavingGoals = async (userId, wallets) => {
    try {
        const now = new Date();
        const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), 1);
        const next6Months = new Date(now.getFullYear(), now.getMonth() + 6, 1);

        const savingGoals = [
            {
                userId,
                name: "Mua xe máy",
                wallet: wallets[2]._id, // Ví tiết kiệm
                target_amount: 50000000,
                current_amount: 20000000,
                target_date: nextYear,
                is_active: true,
                description: "Mục tiêu mua xe máy mới",
            },
            {
                userId,
                name: "Du lịch",
                wallet: wallets[2]._id,
                target_amount: 10000000,
                current_amount: 3000000,
                target_date: next6Months,
                is_active: true,
                description: "Tiết kiệm cho chuyến du lịch",
            },
            {
                userId,
                name: "Quỹ khẩn cấp",
                wallet: wallets[2]._id,
                target_amount: 20000000,
                current_amount: 5000000,
                target_date: null, // Không có hạn
                is_active: true,
                description: "Quỹ dự phòng khẩn cấp",
            },
        ];

        const createdSavingGoals = await SavingGoal.insertMany(savingGoals);
        console.log(`✅ Đã tạo ${createdSavingGoals.length} mục tiêu tiết kiệm`);
        return createdSavingGoals;
    } catch (error) {
        console.error("❌ Lỗi khi tạo saving goals:", error);
        throw error;
    }
};

// Hàm chính
const seedData = async () => {
    try {
        console.log("🌱 Bắt đầu seed dữ liệu...\n");

        // Kết nối database
        await connectDB();

        // Tạo hoặc tìm user
        const user = await createOrFindUser();

        // Xóa dữ liệu cũ của user trước khi seed mới
        await clearUserData(user._id);

        // Tạo wallets
        const wallets = await createWallets(user._id);

        // Tạo categories
        const categories = await createCategories(user._id);

        // Tạo transactions
        await createTransactions(user._id, wallets, categories);

        // Tạo transactions cho tháng hiện tại để test dự đoán vượt ngân sách
        console.log("\n📝 Bắt đầu tạo transactions cho tháng hiện tại...");
        await createCurrentMonthTransactions(user._id, wallets, categories);
        console.log("✅ Hoàn thành tạo transactions cho tháng hiện tại\n");

        // Tạo budgets
        await createBudgets(user._id, categories, wallets);

        // Tạo recurring bills
        await createRecurringBills(user._id, categories, wallets);

        // Tạo saving goals
        await createSavingGoals(user._id, wallets);

        console.log("\n✅ Hoàn thành seed dữ liệu!");
        console.log("\n📝 Thông tin đăng nhập:");
        console.log("   Email: test@example.com");
        console.log("   Password: 123456");
        console.log("\n");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Lỗi khi seed dữ liệu:", error);
        process.exit(1);
    }
};

// Chạy seed
if (require.main === module) {
    seedData();
}

module.exports = seedData;

