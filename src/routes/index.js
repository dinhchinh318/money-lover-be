const authRoute = require("../routes/auth.routes");

const initRoute = (app) => {
    app.use("/v1/api/auth", authRoute);
}

module.exports = initRoute;