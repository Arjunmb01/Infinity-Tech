const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const { default: mongoose } = require('mongoose');
const Product = require('../../models/productSchema');

// Utility function to get the best offer for a product
const getBestOfferForProduct = async (product) => {
    try {
        if (!product) {
            console.warn('Null or undefined product passed to getBestOfferForProduct');
            return { basePrice: 0, discountPercentage: 0, discountAmount: 0, finalPrice: 0 };
        }
        const basePrice = product.price;
        const discountPercentage = product.discountPercentage || 0;
        const discountAmount = (basePrice * discountPercentage) / 100;
        const finalPrice = basePrice - discountAmount;
        return { basePrice, discountPercentage, discountAmount, finalPrice };
    } catch (error) {
        console.error('Error in getBestOfferForProduct:', error);
        return { basePrice: product?.price || 0, discountPercentage: 0, discountAmount: 0, finalPrice: product?.price || 0 };
    }
};

// Clean up cart function
const cleanupCart = async (userId) => {
    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) return;
        const originalLength = cart.items.length;
        cart.items = cart.items.filter(item => item.product != null);
        if (originalLength !== cart.items.length) {
            await cart.save();
            console.log(`Cart cleanup complete - removed ${originalLength - cart.items.length} invalid items`);
        }
    } catch (error) {
        console.error('Error in cleanupCart:', error);
    }
};

const getCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        console.log('Fetching cart for user ID:', userId);
        await cleanupCart(userId);
        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            select: 'name images price discountPercentage stock'
        });
        if (!cart || cart.items.length === 0) {
            console.log('Cart is empty for this user.');
            return res.render('user/cart', {
                cartItems: [],
                cartSubtotal: 0,
                shippingCharge: 0,
                cartTotal: 0,
                message: {
                    type: req.flash('error').length ? 'error' : 'success',
                    content: req.flash('error')[0] || req.flash('success')[0]
                }
            });
        }
        const validCartItems = cart.items.filter(item => item.product !== null);
        if (validCartItems.length === 0) {
            console.log('No valid products in cart.');
            return res.render('user/cart', {
                cartItems: [],
                cartSubtotal: 0,
                shippingCharge: 0,
                cartTotal: 0,
                message: { type: 'error', content: 'Your cart contains invalid products. Please try adding items again.' }
            });
        }
        const cartItems = await Promise.all(validCartItems.map(async (item) => {
            const product = item.product;
            const offerDetails = await getBestOfferForProduct(product);
            return { ...item.toObject(), product, offerDetails, total: offerDetails.finalPrice * item.quantity };
        }));
        const cartSubtotal = cartItems.reduce((total, item) => total + item.total, 0);
        const shippingCharge = 50;
        const cartTotal = cartSubtotal + shippingCharge;
        res.render('user/cart', {
            cartItems,
            cartSubtotal,
            shippingCharge,
            cartTotal,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getCart:', error);
        req.flash('error', 'Error loading cart');
        res.redirect('/');
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1, buyNow = false } = req.body;
        const userId = req.session.user?._id;

        console.log(`addToCart called - Product ID: ${productId}, Quantity: ${quantity}, BuyNow: ${buyNow}`);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const product = await Product.findOne({ _id: productId, isListed: true, isDeleted: false });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ success: false, message: `Only ${product.stock} items available in stock` });
        }

        if (quantity > 10) {
            return res.status(400).json({ success: false, message: 'You cannot add more than 10 quantities of this product.' });
        }

        const offerDetails = await getBestOfferForProduct(product);
        const discountedPrice = offerDetails.finalPrice;

        if (buyNow) {
            req.session.buyNow = [{ product: productId, quantity: quantity, price: discountedPrice }];
            return res.json({ success: true, redirect: '/checkout?source=buy_now' });
        }

        let cart = await Cart.findOne({ user: new mongoose.Types.ObjectId(userId) });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
            console.log('Created new cart for user:', userId);
        }

        const existingItemIndex = cart.items.findIndex(item => item.product && item.product.toString() === productId.toString());

        if (existingItemIndex > -1) {
            // Product exists, increment quantity
            let newQuantity = cart.items[existingItemIndex].quantity + parseInt(quantity);
            console.log(`Product ${productId} found in cart. Current: ${cart.items[existingItemIndex].quantity}, Adding: ${quantity}, New: ${newQuantity}`);
            if (newQuantity > 10) {
                return res.status(400).json({ success: false, message: 'You cannot add more than 10 quantities of this product.' });
            }
            if (newQuantity > product.stock) {
                return res.status(400).json({ success: false, message: `Cannot add more items. Only ${product.stock} available in stock` });
            }
            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].price = discountedPrice; // Update price in case offer changes
        } else {
            // Product not in cart, add new item
            console.log(`Adding new product ${productId} to cart with quantity ${quantity}`);
            cart.items.push({ product: productId, quantity: parseInt(quantity), price: discountedPrice });
        }

        product.stock -= parseInt(quantity);
        await product.save();
        await cart.save();
        await cart.populate('items.product');

        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        console.log(`Cart updated - Total items: ${totalItems}, Cart items:`, cart.items.map(item => ({ product: item.product.toString(), quantity: item.quantity })));

        res.json({
            success: true,
            message: 'Product added to cart successfully',
            cart: cart,
            totalItems: totalItems,
            remainingStock: product.stock
        });
    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(500).json({ success: false, message: 'Error adding product to cart' });
    }
};

const removeFromCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
        }
        const { productId } = req.params;
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }
        const removedItem = cart.items.find(item => item.product && item.product.toString() === productId.toString());
        if (!removedItem) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
        const product = await Product.findById(productId);
        if (product) {
            product.stock += removedItem.quantity;
            await product.save();
        }
        cart.items = cart.items.filter(item => !item.product || item.product.toString() !== productId.toString());
        await cart.save();
        const cartSubtotal = cart.items.reduce((sum, item) => item.product && item.price && item.quantity ? sum + (item.price * item.quantity) : sum, 0);
        const shippingCharge = cart.items.length > 0 ? 50 : 0;
        res.json({
            success: true,
            message: 'Item removed from cart successfully',
            cartSubtotal: cartSubtotal.toFixed(2),
            shippingCharge: shippingCharge.toFixed(2),
            cartTotal: (cartSubtotal + shippingCharge).toFixed(2),
            isEmpty: cart.items.length === 0,
            remainingStock: product ? product.stock : null
        });
    } catch (error) {
        console.error('Error in removeFromCart:', error);
        res.status(500).json({ success: false, message: 'Error removing item from cart' });
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
        }
        const { productId } = req.params;
        const { quantity } = req.body;
        const userId = req.session.user._id;
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }
        const cartItemIndex = cart.items.findIndex(item => item.product && item.product.toString() === productId);
        if (cartItemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
        const currentQuantity = cart.items[cartItemIndex].quantity;
        const newQuantity = currentQuantity + parseInt(quantity);
        if (newQuantity > 10) {
            return res.status(400).json({ success: false, message: 'Maximum quantity limit (10) reached for this product', currentQuantity });
        }
        if (newQuantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity cannot be less than 1', currentQuantity });
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        if (newQuantity > product.stock + currentQuantity) {
            return res.status(400).json({ success: false, message: 'Requested quantity exceeds available stock', currentQuantity });
        }
        const offerDetails = await getBestOfferForProduct(product);
        const discountedPrice = offerDetails.finalPrice;
        cart.items[cartItemIndex].quantity = newQuantity;
        cart.items[cartItemIndex].price = discountedPrice;
        const quantityDifference = newQuantity - currentQuantity;
        product.stock -= quantityDifference;
        await product.save();
        await cart.save();
        const cartSubtotal = cart.items.reduce((sum, item) => item.product && item.price && item.quantity ? sum + (item.price * item.quantity) : sum, 0);
        const shippingCharge = cart.items.length > 0 ? 50 : 0;
        res.json({
            success: true,
            message: 'Cart quantity updated successfully',
            newQuantity,
            itemTotal: (discountedPrice * newQuantity).toFixed(2),
            cartSubtotal: cartSubtotal.toFixed(2),
            shippingCharge: shippingCharge.toFixed(2),
            cartTotal: (cartSubtotal + shippingCharge).toFixed(2),
            remainingStock: product.stock
        });
    } catch (error) {
        console.error('Error in updateCartQuantity:', error);
        res.status(500).json({ success: false, message: 'Error updating cart quantity' });
    }
};

const getCartCount = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: true, count: 0 });
        }
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ user: userId });
        if (!cart || !cart.items.length) {
            return res.json({ success: true, count: 0 });
        }
        const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ success: true, count });
    } catch (error) {
        console.error('Error in getCartCount:', error);
        res.status(500).json({ success: false, count: 0 });
    }
};

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    getBestOfferForProduct,
    getCartCount
};