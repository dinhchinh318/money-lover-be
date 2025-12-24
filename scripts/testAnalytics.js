require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user");
const Wallet = require("../src/models/wallet");
const Category = require("../src/models/category");
const Transaction = require("../src/models/transaction");
const Budget = require("../src/models/budget");

const MONGO_URI = process.env.MONGO_URI;

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Kết nối MongoDB thành công!");
    } catch (error) {
        console.error("❌ Lỗi kết nối MongoDB:", error);
        process.exit(1);
    }
};

const testAnalytics = async () => {
    try {
        await connectDB();

        // Tìm user test
        const user = await User.findOne({ email: "test@example.com" });
        if (!user) {
            console.log("❌ Không tìm thấy user test@example.com");
            await mongoose.disconnect();
            return;
        }

        console.log(`\n📊 Kiểm tra dữ liệu cho user: ${user.email} (${user._id})\n`);

        // Kiểm tra Wallets
        const wallets = await Wallet.find({ userId: user._id, is_archived: false }).lean();
        console.log(`💰 Wallets (${wallets.length}):`);
        wallets.forEach((w, idx) => {
            console.log(`   ${idx + 1}. ${w.name}: ${w.balance.toLocaleString("vi-VN")} VND`);
        });

        // Kiểm tra Categories
        const categories = await Category.find({ userId: user._id }).lean();
        console.log(`\n📁 Categories (${categories.length}):`);
        categories.forEach((c, idx) => {
            console.log(`   ${idx + 1}. ${c.name} (${c.type})`);
        });

        // Kiểm tra Transactions (30 ngày gần nhất)
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);

        const transactions = await Transaction.find({
            userId: user._id,
            type: "expense",
            date: { $gte: startDate, $lte: now },
        }).lean();

        console.log(`\n💸 Transactions (30 ngày gần nhất): ${transactions.length}`);
        if (transactions.length > 0) {
            const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
            console.log(`   Tổng chi tiêu: ${totalAmount.toLocaleString("vi-VN")} VND`);

            // Group by category
            const categoryStats = {};
            transactions.forEach(t => {
                const catId = t.categoryId?.toString() || "unknown";
                if (!categoryStats[catId]) {
                    categoryStats[catId] = { count: 0, total: 0 };
                }
                categoryStats[catId].count++;
                categoryStats[catId].total += t.amount;
            });

            console.log(`   Chi tiêu theo category:`);
            Object.entries(categoryStats).forEach(([catId, stats]) => {
                const category = categories.find(c => c._id.toString() === catId);
                const catName = category?.name || catId;
                const percentage = transactions.length > 0 ? (stats.total / totalAmount * 100).toFixed(1) : 0;
                console.log(`      - ${catName}: ${stats.total.toLocaleString("vi-VN")} VND (${stats.count} giao dịch, ${percentage}%)`);
            });
        }

        // Kiểm tra Budgets
        const budgets = await Budget.find({
            userId: user._id,
            period: "monthly",
        }).populate("category", "name icon").lean();

        console.log(`\n📊 Budgets (${budgets.length}):`);
        budgets.forEach((b, idx) => {
            console.log(`   ${idx + 1}. ${b.category?.name || "Unknown"}: ${b.limit_amount.toLocaleString("vi-VN")} VND/tháng`);
        });

        // Kiểm tra điều kiện cho Optimize Spending
        console.log(`\n🔍 Điều kiện cho Optimize Spending:`);
        if (transactions.length === 0) {
            console.log(`   ❌ Không có transactions trong 30 ngày gần nhất`);
        } else {
            const totalExpense = transactions.reduce((sum, t) => sum + t.amount, 0);
            console.log(`   ✅ Có ${transactions.length} transactions, tổng: ${totalExpense.toLocaleString("vi-VN")} VND`);

            // Check categories với % >= 10%
            if (categoryStats && Object.keys(categoryStats).length > 0) {
                Object.entries(categoryStats).forEach(([catId, stats]) => {
                    const percentage = (stats.total / totalExpense) * 100;
                    const category = categories.find(c => c._id.toString() === catId);
                    const catName = category?.name || catId;
                    if (percentage >= 10) {
                        console.log(`   ✅ ${catName}: ${percentage.toFixed(1)}% >= 10% (sẽ được suggest)`);
                    } else {
                        console.log(`   ⚠️  ${catName}: ${percentage.toFixed(1)}% < 10% (không được suggest)`);
                    }
                });
            }
        }

        // Kiểm tra điều kiện cho Wallet Transfer
        console.log(`\n🔍 Điều kiện cho Wallet Transfer:`);
        if (wallets.length < 2) {
            console.log(`   ❌ Chỉ có ${wallets.length} ví (cần ít nhất 2 ví)`);
        } else {
            const threshold = 100000;
            const highBalanceThreshold = 200000;
            const lowWallets = wallets.filter(w => w.balance < threshold || w.balance < 0);
            const highWallets = wallets.filter(w => w.balance > highBalanceThreshold);

            console.log(`   ✅ Có ${wallets.length} ví`);
            console.log(`   Ví sắp hết (<${threshold.toLocaleString("vi-VN")}): ${lowWallets.length}`);
            console.log(`   Ví dư tiền (>${highBalanceThreshold.toLocaleString("vi-VN")}): ${highWallets.length}`);

            if (lowWallets.length === 0 && highWallets.length === 0) {
                console.log(`   ⚠️  Không có ví nào thỏa điều kiện để suggest transfer`);
            } else if (lowWallets.length > 0 && highWallets.length === 0) {
                console.log(`   ⚠️  Có ví sắp hết nhưng không có ví dư để chuyển`);
            } else if (lowWallets.length === 0 && highWallets.length > 0) {
                console.log(`   ⚠️  Có ví dư nhưng không có ví sắp hết để nhận`);
            } else {
                console.log(`   ✅ Có thể suggest transfer từ ${highWallets.length} ví dư sang ${lowWallets.length} ví sắp hết`);
            }
        }

        // Kiểm tra điều kiện cho Budget Adjustment
        console.log(`\n🔍 Điều kiện cho Budget Adjustment:`);
        if (budgets.length === 0) {
            console.log(`   ❌ Không có budgets`);
        } else {
            console.log(`   ✅ Có ${budgets.length} budgets`);

            const last3MonthsStart = new Date(now);
            last3MonthsStart.setMonth(now.getMonth() - 3);

            for (const budget of budgets) {
                const avgSpendingStats = await Transaction.aggregate([
                    {
                        $match: {
                            userId: user._id,
                            type: "expense",
                            categoryId: budget.category._id,
                            date: { $gte: last3MonthsStart, $lte: now },
                        },
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: "$date" },
                                month: { $month: "$date" },
                            },
                            totalAmount: { $sum: "$amount" },
                        },
                    },
                ]);

                if (avgSpendingStats.length > 0) {
                    const monthlyAmounts = avgSpendingStats.map((s) => s.totalAmount);
                    const avgMonthlySpending = monthlyAmounts.reduce((sum, a) => sum + a, 0) / monthlyAmounts.length;
                    console.log(`   ✅ ${budget.category.name}: có ${avgSpendingStats.length} tháng dữ liệu, trung bình ${avgMonthlySpending.toLocaleString("vi-VN")} VND/tháng`);
                } else {
                    console.log(`   ⚠️  ${budget.category.name}: không có transactions trong 3 tháng gần nhất`);
                }
            }
        }

        console.log("\n" + "=".repeat(60) + "\n");

        await mongoose.disconnect();
        console.log("✅ Hoàn thành kiểm tra!");
    } catch (error) {
        console.error("❌ Lỗi:", error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

testAnalytics();

