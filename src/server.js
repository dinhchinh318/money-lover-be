require("dotenv").config();
const express = require("express");
const connection = require("./configs/DB");
const initRoute = require("./routes/index");
const cors = require("cors");
const aiRoutes = require("./routes/ai.routes");

const port = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
    //   "https://bingcloth-be.onrender.com",
    //   "https://bingcloth.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "delay"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/ai', aiRoutes);

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