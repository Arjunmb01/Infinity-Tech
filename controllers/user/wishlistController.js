const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

exports.getWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const userId = req.session.user._id;
        const wishlistItems = await Wishlist.find({ user: userId })
            .populate({ path: 'product', select: 'name images price salePrice productOffer' })
            .sort({ createdAt: -1 })
            .lean();
        res.render('wishlist', { 
            wishlistItems: wishlistItems || [],
            user: req.session.user 
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).render('error', {
            message: 'Failed to load wishlist. Please try again later.',
            user: req.session.user
        });
    }
};

exports.toggleWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please log in to modify wishlist' });
        }
        const userId = req.session.user._id;
        const { productId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        const product = await Product.findById(productId).select('_id');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const existingItem = await Wishlist.findOne({ user: userId, product: productId });
        let wishlistCount;
        if (existingItem) {
            await Wishlist.deleteOne({ _id: existingItem._id });
            wishlistCount = await Wishlist.countDocuments({ user: userId });
            return res.json({ 
                success: true, 
                message: 'Product removed from wishlist successfully', 
                added: false,
                wishlistCount
            });
        } else {
            const wishlistItem = new Wishlist({ user: userId, product: productId });
            await wishlistItem.save();
            wishlistCount = await Wishlist.countDocuments({ user: userId });
            return res.json({ 
                success: true, 
                message: 'Product added to wishlist successfully', 
                added: true,
                wishlistItemId: wishlistItem._id,
                wishlistCount
            });
        }
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        res.status(500).json({ 
            success: false, 
            message: error.code === 11000 ? 'Item already in wishlist' : 'Internal server error' 
        });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please log in to modify wishlist' });
        }
        const { wishlistItemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(wishlistItemId)) {
            return res.status(400).json({ success: false, message: 'Invalid wishlist item ID' });
        }
        const deletedItem = await Wishlist.findOneAndDelete({ _id: wishlistItemId, user: req.session.user._id });
        if (!deletedItem) {
            return res.status(404).json({ success: false, message: 'Wishlist item not found or you don\'t have permission to remove it' });
        }
        return res.status(200).json({ success: true, message: 'Item removed from wishlist successfully', productId: deletedItem.product });
    } catch (error) {
        console.error('Error removing item from wishlist:', error);
        return res.status(500).json({ success: false, message: 'Server error while removing item from wishlist' });
    }
};

exports.getWishlistProductIds = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ wishlistItems: [] });
        }
        const wishlistItems = await Wishlist.find({ user: req.session.user._id }).select('product -_id').lean();
        const productIds = wishlistItems.map(item => item.product.toString());
        res.json({ success: true, wishlistItems: productIds });
    } catch (error) {
        console.error('Error fetching wishlist product IDs:', error);
        res.status(500).json({ success: false, wishlistItems: [] });
    }
};

exports.getWishlistCount = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: true, count: 0 });
        }
        const userId = req.session.user._id;
        const count = await Wishlist.countDocuments({ user: userId });
        res.json({ success: true, count });
    } catch (error) {
        console.error('Error in getWishlistCount:', error);
        res.status(500).json({ success: false, count: 0 });
    }
};