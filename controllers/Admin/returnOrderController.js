const Return = require('../../models/returnSchema');
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const mongoose = require('mongoose');

// Helper function to calculate refund amount with shipping and coupon distribution
const calculateRefundAmount = (order, items) => {
    const totalItemsPrice = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
    const couponDiscount = order.couponDiscount || 0;
    const shippingCharge = order.shippingCharge || 0;
    const totalOrderValue = totalItemsPrice + shippingCharge - couponDiscount;
    
    let refundAmount = 0;
    const returningItemsCount = items.length;
    const totalItemsCount = order.products.length;

    items.forEach(item => {
        const product = order.products.find(p => p.productId.toString() === item.productId.toString());
        if (product) {
            const itemPrice = product.totalPrice;
            const proportionalShipping = (itemPrice / totalItemsPrice) * shippingCharge;
            const proportionalCoupon = (itemPrice / totalItemsPrice) * couponDiscount;
            const itemRefund = itemPrice + (proportionalShipping / totalItemsCount) - (proportionalCoupon / totalItemsCount);
            refundAmount += itemRefund;
        }
    });

    return Math.max(0, refundAmount); // Ensure refund is not negative
};

// Get all return requests
exports.getReturnRequests = async (req, res) => {
    try {
        const returnRequests = await Return.find()
            .populate({
                path: 'orderId',
                populate: { path: 'user', select: 'name email' }
            })
            .populate('items.productId');

        const formattedRequests = returnRequests.map(request => ({
            ...request._doc,
            orderId: request.orderId ? request.orderId._id : null,
            items: request.items.map(item => ({
                ...item._doc,
                productDetails: {
                    name: item.productId?.name || 'Unknown',
                    price: item.productId?.price || 0,
                    image: item.productId?.images[0] || '/default-image.jpg'
                },
                valid: !!item.productId
            })),
            returnStatus: request.status
        }));

        const formatPrice = price => `₹${price.toFixed(2)}`;

        res.render('admin/returnOrder', { 
            returnRequests: formattedRequests, 
            path: '/admin/return/requests',
            formatPrice
        });
    } catch (error) {
        console.error('Error fetching return requests:', error);
        res.status(500).render('admin/pageerror', { message: 'Failed to load return requests' });
    }
};

// Get specific return request details
exports.getReturnRequestDetails = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnRequest = await Return.findById(returnId)
            .populate({
                path: 'orderId',
                populate: [
                    { path: 'user', select: 'name email phone' },
                    { path: 'products.productId' }
                ]
            })
            .populate('items.productId');

        if (!returnRequest) throw new Error('Return request not found');

        const formattedRequest = {
            ...returnRequest._doc,
            orderId: returnRequest.orderId ? returnRequest.orderId : null,
            returnStatus: returnRequest.status || 'Pending', // Map status to returnStatus, fallback to 'Pending'
            items: returnRequest.items.map(item => ({
                ...item._doc,
                productDetails: {
                    name: item.productId?.name || 'Unknown',
                    price: item.productId?.price || 0,
                    image: item.productId?.images[0] || '/default-image.jpg'
                }
            }))
        };

        // Define helper functions
        const formatDate = date => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const formatPrice = price => `₹${price.toFixed(2)}`;
        const getStatusColor = status => {
            const safeStatus = (status || 'Pending').toLowerCase(); // Fallback to 'Pending' if status is undefined
            switch (safeStatus) {
                case 'pending': return 'status-pending';
                case 'approved': return 'status-approved';
                case 'rejected': return 'status-rejected';
                default: return 'bg-gray-600 text-gray-200'; // Fallback for unexpected values
            }
        };

        res.render('admin/returnDetails', {
            returnRequest: formattedRequest,
            formatDate,
            formatPrice,
            getStatusColor
        });
    } catch (error) {
        console.error('Error fetching return details:', error);
        res.status(404).render('admin/pageerror', { message: 'Return request not found' });
    }
};

// Approve return request
exports.approveReturnRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const returnId = req.params.id;
        const returnRequest = await Return.findById(returnId).populate('orderId');
        if (!returnRequest) {
            throw new Error('Return request not found');
        }
        if (returnRequest.status !== 'Pending') {
            throw new Error('Return request already processed');
        }

        if (!returnRequest.orderId) {
            throw new Error('Associated order not found in return request');
        }

        const order = await Order.findById(returnRequest.orderId);
        if (!order) {
            throw new Error('Order not found in database');
        }

        const refundAmount = calculateRefundAmount(order, returnRequest.items);
        if (isNaN(refundAmount)) {
            throw new Error('Invalid refund amount calculated');
        }

        returnRequest.status = 'Approved';
        returnRequest.refundedAmount = refundAmount;

        returnRequest.items.forEach(item => {
            const productIndex = order.products.findIndex(p => p.productId.toString() === item.productId.toString());
            if (productIndex === -1) {
                throw new Error(`Product ${item.productId} not found in order`);
            }
            order.products[productIndex].status = 'Returned';
        });

        order.orderAmount -= refundAmount;
        if (order.orderAmount < 0) {
            throw new Error('Order amount cannot be negative');
        }

        // Simplified status logic: Only set to 'Returned' if all products are returned
        if (order.products.every(p => p.status === 'Returned')) {
            order.status = 'Returned';
        } // Else, leave the order status unchanged (e.g., 'Delivered' or 'Shipped')

        const walletUpdate = await Wallet.findOneAndUpdate(
            { userId: returnRequest.user },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        amount: refundAmount,
                        type: 'credit',
                        description: `Refund for approved return #${returnId}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true, new: true, session }
        );
        if (!walletUpdate) {
            throw new Error('Failed to update wallet');
        }

        await Promise.all([returnRequest.save({ session }), order.save({ session })]);
        await session.commitTransaction();
        res.redirect('/admin/return/requests');
    } catch (error) {
        await session.abortTransaction();
        console.error('Error approving return:', error.stack);
        res.status(500).render('admin/pageerror', { message: `Failed to approve return: ${error.message}` });
    } finally {
        session.endSession();
    }
};

// Reject return request
exports.rejectReturnRequest = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnRequest = await Return.findById(returnId).populate('orderId');
        if (!returnRequest || returnRequest.status !== 'Pending') {
            throw new Error('Invalid return request or already processed');
        }

        const order = await Order.findById(returnRequest.orderId);
        returnRequest.status = 'Rejected';
        returnRequest.items.forEach(item => {
            const productIndex = order.products.findIndex(p => p.productId.toString() === item.productId.toString());
            if (productIndex !== -1) order.products[productIndex].status = 'Ordered';
        });

        await Promise.all([returnRequest.save(), order.save()]);
        res.redirect('/admin/return/requests');
    } catch (error) {
        console.error('Error rejecting return:', error);
        res.status(400).render('admin/pageerror', { message: error.message });
    }
};

module.exports = exports;