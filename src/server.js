require("dotenv").config();
const express = require("express");
const connection = require("./configs/db");
const initRoute = require("./routes/index");
const cors = require("cors");
const aiRoutes = require("./routes/ai.routes");
const port = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://money-lover-be-eyca.onrender.com",
      "http://moneylover-iota.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "delay"],
    credentials: true,
  })
);

// Increase body size limit to handle base64 images (up to 5MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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