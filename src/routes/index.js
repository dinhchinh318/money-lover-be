const authRoute = require("../routes/auth.routes");
const walletRoute = require("../routes/wallet.routes");
const categoryRoute = require("../routes/category.routes");
const transactionRoute = require("../routes/transaction.routes")

const initRoute = (app) => {
    app.use("/v1/api/auth", authRoute);
    app.use("/wallet", walletRoute);
    app.use("/category", categoryRoute);
    app.use("/transaction", transactionRoute);
}

module.exports = initRoute;