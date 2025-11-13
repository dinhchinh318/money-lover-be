require('dotenv').config();
const mongoose = require("mongoose");

const connection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Database connection successfully");
    } catch (error) {
        console.log("Database connection error!");
        process.exit(1);
    }
}

module.exports = connection