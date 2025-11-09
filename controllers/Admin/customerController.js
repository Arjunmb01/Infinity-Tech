const User = require('../../models/userSchema');

// Controller to fetch and display customer information
const customerInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 7;
        const skip = (page - 1) * limit;

        // Get search and filter parameters
        const searchQuery = req.query.search || '';
        const statusFilter = req.query.status || 'all';
        
        // Build filter conditions
        let filterConditions = { isAdmin: false }; // Updated to Boolean
        
        if (searchQuery) {
            filterConditions.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { phone: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        if (statusFilter !== 'all') {
            filterConditions.isBlocked = statusFilter === 'blocked';
        }

        const totalItems = await User.countDocuments(filterConditions);
        const totalPages = Math.ceil(totalItems / limit);

        const customers = await User.find(filterConditions)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        const breadcrumbs = [{ name: 'Customers', url: '/admin/users' }];

        res.render('admin/customers', {
            path:req.path,
            customers,
            pagination: { 
                currentPage: page, 
                totalPages, 
                startPage, 
                endPage,
                searchQuery,
                statusFilter
            },
            breadcrumbs,
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        req.flash('error', 'Server Error');
        res.status(500).send('Server Error');
    }
};

// Controller to block/unblock a user
const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(`Attempting to block/unblock user ${userId}`);
        const user = await User.findById(userId);
        
        if (!user) {
            console.log(`User ${userId} not found`);
            req.flash('error', 'User not found');
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();
        console.log(`User ${userId} updated, isBlocked: ${user.isBlocked}`);

        const action = user.isBlocked ? 'blocked' : 'unblocked';
        req.flash('success', `User has been ${action} successfully`);
        res.status(200).json({
            success: true,
            message: `User has been ${action} successfully`,
            isBlocked: user.isBlocked
        });
    } catch (error) {
        console.error('Error in blockUser:', error);
        req.flash('error', 'Failed to update user status');
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update user status' 
        });
    }
};

module.exports = {
    customerInfo,
    blockUser,
};