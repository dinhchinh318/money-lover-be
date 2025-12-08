const authRoute = require("../routes/auth.routes");
const walletRoute = require("../routes/wallet.routes");
const categoryRoute = require("../routes/category.routes");
const transactionRoute = require("../routes/transaction.routes");
const reportRoute = require("../routes/report.routes");
const analyticsRoute = require("../routes/analytics.routes");

const initRoute = (app) => {
    app.use("/v1/api/auth", authRoute);
    app.use("/wallet", walletRoute);
    app.use("/category", categoryRoute);
    app.use("/transaction", transactionRoute);
    app.use("/report", reportRoute);
    app.use("/analytics", analyticsRoute);
}

module.exports = initRoute;