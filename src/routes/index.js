const authRoute = require("../routes/auth.routes");
const walletRoute = require("../routes/wallet.routes");

const initRoute = (app) => {
    app.use("/v1/api/auth", authRoute);
    app.use("/wallet", walletRoute);
}

module.exports = initRoute;