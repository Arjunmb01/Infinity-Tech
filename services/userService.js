const User = require('../models/userSchema');
const bcrypt = require('bcrypt');
const { generateOTP, sendOTPEmail, verifyOTP } = require('../utils/otpUtils');

class UserService {
    // Store temporary user data and OTPs
    static tempUserStorage = new Map();

    // Handle user registration
    static async initiateRegistration(userData) {
        try {
            // Generate OTP
            const otp = generateOTP();
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            // Store user data temporarily with OTP
            const tempUserData = {
                ...userData,
                password: hashedPassword,
                otp,
                otpExpiry: Date.now() + 600000 // 10 minutes
            };
            
            // Save to temporary storage
            this.tempUserStorage.set(userData.email, tempUserData);
            
            // Send OTP email
            await sendOTPEmail(userData.email, otp);
            
            return true;
        } catch (error) {
            console.error('Error in initiateRegistration:', error);
            throw error;
        }
    }

    // Verify OTP and complete registration
    static async verifyAndRegister(email, submittedOTP) {
        try {
            const userData = this.tempUserStorage.get(email);
            
            if (!userData) {
                throw new Error('Registration session expired');
            }

            if (Date.now() > userData.otpExpiry) {
                this.tempUserStorage.delete(email);
                throw new Error('OTP expired');
            }

            if (!verifyOTP(userData.otp, submittedOTP)) {
                throw new Error('Invalid OTP');
            }

            // Create new user in database
            const { otp, otpExpiry, ...userDataToSave } = userData;
            const newUser = new User(userDataToSave);
            await newUser.save();

            // Clear temporary storage
            this.tempUserStorage.delete(email);

            return newUser;
        } catch (error) {
            console.error('Error in verifyAndRegister:', error);
            throw error;
        }
    }

    // Resend OTP
    static async resendOTP(email) {
        try {
            const userData = this.tempUserStorage.get(email);
            
            if (!userData) {
                throw new Error('Registration session expired');
            }

            // Generate new OTP
            const newOTP = generateOTP();
            
            // Update stored data
            userData.otp = newOTP;
            userData.otpExpiry = Date.now() + 600000; // 10 minutes
            this.tempUserStorage.set(email, userData);

            // Send new OTP
            await sendOTPEmail(email, newOTP);

            return true;
        } catch (error) {
            console.error('Error in resendOTP:', error);
            throw error;
        }
    }
}

module.exports = UserService;
