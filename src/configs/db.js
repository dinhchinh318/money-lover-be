require('dotenv').config();
const mongoose = require("mongoose");

const connection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        // Database connected successfully
    } catch (error) {
        // Database connection error
        process.exit(1);
    }
}

module.exports = connection