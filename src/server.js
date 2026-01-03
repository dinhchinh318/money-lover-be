require("dotenv").config();
const express = require("express");
const connection = require("./configs/db");
const initRoute = require("./routes/index");
const cors = require("cors");

const port = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://money-lover-be-eyca.onrender.com",
      "https://moneylover-iota.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "delay"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initRoute(app);

const startServer = async () => {
  try {
    await connection();
    app.listen(port, () => {
      console.log(`App is listening on port: ${port}`);
    });
  } catch (error) {
    console.log("Error starting server:", error);
    process.exit(1);
  }
};

startServer();