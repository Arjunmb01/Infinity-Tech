const Razorpay = require('razorpay');
require('dotenv').config();

exports.createRazorpayInstance = () => {
    try {
        if (!process.env.Test_Key_ID || !process.env.Test_Key_Secret) {
            throw new Error('Razorpay keys are not defined in environment variables');
        }

        const instance = new Razorpay({
            key_id: process.env.Test_Key_ID,
            key_secret: process.env.Test_Key_Secret,
        });

        return instance;
    } catch (error) {
        console.error('Error creating Razorpay instance:', error.message, error.stack);
        throw error;
    }
};