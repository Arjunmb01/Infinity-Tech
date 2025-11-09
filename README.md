# InfinityTech E-Commerce Platform

A modern, full-featured e-commerce platform built with **Node.js**, **Express**, and **MongoDB**, featuring a stunning glass-effect admin dashboard and Cloudinary-powered image storage.

---

## 🌟 Features

### 🛍️ Customer Features
- Secure user authentication (via sessions)
- Product browsing with advanced filters
- Shopping cart and checkout system
- Order tracking and history
- User profile and address management
- Wishlist and wallet management

### 🧑‍💼 Admin Features
- Modern glass-effect admin dashboard
- Real-time analytics and statistics
- Product management (CRUD operations)
- Category and offer management
- Order and return management
- Coupon management
- Customer management
- Inventory tracking and sales reports

---

## 🚀 Technology Stack

### Frontend
- **EJS** (Embedded JavaScript Templates)
- **Tailwind CSS**
- **JavaScript**
- Responsive glass-effect UI components

### Backend
- **Node.js** + **Express.js**
- **MongoDB** + **Mongoose**
- **Cloudinary** (for image uploads)
- **Multer** (middleware for handling uploads)
- **Nodemailer** (email communication)

### Authentication
- **Session-based authentication**
- **Passport.js** (Google login integration)

### Other Tools
- **Bcrypt** for password hashing
- **Helmet** for security headers
- **Morgan** for logging
- **Connect-flash** for notifications
- **Razorpay** for payment gateway integration

---

## ☁️ Cloudinary Integration

InfinityTech now stores all product images securely in **Cloudinary**, replacing local file uploads.

### Benefits:
- Fast and globally cached image delivery
- Automatic optimization (size, format)
- No need for local `/uploads` folder
- Works perfectly with Vercel or any cloud host

---

## 🧰 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/infinitytech.git
   cd infinitytech
Install dependencies

npm install


Create a .env file in the project root and add:

PORT=3000
MONGO_URL=your_mongodb_connection_string
SESSION_SECRET=your_session_secret

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay Test Keys
Test_Key_ID=your_test_key
Test_Key_Secret=your_test_secret


# Start the development server

npm run dev

# 🧱 Project Structure
infinitytech/
├── config/             # Config files (DB, Cloudinary, Passport, Razorpay)
├── controllers/        # Business logic (Admin + User)
├── middleware/         # Authentication and error handling
├── models/             # Mongoose Schemas
├── public/             # Static assets (CSS, JS, Images)
├── routes/             # Route definitions
├── utils/              # Utility functions (validation, offers, etc.)
├── views/              # EJS templates
│   ├── admin/          # Admin panel views
│   └── user/           # Customer views
└── app.js              # Main application file


# Features:

Real-time statistics dashboard

Add/Edit/Delete products

Upload images directly to Cloudinary

Manage categories, offers, coupons, and orders

Handle customer return requests

Download sales reports

# 🎨 UI Highlights

Glass-effect containers and gradients

Responsive layout with Tailwind CSS

Interactive modals and alerts

Smooth transitions and clean typography

# 🧾 Development Scripts
Command	Description
npm run dev	Run app in development mode (nodemon)
npm start	Start the production server
🧪 Testing (Optional)
npm test

# 📱 Responsive Design

Fully optimized for:

🖥️ Desktop

💻 Laptops

📱 Mobile devices

# 🔒 Security

Password hashing using bcrypt

Secure sessions

Helmet.js protection

Input sanitization

Error handling middleware

# 🤝 Contributing

Fork the repository

Create a new branch (git checkout -b feature/AmazingFeature)

Commit changes (git commit -m "Add some AmazingFeature")

Push to branch (git push origin feature/AmazingFeature)

Open a Pull Request

# 📄 License

This project is licensed under the MIT License.

# 👥 Author

Arjun M B
Full Stack Developer (MERN & Django)
https://github.com/Arjunmb01

# 🙏 Acknowledgments

MongoDB Atlas for database hosting

Cloudinary for image storage

Razorpay for payment integration

Tailwind & EJS for beautiful UI components