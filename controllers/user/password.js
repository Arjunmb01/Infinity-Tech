const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send OTP email
const sendResetEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset OTP',
        html: `
            <h1>Password Reset Request</h1>
            <p>Your OTP for password reset is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP ${otp} sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending reset email:', error);
        return false;
    }
};

// Generate OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.getForgotPasswordPage = (req, res) => {
    res.render('user/forgotPassword', { 
        title: 'Forgot Password',
        messages: req.flash() || { error: [], success: [] }
    });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Processing forgot password for email:', email);

        // Backend Validation
        if (!email) {
            req.flash('error', 'Email is required');
            return res.redirect('/forgotPassword');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            req.flash('error', 'Please enter a valid email address');
            return res.redirect('/forgotPassword');
        }

        const user = await User.findOne({ email });
        if (!user) {
            req.flash('success', 'If an account exists with this email, you will receive reset instructions.');
            return res.redirect('/forgotPassword');
        }

        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

        user.resetPasswordOTP = { code: otp, expiresAt: otpExpiry };
        await user.save();

        const emailSent = await sendResetEmail(email, otp);
        if (!emailSent) {
            req.flash('error', 'Failed to send OTP. Please try again.');
            return res.redirect('/forgotPassword');
        }

        req.flash('success', 'OTP sent to your email');
        return res.redirect(`/forgotOtp?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error', 'Server error. Please try again later.');
        return res.redirect('/forgotPassword');
    }
};

exports.getVerifyOTP = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            req.flash('error', 'Invalid request. Please start over.');
            return res.redirect('/forgotPassword');
        }
        res.render('user/forgotOtp', { 
            email,
            messages: req.flash() || { error: [], success: [] }
        });
    } catch (error) {
        console.error('Error loading OTP verification page:', error);
        req.flash('error', 'Server error');
        return res.redirect('/forgotPassword');
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log('Verifying OTP:', otp, 'for email:', email);

        if (!email || !otp) {
            req.flash('error', 'Email and OTP are required');
            return res.redirect(`/forgotOtp?email=${encodeURIComponent(email)}`);
        }

        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/forgotPassword');
        }

        if (!user.resetPasswordOTP?.code || !user.resetPasswordOTP?.expiresAt) {
            req.flash('error', 'No OTP request found');
            return res.redirect(`/forgotOtp?email=${encodeURIComponent(email)}`);
        }

        if (new Date() > user.resetPasswordOTP.expiresAt) {
            user.resetPasswordOTP = { code: null, expiresAt: null };
            await user.save();
            req.flash('error', 'OTP has expired');
            return res.redirect(`/forgotOtp?email=${encodeURIComponent(email)}`);
        }

        if (user.resetPasswordOTP.code !== otp) {
            req.flash('error', 'Invalid OTP');
            return res.redirect(`/forgotOtp?email=${encodeURIComponent(email)}`);
        }

        req.flash('success', 'OTP verified successfully');
        return res.redirect(`/resetPassword?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error('OTP verification error:', error);
        req.flash('error', 'Internal server error');
        return res.redirect(`/forgotOtp?email=${encodeURIComponent(req.body.email)}`);
    }
};

exports.getResetPassword = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            req.flash('error', 'Invalid request. Please start over.');
            return res.redirect('/forgotPassword');
        }
        res.render('user/resetPassword', { 
            email,
            messages: req.flash() || { error: [], success: [] }
        });
    } catch (error) {
        console.error('Error loading reset password page:', error);
        req.flash('error', 'Server error');
        return res.redirect('/forgotPassword');
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error', 'Email and password are required');
            return res.redirect(`/resetPassword?email=${encodeURIComponent(email)}`);
        }

        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/forgotPassword');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.password = hashedPassword;
        user.resetPasswordOTP = { code: null, expiresAt: null };
        await user.save();

        req.flash('success', 'Password reset successful');
        return res.redirect('/login');
    } catch (error) {
        console.error('Password reset error:', error);
        req.flash('error', 'Internal server error');
        return res.redirect(`/resetPassword?email=${encodeURIComponent(req.body.email)}`);
    }
};