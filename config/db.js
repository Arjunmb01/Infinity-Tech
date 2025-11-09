const mongoose = require('mongoose');
require('dotenv').config();

console.log("🧩 Loaded MONGO_URL:", process.env.MONGODB_URI);


const connectDb = async () => {
  try {
    const uri = process.env.MONGODB_URI;


    if (!uri) {
      throw new Error("❌ MONGODB_URI is missing or undefined in .env file");
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
    process.exit(1); 
  }
};

module.exports = connectDb;
