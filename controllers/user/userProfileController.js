const { profile } = require("winston");
const User = require("../../models/userSchema");
const Order = require('../../models/orderSchema');

exports.loadProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId).lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const recentOrders = await Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        // Format orders for the view
        const formattedOrders = recentOrders.map(order => ({
            orderNumber: order._id.toString().slice(-6),
            amount: order.orderAmount,
            status: order.status,
            date: new Date(order.createdAt).toLocaleDateString()
        }));

        // User profile data
        const userProfile = {
            name: user.name,
            email: user.email,
            phone: user.phone || 'Not provided',
            memberSince: new Date(user.createdOn).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            }),
            status: user.isBlocked ? 'Blocked' : 'Active',
            isVerified: user.isVerified,
            wallet: user.wallet || 0,
            profileImage: user.profileImage || '/api/placeholder/120/120',
            accountDetails: {
                isAdmin: user.isAdmin || false,
                isVerified: user.isVerified,
                googleLinked: !!user.googleId,
                verificationStatus: user.isVerified ? 'Verified' : 'Unverified'
            }
        };

        // Render the profile page with user data and recent orders
        res.render('user/profile', {
            userProfile,
            orders: formattedOrders
        });

    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get profile edit page
exports.getEditProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).lean();

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/profile');
        }

        // Prepare userProfile object for sidebar
        const userProfile = {
            name: user.name,
            email: user.email,
            phone: user.phone || 'Not provided',
            memberSince: new Date(user.createdOn).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            }),
            status: user.isBlocked ? 'Blocked' : 'Active'
        };

        res.render('user/editProfile', {
            user: req.user,
            userProfile, // Pass userProfile for the sidebar
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            },
            errors: {}
        });
    } catch (error) {
        console.error('Error loading edit profile:', error);
        req.flash('error', 'An error occurred while loading the edit profile page.');
        res.redirect('/profile');
    }
};

// Validate input
const validateInput = (input) => {
    const errors = {};
    
    // Name validation
    if (!input.name || typeof input.name !== 'string') {
        errors.name = 'Full Name is required';
    } else if (input.name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters long';
    } else if (input.name.trim().length > 50) {
        errors.name = 'Name cannot exceed 50 characters';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!input.email || typeof input.email !== 'string') {
        errors.email = 'Email Address is required';
    } else if (!emailRegex.test(input.email.trim())) {
        errors.email = 'Please enter a valid email address';
    }

    // Phone validation
    const phoneRegex = /^\d{10}$/;
    if (!input.phone || typeof input.phone !== 'string') {
        errors.phone = 'Phone Number is required';
    } else if (!phoneRegex.test(input.phone.trim())) {
        errors.phone = 'Please enter a valid 10-digit phone number';
    }

    // Password validation (optional)
    if (input.password) {
        if (typeof input.password !== 'string') {
            errors.password = 'Invalid password format';
        } else if (input.password.length < 6) {
            errors.password = 'Password must be at least 6 characters long';
        } else if (input.password.length > 100) {
            errors.password = 'Password is too long';
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// Sanitize input
const sanitizeInput = (input) => {
    return {
        name: input.name?.trim(),
        email: input.email?.trim().toLowerCase(),
        phone: input.phone?.trim(),
        password: input.password
    };
};

// Handle profile update
exports.postEditProfile = async (req, res) => {
    try {
        // Sanitize input
        const sanitizedInput = sanitizeInput(req.body);
        
        // Validate input
        const { isValid, errors } = validateInput(sanitizedInput);
        
        if (!isValid) {
            const userId = req.user._id;
            const user = await User.findById(userId).lean();
            const userProfile = {
                name: user.name,
                email: user.email,
                phone: user.phone || 'Not provided',
                memberSince: new Date(user.createdOn).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                }),
                status: user.isBlocked ? 'Blocked' : 'Active'
            };

            return res.render('user/editProfile', {
                user: sanitizedInput,
                userProfile,
                errors,
                messages: {}
            });
        }

        // Check if email is already in use by another user
        const existingUser = await User.findOne({ 
            email: sanitizedInput.email, 
            _id: { $ne: req.user.id } 
        });

        if (existingUser) {
            const userId = req.user._id;
            const user = await User.findById(userId).lean();
            const userProfile = {
                name: user.name,
                email: user.email,
                phone: user.phone || 'Not provided',
                memberSince: new Date(user.createdOn).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                }),
                status: user.isBlocked ? 'Blocked' : 'Active'
            };

            return res.render('user/editProfile', {
                user: sanitizedInput,
                userProfile,
                errors: { email: 'Email is already in use' },
                messages: {}
            });
        }

        // Find current user
        const user = await User.findById(req.user.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/edit-profile');
        }

        // Update user fields
        user.name = sanitizedInput.name;
        user.email = sanitizedInput.email;
        user.phone = sanitizedInput.phone;

        // Update password if provided
        if (sanitizedInput.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(sanitizedInput.password, salt);
        }

        await user.save();
        
        req.flash('success', 'Profile updated successfully!');
        res.redirect('/profile');

    } catch (error) {
        console.error('Profile update error:', error);
        
        // Handle different types of errors
        if (error.name === 'MongoError' && error.code === 11000) {
            const userId = req.user._id;
            const user = await User.findById(userId).lean();
            const userProfile = {
                name: user.name,
                email: user.email,
                phone: user.phone || 'Not provided',
                memberSince: new Date(user.createdOn).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                }),
                status: user.isBlocked ? 'Blocked' : 'Active'
            };

            return res.render('user/editProfile', {
                user: req.body,
                userProfile,
                errors: { email: 'Email is already in use' },
                messages: {}
            });
        }
        
        req.flash('error', 'An error occurred while updating your profile. Please try again.');
        res.redirect('/edit-profile');
    }
};