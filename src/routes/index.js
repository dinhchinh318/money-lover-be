const authRoute = require("../routes/auth.routes");
const walletRoute = require("../routes/wallet.routes");
const categoryRoute = require("../routes/category.routes");
const transactionRoute = require("../routes/transaction.routes");
const reportRoute = require("../routes/report.routes");
const analyticsRoute = require("../routes/analytics.routes");
const budgetRoute = require("../routes/budget.routes");
const initRoute = (app) => {
    app.use("/v1/api/auth", authRoute);
    app.use("/v1/api/wallet", walletRoute);
    app.use("/v1/api/category", categoryRoute);
    app.use("/v1/api/transaction", transactionRoute);
    app.use("/v1/api/budgets", budgetRoute);
    app.use("/v1/api/report", reportRoute);
    app.use("/v1/api/analytics", analyticsRoute);
}

module.exports = initRoute;