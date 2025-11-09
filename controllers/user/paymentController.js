const { createRazorpayInstance } = require('../../config/razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');

const razorpayInstance = createRazorpayInstance();

exports.createRazorpayOrder = async (req, res) => {
    try {
        console.log('Creating Razorpay order with body:', JSON.stringify(req.body, null, 2));
        const { addressId, couponCode, couponDiscount } = req.body;

        if (!addressId) {
            return res.status(400).json({ success: false, message: 'Address ID is required' });
        }

        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        if (!cart || !cart.items.length) {
            return res.status(400).json({ success: false, message: 'Cart is empty or not found' });
        }

        const cartTotal = cart.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
        const shippingCharge = cartTotal < 500 ? 30 : 0;
        const finalAmount = cartTotal + shippingCharge - (couponDiscount || 0);

        console.log('Server-side calculation:', { cartTotal, shippingCharge, couponDiscount, finalAmount });

        if (finalAmount < 0) {
            return res.status(400).json({ success: false, message: 'Total amount cannot be negative' });
        }

        const options = {
            amount: Math.round(finalAmount * 100), // Convert to paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpayInstance.orders.create(options);
        console.log('Razorpay order created successfully:', JSON.stringify(order, null, 2));

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            key: process.env.Test_Key_ID,
            addressId,
            couponCode,
            couponDiscount,
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error.message, error.stack);
        res.status(500).json({ success: false, message: `Error creating order: ${error.message}` });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        console.log('Verifying Razorpay payment with body:', JSON.stringify(req.body, null, 2));
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId, totalAmount } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        const generatedSignature = crypto
            .createHmac('sha256', process.env.Test_Key_Secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        console.log('Generated signature:', generatedSignature);
        console.log('Received signature:', razorpay_signature);

        if (generatedSignature !== razorpay_signature) {
            console.log('Signature mismatch detected');
            return res.status(400).json({ success: false, message: 'Payment verification failed - Invalid signature' });
        }

        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        if (!cart || !cart.items.length) {
            return res.status(400).json({ success: false, message: 'Cart is empty or not found' });
        }

        const addressDoc = await Address.findOne({ userID: req.user._id });
        const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(400).json({ success: false, message: 'Invalid delivery address' });
        }

        const validCartItems = cart.items.filter(item => item.product);
        if (validCartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid products in cart' });
        }

        const orderProducts = validCartItems.map(item => ({
            productId: item.product._id,
            quantity: item.quantity,
            price: item.product.price,
            finalPrice: item.product.price,
            totalPrice: item.product.price * item.quantity,
            status: 'Ordered',
        }));

        const cartTotal = validCartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
        const shippingCharge = cartTotal < 500 ? 30 : 0;

        const order = new Order({
            user: req.user._id,
            products: orderProducts,
            deliveryAddress: selectedAddress,
            orderAmount: totalAmount,
            shippingCharge,
            paymentMethod: 'razorpay',
            paymentStatus: 'paid',
            status: 'Processing',
            razorpayDetails: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
            },
        });

        await order.save();
        await Cart.findByIdAndDelete(cart._id);
        console.log('Order saved and cart deleted:', order._id);

        res.json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Payment verification error:', error.message, error.stack);
        res.status(500).json({ success: false, message: `Error verifying payment: ${error.message}` });
    }
};