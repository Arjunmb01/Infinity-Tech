const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const Return = require('../../models/returnSchema');
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

// Get all orders with filters and pagination
exports.getOrders = async (req, res) => {
    try {
        // Extract filter and pagination parameters from query
        const { search, status, startDate, endDate, page } = req.query;
        const currentPage = parseInt(page) || 1; // Default to page 1
        const limit = 10; 

        // Build the query object
        const query = {};

        if (search) {
            query.$or = [
                { _id: { $regex: search, $options: 'i' } }, 
                { 'user.name': { $regex: search, $options: 'i' } }, 
                { 'user.email': { $regex: search, $options: 'i' } } 
            ];
        }

        if (status && status !== 'All') {
            query.status = status;
        }

        if (startDate || endDate) {
            query.orderDate = {};
            if (startDate) query.orderDate.$gte = new Date(startDate);
            if (endDate) query.orderDate.$lte = new Date(endDate);
        }

        // Calculate total orders for pagination
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);
        const skip = (currentPage - 1) * limit;

        const orders = await Order.find(query)
            .populate('user', 'name email')
            .populate('products.productId')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        // Pass filters and pagination to the template
        const filters = {
            search: search || '',
            status: status || 'All',
            startDate: startDate || '',
            endDate: endDate || ''
        };

        const pagination = {
            currentPage,
            totalPages,
            totalOrders
        };

        res.render('admin/orders', { orders, filters, pagination });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('admin/pageerror', { message: 'Failed to load orders' });
    }
};


// View specific order details
exports.viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .populate('products.productId');

        if (!order) throw new Error('Order not found');

        order.formattedDate = new Date(order.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        res.render('admin/viewDetails', { order, path: '/admin/orders' });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(404).render('admin/pageerror', { message: 'Order not found' });
    }
};

// Toggle order status
exports.toggleOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) throw new Error('Invalid status');

        const order = await Order.findById(orderId);
        if (!order) throw new Error('Order not found');

        order.status = status;
        if (status === 'Cancelled') {
            order.cancelDate = new Date();
            order.products.forEach(p => {
                if (p.status === 'Ordered') p.status = 'Cancelled';
            });

            await Wallet.findOneAndUpdate(
                { userId: order.user },
                {
                    $inc: { balance: order.orderAmount },
                    $push: {
                        transactions: {
                            amount: order.orderAmount,
                            type: 'credit',
                            description: `Refund for cancelled order #${orderId}`,
                            date: new Date()
                        }
                    }
                },
                { upsert: true, new: true }
            );
        }

        await order.save();
        res.json({ success: true, message: `Order status updated to ${status}` });
    } catch (error) {
        console.error('Error toggling order status:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// Cancel individual product
exports.cancelProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { orderId } = req.params;
        const { productIndex, reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order || !['Pending', 'Processing'].includes(order.status)) {
            throw new Error('Product cannot be cancelled at this stage');
        }

        if (productIndex < 0 || productIndex >= order.products.length || order.products[productIndex].status !== 'Ordered') {
            throw new Error('Invalid product index or product not eligible');
        }

        order.products[productIndex].status = 'Cancelled';
        const refundAmount = calculateRefundAmount(order, productIndex);
        order.orderAmount -= refundAmount;

        await Wallet.findOneAndUpdate(
            { userId: order.user },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        amount: refundAmount,
                        type: 'credit',
                        description: `Refund for cancelled product in order #${orderId} - ${reason}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true, new: true, session }
        );

        await order.save({ session });
        await session.commitTransaction();
        res.json({ success: true, message: 'Product cancelled and refunded' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error cancelling product:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

// Request return for individual product
exports.returnProduct = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productIndex, reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order || order.status !== 'Delivered') {
            throw new Error('Product not eligible for return');
        }

        if (productIndex < 0 || productIndex >= order.products.length || order.products[productIndex].status !== 'Ordered') {
            throw new Error('Invalid product index or product not eligible');
        }

        const returnRequest = new Return({
            orderId,
            user: order.user,
            reason,
            items: [{
                productId: order.products[productIndex].productId,
                quantity: order.products[productIndex].quantity
            }],
            status: 'Pending'
        });

        order.products[productIndex].status = 'Return Requested';
        await Promise.all([returnRequest.save(), order.save()]);
        res.json({ success: true, message: 'Return request submitted' });
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// Approve return for individual product
exports.approveReturn = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { orderId } = req.params;
        const { productIndex } = req.body;

        const order = await Order.findById(orderId);
        if (!order || order.products[productIndex].status !== 'Return Requested') {
            throw new Error('Return not requested or invalid product');
        }

        const refundAmount = calculateRefundAmount(order, productIndex);
        order.products[productIndex].status = 'Returned';
        order.orderAmount -= refundAmount;

        await Wallet.findOneAndUpdate(
            { userId: order.user },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        amount: refundAmount,
                        type: 'credit',
                        description: `Refund for returned product in order #${orderId}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true, new: true, session }
        );

        const returnRequest = await Return.findOne({ orderId, 'items.productId': order.products[productIndex].productId });
        if (returnRequest) {
            returnRequest.status = 'Approved';
            await returnRequest.save({ session });
        }

        await order.save({ session });
        await session.commitTransaction();
        res.json({ success: true, message: 'Return approved and refunded' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error approving return:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = exports;