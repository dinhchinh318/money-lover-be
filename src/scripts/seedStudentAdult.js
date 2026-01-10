require("dotenv").config();
const mongoose = require("mongoose");

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

// Helper: Làm tròn số tiền đến 1000 VND
const roundToThousand = (amount) => {
    return Math.round(amount / 1000) * 1000;
};

// Helper: Tạo số ngẫu nhiên làm tròn đến 1000
const randomAmount = (min, max) => {
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    return roundToThousand(amount);
};

// Helper: Tạo ngày random với giờ/phút/giây random
const randomDateTime = (year, month, day) => {
    const hour = Math.floor(Math.random() * 24); // 0-23
    const minute = Math.floor(Math.random() * 60); // 0-59
    const second = Math.floor(Math.random() * 60); // 0-59
    return new Date(year, month, day, hour, minute, second);
};

// Xóa dữ liệu cũ của user
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

// Tạo hoặc tìm user sinh viên
const createOrFindStudent = async () => {
    try {
        let user = await User.findOne({ email: "sinhvien@example.com" });

        if (!user) {
            // Không hash password, để User model tự hash qua pre-save middleware
            user = await User.create({
                name: "Nguyễn Văn Sinh Viên",
                email: "sinhvien@example.com",
                password: "123456",
                phone: "0901111111",
                address: "Ký túc xá Đại học Quốc gia, Thành phố Hồ Chí Minh",
                role: "user",
                isActive: true,
            });
            console.log("✅ Đã tạo user sinh viên:", user.email);
        } else {
            // Nếu user đã tồn tại, update password để đảm bảo đúng
            user.password = "123456";
            await user.save();
            console.log("✅ Đã tìm thấy và cập nhật user sinh viên:", user.email);
        }

        return user;
    } catch (error) {
        console.error("❌ Lỗi khi tạo/tìm user sinh viên:", error);
        throw error;
    }
};

// Tạo hoặc tìm user người trưởng thành
const createOrFindAdult = async () => {
    try {
        let user = await User.findOne({ email: "nguoitruongthanh@example.com" });

        if (!user) {
            // Không hash password, để User model tự hash qua pre-save middleware
            user = await User.create({
                name: "Trần Thị Trưởng Thành",
                email: "nguoitruongthanh@example.com",
                password: "123456",
                phone: "0902222222",
                address: "Quận 1, Thành phố Hồ Chí Minh",
                role: "user",
                isActive: true,
            });
            console.log("✅ Đã tạo user người trưởng thành:", user.email);
        } else {
            // Nếu user đã tồn tại, update password để đảm bảo đúng
            user.password = "123456";
            await user.save();
            console.log("✅ Đã tìm thấy và cập nhật user người trưởng thành:", user.email);
        }

        return user;
    } catch (error) {
        console.error("❌ Lỗi khi tạo/tìm user người trưởng thành:", error);
        throw error;
    }
};

// Tạo wallets cho sinh viên
const createStudentWallets = async (userId) => {
    try {
        const wallets = [
            {
                userId,
                name: "Ví tiền mặt",
                type: "cash",
                currency: "VND",
                balance: 2000000, // 2 triệu
                is_default: true,
                is_archived: false,
            },
            {
                userId,
                name: "Vietcombank",
                type: "bank",
                currency: "VND",
                balance: 5000000, // 5 triệu
                bankName: "Ngân hàng Ngoại thương Việt Nam",
                bankAccount: "****1111",
                bankCode: "VCB",
                is_default: false,
                is_archived: false,
            },
            {
                userId,
                name: "MoMo",
                type: "cash",
                currency: "VND",
                balance: 500000, // 500k
                is_default: false,
                is_archived: false,
            },
        ];

        const createdWallets = await Wallet.insertMany(wallets);
        console.log(`✅ Đã tạo ${createdWallets.length} ví cho sinh viên`);
        return createdWallets;
    } catch (error) {
        console.error("❌ Lỗi khi tạo wallets sinh viên:", error);
        throw error;
    }
};

// Tạo wallets cho người trưởng thành
const createAdultWallets = async (userId) => {
    try {
        const wallets = [
            {
                userId,
                name: "Ví tiền mặt",
                type: "cash",
                currency: "VND",
                balance: 5000000, // 5 triệu
                is_default: true,
                is_archived: false,
            },
            {
                userId,
                name: "Vietcombank - Lương",
                type: "bank",
                currency: "VND",
                balance: 50000000, // 50 triệu
                bankName: "Ngân hàng Ngoại thương Việt Nam",
                bankAccount: "****2222",
                bankCode: "VCB",
                is_default: false,
                is_archived: false,
            },
            {
                userId,
                name: "Techcombank - Tiết kiệm",
                type: "bank",
                currency: "VND",
                balance: 100000000, // 100 triệu
                bankName: "Ngân hàng Kỹ thương Việt Nam",
                bankAccount: "****3333",
                bankCode: "TCB",
                is_default: false,
                is_archived: false,
            },
            {
                userId,
                name: "MoMo",
                type: "cash",
                currency: "VND",
                balance: 3000000, // 3 triệu
                is_default: false,
                is_archived: false,
            },
        ];

        const createdWallets = await Wallet.insertMany(wallets);
        console.log(`✅ Đã tạo ${createdWallets.length} ví cho người trưởng thành`);
        return createdWallets;
    } catch (error) {
        console.error("❌ Lỗi khi tạo wallets người trưởng thành:", error);
        throw error;
    }
};

// Tạo categories cho user
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
            { userId, name: "Phụ cấp", type: "income", icon: "💵", is_default: true },
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

// Tạo transactions cho sinh viên (từ tháng 5/2025 đến hiện tại)
const createStudentTransactions = async (userId, wallets, categories) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const incomeCategories = categories.filter(c => c.type === "income");

        const transactions = [];
        const now = new Date();
        
        // Tính từ tháng 5/2025 đến tháng hiện tại
        const startYear = 2025;
        const startMonthIndex = 4; // Tháng 5 (0-indexed, 4 = May)
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Tính số tháng từ 5/2025 đến hiện tại
        let monthsToGenerate = 0;
        if (currentYear === startYear) {
            if (currentMonth >= startMonthIndex) {
                monthsToGenerate = currentMonth - startMonthIndex + 1; // Bao gồm cả tháng hiện tại
            } else {
                monthsToGenerate = 0; // Chưa đến tháng 5
            }
        } else if (currentYear > startYear) {
            monthsToGenerate = (12 - startMonthIndex) + (currentYear - startYear - 1) * 12 + (currentMonth + 1);
        }

        // Nếu không có tháng nào cần generate, set mặc định là 9 tháng (từ 5/2025 đến 1/2026)
        if (monthsToGenerate === 0) {
            monthsToGenerate = 9; // Từ tháng 5/2025 đến tháng 1/2026
        }

        // Lấy danh mục
        const anUong = expenseCategories.find(c => c.name === "Ăn uống");
        const diChuyen = expenseCategories.find(c => c.name === "Di chuyển");
        const muaSam = expenseCategories.find(c => c.name === "Mua sắm");
        const hoaDon = expenseCategories.find(c => c.name === "Hóa đơn");
        const giaiTri = expenseCategories.find(c => c.name === "Giải trí");
        const yTe = expenseCategories.find(c => c.name === "Y tế");
        const giaoDuc = expenseCategories.find(c => c.name === "Giáo dục");
        
        const luong = incomeCategories.find(c => c.name === "Lương");
        const phuCap = incomeCategories.find(c => c.name === "Phụ cấp");
        const khacIncome = incomeCategories.find(c => c.name === "Khác");

        // Tạo transactions cho mỗi tháng
        for (let monthOffset = 0; monthOffset < monthsToGenerate; monthOffset++) {
            const year = startYear + Math.floor((startMonthIndex + monthOffset) / 12);
            const month = (startMonthIndex + monthOffset) % 12;
            const monthDate = new Date(year, month, 1);
            const daysInMonth = new Date(year, month + 1, 0).getDate(); // Số ngày trong tháng

            // THU NHẬP - Sinh viên
            // Phụ cấp từ gia đình (đầu tháng) - 3-5 triệu
            const phuCapDay = 1 + Math.floor(Math.random() * 3); // Ngày 1-3
            transactions.push({
                userId,
                walletId: wallets[1]._id, // Vietcombank
                categoryId: phuCap._id,
                amount: randomAmount(3000000, 5000000),
                type: "income",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), phuCapDay),
                note: `Phụ cấp tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`,
            });

            // Công việc part-time (cuối tháng) - 2-3 triệu (không phải tháng nào cũng có)
            if (Math.random() > 0.3) {
                const partTimeDay = 25 + Math.floor(Math.random() * 5); // Ngày 25-29
                transactions.push({
                    userId,
                    walletId: wallets[0]._id, // Ví tiền mặt
                    categoryId: luong._id,
                    amount: randomAmount(2000000, 3000000),
                    type: "income",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), partTimeDay),
                    note: `Lương part-time tháng ${monthDate.getMonth() + 1}`,
                });
            }

            // CHI TIÊU - Sinh viên
            // Ăn uống - 15-20 giao dịch/tháng, mỗi giao dịch 30k-80k
            for (let i = 0; i < 15 + Math.floor(Math.random() * 6); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                const wallet = wallets[Math.floor(Math.random() * wallets.length)];
                transactions.push({
                    userId,
                    walletId: wallet._id,
                    categoryId: anUong._id,
                    amount: randomAmount(30000, 80000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Ăn uống - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Di chuyển - 10-15 giao dịch/tháng, mỗi giao dịch 10k-30k
            for (let i = 0; i < 10 + Math.floor(Math.random() * 6); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[2]._id, // MoMo
                    categoryId: diChuyen._id,
                    amount: randomAmount(10000, 30000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Xe bus/Grab - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Hóa đơn - Mỗi tháng 1-2 giao dịch (tiền phòng, internet)
            const tienPhongDay = 1 + Math.floor(Math.random() * 10); // Ngày 1-10
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: hoaDon._id,
                amount: randomAmount(800000, 1200000), // Tiền phòng
                type: "expense",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), tienPhongDay),
                note: `Tiền phòng ký túc xá tháng ${monthDate.getMonth() + 1}`,
            });

            if (Math.random() > 0.5) {
                const internetDay = 8 + Math.floor(Math.random() * 5); // Ngày 8-12
                transactions.push({
                    userId,
                    walletId: wallets[1]._id,
                    categoryId: hoaDon._id,
                    amount: roundToThousand(200000), // Internet
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), internetDay),
                    note: `Internet tháng ${monthDate.getMonth() + 1}`,
                });
            }

            // Mua sắm - 2-4 giao dịch/tháng, mỗi giao dịch 100k-500k
            for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * 2)]._id,
                    categoryId: muaSam._id,
                    amount: randomAmount(100000, 500000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Mua sắm - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Giải trí - 3-5 giao dịch/tháng, mỗi giao dịch 50k-200k
            for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * wallets.length)]._id,
                    categoryId: giaiTri._id,
                    amount: randomAmount(50000, 200000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Giải trí - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Giáo dục - Tháng 9 (học phí) và tháng 12 (sách vở)
            if (monthDate.getMonth() === 8) { // Tháng 9
                const hocPhiDay = 10 + Math.floor(Math.random() * 10); // Ngày 10-19
                transactions.push({
                    userId,
                    walletId: wallets[1]._id,
                    categoryId: giaoDuc._id,
                    amount: roundToThousand(5000000), // Học phí kỳ 1
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), hocPhiDay),
                    note: "Học phí kỳ 1 năm học 2025-2026",
                });
            }

            if (monthDate.getMonth() === 11 && Math.random() > 0.5) { // Tháng 12
                const sachDay = 15 + Math.floor(Math.random() * 10); // Ngày 15-24
                transactions.push({
                    userId,
                    walletId: wallets[1]._id,
                    categoryId: giaoDuc._id,
                    amount: randomAmount(500000, 1000000), // Sách vở
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), sachDay),
                    note: "Mua sách giáo trình",
                });
            }

            // Y tế - Thỉnh thoảng (1-2 lần trong cả khoảng thời gian)
            if (Math.random() > 0.85) {
                const yTeDay = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * wallets.length)]._id,
                    categoryId: yTe._id,
                    amount: randomAmount(200000, 500000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), yTeDay),
                    note: "Khám bệnh/mua thuốc",
                });
            }
        }

        // Insert transactions
        if (transactions.length > 0) {
            await Transaction.insertMany(transactions);
            console.log(`✅ Đã tạo ${transactions.length} giao dịch cho sinh viên`);
        }

        // Cập nhật số dư ví dựa trên transactions từ database
        await updateWalletBalances(userId, wallets);

        return transactions;
    } catch (error) {
        console.error("❌ Lỗi khi tạo transactions sinh viên:", error);
        throw error;
    }
};

// Tạo transactions cho người trưởng thành (từ tháng 5/2025 đến hiện tại)
const createAdultTransactions = async (userId, wallets, categories) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const incomeCategories = categories.filter(c => c.type === "income");

        const transactions = [];
        const now = new Date();
        
        // Tính từ tháng 5/2025 đến tháng hiện tại
        const startYear = 2025;
        const startMonthIndex = 4; // Tháng 5 (0-indexed, 4 = May)
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Tính số tháng từ 5/2025 đến hiện tại
        let monthsToGenerate = 0;
        if (currentYear === startYear) {
            if (currentMonth >= startMonthIndex) {
                monthsToGenerate = currentMonth - startMonthIndex + 1; // Bao gồm cả tháng hiện tại
            } else {
                monthsToGenerate = 0; // Chưa đến tháng 5
            }
        } else if (currentYear > startYear) {
            monthsToGenerate = (12 - startMonthIndex) + (currentYear - startYear - 1) * 12 + (currentMonth + 1);
        }

        // Nếu không có tháng nào cần generate, set mặc định là 9 tháng (từ 5/2025 đến 1/2026)
        if (monthsToGenerate === 0) {
            monthsToGenerate = 9; // Từ tháng 5/2025 đến tháng 1/2026
        }

        // Lấy danh mục
        const anUong = expenseCategories.find(c => c.name === "Ăn uống");
        const diChuyen = expenseCategories.find(c => c.name === "Di chuyển");
        const muaSam = expenseCategories.find(c => c.name === "Mua sắm");
        const hoaDon = expenseCategories.find(c => c.name === "Hóa đơn");
        const giaiTri = expenseCategories.find(c => c.name === "Giải trí");
        const yTe = expenseCategories.find(c => c.name === "Y tế");
        
        const luong = incomeCategories.find(c => c.name === "Lương");
        const thuong = incomeCategories.find(c => c.name === "Thưởng");
        const dauTu = incomeCategories.find(c => c.name === "Đầu tư");
        const khacIncome = incomeCategories.find(c => c.name === "Khác");

        // Tạo transactions cho mỗi tháng
        for (let monthOffset = 0; monthOffset < monthsToGenerate; monthOffset++) {
            const year = startYear + Math.floor((startMonthIndex + monthOffset) / 12);
            const month = (startMonthIndex + monthOffset) % 12;
            const monthDate = new Date(year, month, 1);
            const daysInMonth = new Date(year, month + 1, 0).getDate(); // Số ngày trong tháng

            // THU NHẬP - Người trưởng thành
            // Lương - 25-30 triệu/tháng (đầu tháng)
            const luongDay = 1 + Math.floor(Math.random() * 7); // Ngày 1-7
            transactions.push({
                userId,
                walletId: wallets[1]._id, // Vietcombank - Lương
                categoryId: luong._id,
                amount: randomAmount(25000000, 30000000),
                type: "income",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), luongDay),
                note: `Lương tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`,
            });

            // Thưởng (thỉnh thoảng) - 5-10 triệu
            if (Math.random() > 0.7) {
                const thuongDay = 10 + Math.floor(Math.random() * 10); // Ngày 10-19
                transactions.push({
                    userId,
                    walletId: wallets[1]._id,
                    categoryId: thuong._id,
                    amount: randomAmount(5000000, 10000000),
                    type: "income",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), thuongDay),
                    note: `Thưởng tháng ${monthDate.getMonth() + 1}`,
                });
            }

            // Đầu tư (mỗi quý) - 2-5 triệu
            if (monthOffset % 3 === 0 && Math.random() > 0.3) {
                const dauTuDay = 10 + Math.floor(Math.random() * 10); // Ngày 10-19
                transactions.push({
                    userId,
                    walletId: wallets[2]._id, // Techcombank - Tiết kiệm
                    categoryId: dauTu._id,
                    amount: randomAmount(2000000, 5000000),
                    type: "income",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), dauTuDay),
                    note: `Lợi nhuận đầu tư quý ${Math.floor(monthOffset / 3) + 1}`,
                });
            }

            // CHI TIÊU - Người trưởng thành
            // Ăn uống - 20-25 giao dịch/tháng, mỗi giao dịch 100k-300k
            for (let i = 0; i < 20 + Math.floor(Math.random() * 6); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                const wallet = wallets[Math.floor(Math.random() * wallets.length)];
                transactions.push({
                    userId,
                    walletId: wallet._id,
                    categoryId: anUong._id,
                    amount: randomAmount(100000, 300000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Ăn uống - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Di chuyển - 15-20 giao dịch/tháng (xăng, taxi, parking)
            for (let i = 0; i < 15 + Math.floor(Math.random() * 6); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * 2)]._id, // Ví tiền mặt hoặc MoMo
                    categoryId: diChuyen._id,
                    amount: randomAmount(50000, 200000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Xăng/Grab/Parking - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Hóa đơn - Mỗi tháng 3-5 giao dịch (điện, nước, internet, phone, BHYT)
            const dienDay = 1 + Math.floor(Math.random() * 7); // Ngày 1-7
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: hoaDon._id,
                amount: randomAmount(800000, 1500000), // Điện
                type: "expense",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), dienDay),
                note: `Tiền điện tháng ${monthDate.getMonth() + 1}`,
            });

            const nuocDay = 3 + Math.floor(Math.random() * 5); // Ngày 3-7
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: hoaDon._id,
                amount: randomAmount(300000, 600000), // Nước
                type: "expense",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), nuocDay),
                note: `Tiền nước tháng ${monthDate.getMonth() + 1}`,
            });

            const internetDay = 5 + Math.floor(Math.random() * 5); // Ngày 5-9
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: hoaDon._id,
                amount: roundToThousand(300000), // Internet
                type: "expense",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), internetDay),
                note: `Internet tháng ${monthDate.getMonth() + 1}`,
            });

            const phoneDay = 8 + Math.floor(Math.random() * 5); // Ngày 8-12
            transactions.push({
                userId,
                walletId: wallets[1]._id,
                categoryId: hoaDon._id,
                amount: roundToThousand(200000), // Điện thoại
                type: "expense",
                date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), phoneDay),
                note: `Điện thoại tháng ${monthDate.getMonth() + 1}`,
            });

            if (Math.random() > 0.5) {
                const baoHiemDay = 10 + Math.floor(Math.random() * 5); // Ngày 10-14
                transactions.push({
                    userId,
                    walletId: wallets[1]._id,
                    categoryId: hoaDon._id,
                    amount: randomAmount(500000, 800000), // BHYT/BHXH
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), baoHiemDay),
                    note: `Bảo hiểm tháng ${monthDate.getMonth() + 1}`,
                });
            }

            // Mua sắm - 5-8 giao dịch/tháng, mỗi giao dịch 500k-3 triệu
            for (let i = 0; i < 5 + Math.floor(Math.random() * 4); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * 2)]._id,
                    categoryId: muaSam._id,
                    amount: randomAmount(500000, 3000000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Mua sắm - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Giải trí - 4-6 giao dịch/tháng, mỗi giao dịch 200k-1 triệu
            for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * wallets.length)]._id,
                    categoryId: giaiTri._id,
                    amount: randomAmount(200000, 1000000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Giải trí - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Y tế - 1-2 lần/tháng (khám sức khỏe, thuốc)
            for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
                const day = Math.floor(Math.random() * daysInMonth) + 1;
                transactions.push({
                    userId,
                    walletId: wallets[Math.floor(Math.random() * wallets.length)]._id,
                    categoryId: yTe._id,
                    amount: randomAmount(300000, 2000000),
                    type: "expense",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), day),
                    note: `Y tế - ${day}/${monthDate.getMonth() + 1}`,
                });
            }

            // Chuyển tiền vào tiết kiệm - Mỗi tháng 5-10 triệu
            if (Math.random() > 0.2) {
                const transferAmount = randomAmount(5000000, 10000000);
                const transferDay = 15 + Math.floor(Math.random() * 10); // Ngày 15-24
                transactions.push({
                    userId,
                    walletId: wallets[1]._id, // Từ lương
                    toWalletId: wallets[2]._id, // Đến tiết kiệm
                    amount: transferAmount,
                    type: "transfer",
                    date: randomDateTime(monthDate.getFullYear(), monthDate.getMonth(), transferDay),
                    note: `Chuyển tiền tiết kiệm tháng ${monthDate.getMonth() + 1}`,
                });
            }
        }

        // Insert transactions
        if (transactions.length > 0) {
            await Transaction.insertMany(transactions);
            console.log(`✅ Đã tạo ${transactions.length} giao dịch cho người trưởng thành`);
        }

        // Cập nhật số dư ví dựa trên transactions từ database
        await updateWalletBalances(userId, wallets);

        return transactions;
    } catch (error) {
        console.error("❌ Lỗi khi tạo transactions người trưởng thành:", error);
        throw error;
    }
};

// Tạo budgets cho sinh viên
const createStudentBudgets = async (userId, categories, wallets) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const anUong = expenseCategories.find(c => c.name === "Ăn uống");
        const diChuyen = expenseCategories.find(c => c.name === "Di chuyển");
        const muaSam = expenseCategories.find(c => c.name === "Mua sắm");
        const hoaDon = expenseCategories.find(c => c.name === "Hóa đơn");

        const budgets = [
            {
                userId,
                name: "Ngân sách Ăn uống",
                category: anUong._id,
                wallet: wallets[0]._id, // Ví tiền mặt
                limit_amount: roundToThousand(2000000), // 2 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách ăn uống hàng tháng",
            },
            {
                userId,
                name: "Ngân sách Hóa đơn",
                category: hoaDon._id,
                wallet: wallets[1]._id, // Vietcombank
                limit_amount: roundToThousand(1500000), // 1.5 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách hóa đơn (phòng, internet)",
            },
            {
                userId,
                name: "Ngân sách Di chuyển",
                category: diChuyen._id,
                wallet: wallets[2]._id, // MoMo
                limit_amount: roundToThousand(500000), // 500k
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách di chuyển hàng tháng",
            },
            {
                userId,
                name: "Ngân sách Mua sắm",
                category: muaSam._id,
                wallet: wallets[1]._id, // Vietcombank
                limit_amount: roundToThousand(1500000), // 1.5 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách mua sắm hàng tháng",
            },
        ];

        const createdBudgets = await Budget.insertMany(budgets);
        console.log(`✅ Đã tạo ${createdBudgets.length} ngân sách cho sinh viên`);
        return createdBudgets;
    } catch (error) {
        console.error("❌ Lỗi khi tạo budgets sinh viên:", error);
        throw error;
    }
};

// Tạo budgets cho người trưởng thành
const createAdultBudgets = async (userId, categories, wallets) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const anUong = expenseCategories.find(c => c.name === "Ăn uống");
        const diChuyen = expenseCategories.find(c => c.name === "Di chuyển");
        const muaSam = expenseCategories.find(c => c.name === "Mua sắm");
        const hoaDon = expenseCategories.find(c => c.name === "Hóa đơn");
        const giaiTri = expenseCategories.find(c => c.name === "Giải trí");

        const budgets = [
            {
                userId,
                name: "Ngân sách Ăn uống",
                category: anUong._id,
                wallet: null, // Tất cả ví
                limit_amount: roundToThousand(6000000), // 6 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách ăn uống hàng tháng",
            },
            {
                userId,
                name: "Ngân sách Hóa đơn",
                category: hoaDon._id,
                wallet: wallets[1]._id, // Vietcombank - Lương
                limit_amount: roundToThousand(4000000), // 4 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách hóa đơn (điện, nước, internet, điện thoại, bảo hiểm)",
            },
            {
                userId,
                name: "Ngân sách Di chuyển",
                category: diChuyen._id,
                wallet: null, // Tất cả ví
                limit_amount: roundToThousand(3000000), // 3 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách di chuyển (xăng, Grab, parking)",
            },
            {
                userId,
                name: "Ngân sách Mua sắm",
                category: muaSam._id,
                wallet: wallets[1]._id, // Vietcombank - Lương
                limit_amount: roundToThousand(8000000), // 8 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách mua sắm hàng tháng",
            },
            {
                userId,
                name: "Ngân sách Giải trí",
                category: giaiTri._id,
                wallet: null, // Tất cả ví
                limit_amount: roundToThousand(5000000), // 5 triệu
                period: "monthly",
                start_date: currentMonth,
                end_date: currentMonthEnd,
                description: "Ngân sách giải trí hàng tháng",
            },
        ];

        const createdBudgets = await Budget.insertMany(budgets);
        console.log(`✅ Đã tạo ${createdBudgets.length} ngân sách cho người trưởng thành`);
        return createdBudgets;
    } catch (error) {
        console.error("❌ Lỗi khi tạo budgets người trưởng thành:", error);
        throw error;
    }
};

// Tạo recurring bills cho sinh viên
const createStudentRecurringBills = async (userId, categories, wallets) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const hoaDon = expenseCategories.find(c => c.name === "Hóa đơn");

        const recurringBills = [
            {
                userId,
                name: "Tiền phòng ký túc xá",
                wallet: wallets[1]._id, // Vietcombank
                category: hoaDon._id,
                amount: roundToThousand(1000000), // 1 triệu
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Tiền phòng ký túc xá hàng tháng",
            },
            {
                userId,
                name: "Internet",
                wallet: wallets[1]._id, // Vietcombank
                category: hoaDon._id,
                amount: roundToThousand(200000), // 200k
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Hóa đơn Internet hàng tháng",
            },
        ];

        const createdBills = [];
        for (const billData of recurringBills) {
            const bill = await RecurringBill.create(billData);
            createdBills.push(bill);
        }

        console.log(`✅ Đã tạo ${createdBills.length} hóa đơn định kỳ cho sinh viên`);
        return createdBills;
    } catch (error) {
        console.error("❌ Lỗi khi tạo recurring bills sinh viên:", error);
        throw error;
    }
};

// Tạo recurring bills cho người trưởng thành
const createAdultRecurringBills = async (userId, categories, wallets) => {
    try {
        const expenseCategories = categories.filter(c => c.type === "expense");
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const hoaDon = expenseCategories.find(c => c.name === "Hóa đơn");
        const giaiTri = expenseCategories.find(c => c.name === "Giải trí");

        const recurringBills = [
            {
                userId,
                name: "Tiền điện",
                wallet: wallets[1]._id, // Vietcombank - Lương
                category: hoaDon._id,
                amount: roundToThousand(1200000), // 1.2 triệu
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
                category: hoaDon._id,
                amount: roundToThousand(500000), // 500k
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
                name: "Internet + Cáp quang",
                wallet: wallets[1]._id,
                category: hoaDon._id,
                amount: roundToThousand(300000), // 300k
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Hóa đơn Internet và truyền hình cáp",
            },
            {
                userId,
                name: "Điện thoại",
                wallet: wallets[1]._id,
                category: hoaDon._id,
                amount: roundToThousand(200000), // 200k
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Hóa đơn điện thoại hàng tháng",
            },
            {
                userId,
                name: "Bảo hiểm Y tế + Xã hội",
                wallet: wallets[1]._id,
                category: hoaDon._id,
                amount: roundToThousand(700000), // 700k
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Bảo hiểm y tế và xã hội hàng tháng",
            },
            {
                userId,
                name: "Netflix",
                wallet: wallets[3]._id, // MoMo
                category: giaiTri._id,
                amount: roundToThousand(180000), // 180k
                type: "expense",
                frequency: "monthly",
                next_run: nextMonth,
                ends_at: null,
                active: true,
                auto_create_transaction: true,
                description: "Gói Netflix Premium",
            },
        ];

        const createdBills = [];
        for (const billData of recurringBills) {
            const bill = await RecurringBill.create(billData);
            createdBills.push(bill);
        }

        console.log(`✅ Đã tạo ${createdBills.length} hóa đơn định kỳ cho người trưởng thành`);
        return createdBills;
    } catch (error) {
        console.error("❌ Lỗi khi tạo recurring bills người trưởng thành:", error);
        throw error;
    }
};

// Tạo saving goals cho sinh viên
const createStudentSavingGoals = async (userId, wallets) => {
    try {
        const now = new Date();
        const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), 1);
        const next6Months = new Date(now.getFullYear(), now.getMonth() + 6, 1);

        const savingGoals = [
            {
                userId,
                name: "Laptop mới",
                wallet: wallets[1]._id, // Vietcombank
                target_amount: roundToThousand(15000000), // 15 triệu
                current_amount: roundToThousand(3000000), // 3 triệu (đã tiết kiệm)
                target_date: nextYear,
                is_active: true,
                description: "Tiết kiệm để mua laptop mới phục vụ học tập",
            },
            {
                userId,
                name: "Quỹ khẩn cấp",
                wallet: wallets[1]._id, // Vietcombank
                target_amount: roundToThousand(5000000), // 5 triệu
                current_amount: roundToThousand(2000000), // 2 triệu
                target_date: null, // Không có hạn
                is_active: true,
                description: "Quỹ dự phòng khẩn cấp cho sinh viên",
            },
        ];

        const createdGoals = await SavingGoal.insertMany(savingGoals);
        console.log(`✅ Đã tạo ${createdGoals.length} mục tiêu tiết kiệm cho sinh viên`);
        return createdGoals;
    } catch (error) {
        console.error("❌ Lỗi khi tạo saving goals sinh viên:", error);
        throw error;
    }
};

// Tạo saving goals cho người trưởng thành
const createAdultSavingGoals = async (userId, wallets) => {
    try {
        const now = new Date();
        const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), 1);
        const next2Years = new Date(now.getFullYear() + 2, now.getMonth(), 1);

        const savingGoals = [
            {
                userId,
                name: "Mua xe hơi",
                wallet: wallets[2]._id, // Techcombank - Tiết kiệm
                target_amount: roundToThousand(500000000), // 500 triệu
                current_amount: roundToThousand(100000000), // 100 triệu (đã tiết kiệm)
                target_date: next2Years,
                is_active: true,
                description: "Tiết kiệm để mua xe hơi",
            },
            {
                userId,
                name: "Du lịch châu Âu",
                wallet: wallets[2]._id, // Techcombank - Tiết kiệm
                target_amount: roundToThousand(50000000), // 50 triệu
                current_amount: roundToThousand(10000000), // 10 triệu
                target_date: nextYear,
                is_active: true,
                description: "Tiết kiệm cho chuyến du lịch châu Âu",
            },
            {
                userId,
                name: "Quỹ khẩn cấp",
                wallet: wallets[2]._id, // Techcombank - Tiết kiệm
                target_amount: roundToThousand(100000000), // 100 triệu
                current_amount: roundToThousand(100000000), // 100 triệu (đã đạt mục tiêu)
                target_date: null, // Không có hạn
                is_active: true,
                description: "Quỹ dự phòng khẩn cấp (đã đạt mục tiêu)",
            },
        ];

        const createdGoals = await SavingGoal.insertMany(savingGoals);
        console.log(`✅ Đã tạo ${createdGoals.length} mục tiêu tiết kiệm cho người trưởng thành`);
        return createdGoals;
    } catch (error) {
        console.error("❌ Lỗi khi tạo saving goals người trưởng thành:", error);
        throw error;
    }
};

// Cập nhật số dư ví dựa trên transactions từ database
// wallets phải là mảng các wallet object từ database (đã có _id và balance ban đầu)
const updateWalletBalances = async (userId, wallets) => {
    try {
        // Lưu số dư ban đầu của mỗi ví từ database (số dư khi tạo ví)
        const initialBalances = {};
        for (const wallet of wallets) {
            // Lấy số dư ban đầu từ wallet object (số dư khi tạo ví, trước khi có transactions)
            // Balance này đã được set khi tạo ví trong createStudentWallets/createAdultWallets
            initialBalances[wallet._id.toString()] = Number(wallet.balance) || 0;
        }

        // Lấy tất cả transactions từ database và sắp xếp theo ngày
        const allTransactions = await Transaction.find({ userId }).sort({ date: 1 });

        // Tính số dư cuối cùng cho mỗi ví: bắt đầu từ số dư ban đầu
        const finalBalances = {};
        for (const walletId in initialBalances) {
            finalBalances[walletId] = initialBalances[walletId];
        }

        // Tính lại balance từ transactions
        for (const transaction of allTransactions) {
            if (transaction.type === "income" && transaction.walletId) {
                const walletId = transaction.walletId.toString();
                if (finalBalances[walletId] !== undefined) {
                    finalBalances[walletId] += Number(transaction.amount) || 0;
                }
            } else if (transaction.type === "expense" && transaction.walletId) {
                const walletId = transaction.walletId.toString();
                if (finalBalances[walletId] !== undefined) {
                    finalBalances[walletId] -= Number(transaction.amount) || 0;
                }
            } else if (transaction.type === "transfer") {
                if (transaction.walletId) {
                    const fromWalletId = transaction.walletId.toString();
                    if (finalBalances[fromWalletId] !== undefined) {
                        finalBalances[fromWalletId] -= Number(transaction.amount) || 0;
                    }
                }
                if (transaction.toWalletId) {
                    const toWalletId = transaction.toWalletId.toString();
                    if (finalBalances[toWalletId] !== undefined) {
                        finalBalances[toWalletId] += Number(transaction.amount) || 0;
                    }
                }
            }
        }

        // Cập nhật balance cho mỗi ví
        for (const wallet of wallets) {
            const walletId = wallet._id.toString();
            let balance = finalBalances[walletId] || 0;
            // Đảm bảo >= 0 cho các ví thông thường (có thể âm cho credit card)
            balance = Math.max(0, roundToThousand(balance));
            
            await Wallet.updateOne(
                { _id: wallet._id },
                { $set: { balance } }
            );
        }

        console.log("✅ Đã cập nhật số dư ví");
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật số dư ví:", error);
        throw error;
    }
};

// Main function
const seedStudentAdult = async () => {
    try {
        console.log("🌱 Bắt đầu seed dữ liệu sinh viên và người trưởng thành...\n");

        // Kết nối database
        await connectDB();

        // ========== SINH VIÊN ==========
        console.log("\n📚 === SEED DỮ LIỆU SINH VIÊN ===");
        const student = await createOrFindStudent();
        await clearUserData(student._id);
        const studentWallets = await createStudentWallets(student._id);
        const studentCategories = await createCategories(student._id);
        await createStudentTransactions(student._id, studentWallets, studentCategories);
        await createStudentBudgets(student._id, studentCategories, studentWallets);
        await createStudentRecurringBills(student._id, studentCategories, studentWallets);
        await createStudentSavingGoals(student._id, studentWallets);

        // ========== NGƯỜI TRƯỞNG THÀNH ==========
        console.log("\n👔 === SEED DỮ LIỆU NGƯỜI TRƯỞNG THÀNH ===");
        const adult = await createOrFindAdult();
        await clearUserData(adult._id);
        const adultWallets = await createAdultWallets(adult._id);
        const adultCategories = await createCategories(adult._id);
        await createAdultTransactions(adult._id, adultWallets, adultCategories);
        await createAdultBudgets(adult._id, adultCategories, adultWallets);
        await createAdultRecurringBills(adult._id, adultCategories, adultWallets);
        await createAdultSavingGoals(adult._id, adultWallets);

        console.log("\n✅ Hoàn thành seed dữ liệu!");
        console.log("\n📝 Thông tin đăng nhập:");
        console.log("   👨‍🎓 Sinh viên:");
        console.log("      Email: sinhvien@example.com");
        console.log("      Password: 123456");
        console.log("\n   👔 Người trưởng thành:");
        console.log("      Email: nguoitruongthanh@example.com");
        console.log("      Password: 123456");
        console.log("\n");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Lỗi khi seed dữ liệu:", error);
        process.exit(1);
    }
};

// Chạy seed
if (require.main === module) {
    seedStudentAdult();
}

module.exports = seedStudentAdult;

