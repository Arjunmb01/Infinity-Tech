const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const Return = require('../../models/returnSchema');
const User = require('../../models/userSchema'); // Assuming a User model exists
const mongoose = require('mongoose');

// Helper function to calculate proportional refund with coupon discount
const calculateRefundAmount = (order, productIndex) => {
    const product = order.products[productIndex];
    const totalItemsPrice = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
    const itemPrice = product.totalPrice;
    const couponDiscount = order.couponDiscount || 0;
    const proportionalDiscount = (itemPrice / totalItemsPrice) * couponDiscount;
    return itemPrice - proportionalDiscount;
};

// Get user's order list
exports.getOrdersList = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) throw new Error('User not authenticated');

        const orders = await Order.find({ user: userId })
            .populate('products.productId')
            .sort({ orderDate: -1 });

        // Use session user data or fetch from DB if necessary
        const userProfile = req.session.user || await User.findById(userId).select('name email');
        if (!userProfile) throw new Error('User profile not found');

        res.render('user/orders', { orders, userProfile });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('user/error', { error: { message: 'Failed to load orders' } });
    }
};

// Get specific order details
exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user?._id;

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('products.productId')
            .populate('user');

        if (!order) throw new Error('Order not found');

        const userProfile = req.session.user || await User.findById(userId).select('name email');
        res.render('user/orderDetails', { order, userProfile });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(404).render('user/error', { error: { message: 'Order not found' } });
    }
};

// Cancel entire order
exports.cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const orderId = req.params.id;
        const userId = req.session.user?._id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order || !['Pending', 'Processing', 'Shipped', 'Out for Delivery'].includes(order.status)) {
            throw new Error('Order cannot be cancelled');
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelDate = new Date();
        order.products.forEach(product => {
            if (product.status === 'Ordered') product.status = 'Cancelled';
        });

        const refundAmount = order.orderAmount;
        await Wallet.findOneAndUpdate(
            { userId },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        amount: refundAmount,
                        type: 'credit',
                        description: `Refund for cancelled order #${orderId}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true, new: true, session }
        );

        await order.save({ session });
        await session.commitTransaction();
        res.json({ success: true, message: 'Order cancelled and refunded' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error cancelling order:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

// Cancel individual product
exports.cancelProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id: orderId, productId } = req.params;
        const userId = req.session.user?._id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order || !['Pending', 'Processing'].includes(order.status)) {
            throw new Error('Product cannot be cancelled at this stage');
        }

        const productIndex = order.products.findIndex(p => p.productId.toString() === productId && p.status === 'Ordered');
        if (productIndex === -1) throw new Error('Product not eligible for cancellation');

        order.products[productIndex].status = 'Cancelled';
        const refundAmount = calculateRefundAmount(order, productIndex);
        order.orderAmount -= refundAmount;

        await Wallet.findOneAndUpdate(
            { userId },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        amount: refundAmount,
                        type: 'credit',
                        description: `Refund for cancelled product in order #${orderId}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true, new: true, session }
        );

        await order.save({ session });
        await session.commitTransaction();
        res.json({ success: true, message: 'Product cancelled and refunded', refundAmount });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error cancelling product:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

// Request return for entire order
exports.returnOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const orderId = req.params.id;
        const userId = req.session.user?._id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order || order.status !== 'Delivered') {
            throw new Error('Order not eligible for return');
        }

        const returnRequest = new Return({
            orderId,
            user: userId,
            reason,
            items: order.products.map(p => ({
                productId: p.productId,
                quantity: p.quantity
            })),
            status: 'Pending',
            createdAt: new Date()
        });

        order.status = 'Return Requested';
        order.returnReason = reason;
        order.returnRequestedAt = new Date();

        await returnRequest.save({ session });
        await order.save({ session });
        await session.commitTransaction();
        res.json({ success: true, message: 'Return request submitted' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error requesting return:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

// Request return for individual product
exports.requestReturn = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id: orderId, productId } = req.params;
        const userId = req.session.user?._id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order || order.status !== 'Delivered') {
            throw new Error('Product not eligible for return');
        }

        const productIndex = order.products.findIndex(p => p.productId.toString() === productId && p.status === 'Ordered');
        if (productIndex === -1) throw new Error('Product not eligible for return');

        const returnRequest = new Return({
            orderId,
            user: userId,
            reason,
            items: [{
                productId,
                quantity: order.products[productIndex].quantity
            }],
            status: 'Pending',
            createdAt: new Date()
        });

        order.products[productIndex].status = 'Return Requested';
        await returnRequest.save({ session });
        await order.save({ session });
        await session.commitTransaction();
        res.json({ success: true, message: 'Return request submitted for product' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error requesting product return:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = exports;