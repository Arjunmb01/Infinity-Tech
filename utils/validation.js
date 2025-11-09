const { body, validationResult } = require('express-validator');

// User validation rules
const userValidationRules = {
    signup: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Name is required')
            .matches(/^[a-zA-Z]/)
            .withMessage('Name must start with an alphabet')
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Name can only contain letters and spaces')
            .isLength({ min: 2 })
            .withMessage('Name must be at least 2 characters long'),
        
        body('email')
            .trim()
            .notEmpty()
            .withMessage('Email is required')
            .isEmail()
            .withMessage('Please enter a valid email address')
            .normalizeEmail()
            .custom(async (email, { req }) => {
                // Skip email uniqueness check for profile updates
                if (req.user && req.user.email === email) {
                    return true;
                }
                const User = require('../models/userSchema');
                const existingUser = await User.findOne({ email: email.toLowerCase() });
                if (existingUser) {
                    throw new Error('Email already registered');
                }
                return true;
            }),
        
        body('phone')
            .trim()
            .notEmpty()
            .withMessage('Phone number is required')
            .matches(/^\d{10}$/)
            .withMessage('Please enter a valid 10-digit phone number'),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
        
        body('confirmPassword')
            .notEmpty()
            .withMessage('Please confirm your password')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],

    login: [
        body('email')
            .trim()
            .notEmpty()
            .withMessage('Email is required')
            .isEmail()
            .withMessage('Please enter a valid email address')
            .normalizeEmail(),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ]
};

// Custom validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Store old input in flash for form repopulation
        req.flash('oldInput', req.body);
        
        // Get the first error message
        const firstError = errors.array()[0];
        req.flash('error', firstError.msg);
        
        // Determine redirect path based on the current route
        const redirectPath = req.path.includes('login') ? '/login' : '/signup';
        return res.redirect(redirectPath);
    }
    next();
};

// Export validation rules and middleware
module.exports = {
    userValidationRules,
    validate
};
