const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    products: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        finalPrice: { 
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {  
            type: String,
            enum: ["Ordered", "Cancelled", "Return Requested", "Return Approved", "Return Rejected", "Returned"],
            default: "Ordered"
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"],
        default: "Pending",
    },
    deliveryAddress: {
        type: Object,
        required: true
    },
    orderAmount: {
        type: Number,
        required: true
    },
    shippingCharge: {
        type: Number,
        required: true,
        default: 50 
    },
    paymentMethod: {
        type: String,
        enum: ['Credit Card', 'Debit Card', 'cod', 'razorpay', 'wallet'], 
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    couponCode: { 
        type: String,
        default: null
    },
    couponDiscount: { 
        type: Number,
        default: 0
    },
    cancellationReason: {
        type: String,
        default: null
    },
    returnReason: {
        type: String,
        default: null
    },
    returnRequestedAt: {
        type: Date,
        default: null
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    couponApplied: {
        type: Boolean, 
        default: false 
    },
    offerApplied: {
        type: Number,
        default: 0
    },
    cancelDate: {
        type: String,
        default: null
    },
    razorpayDetails: { 
        orderId: String,
        paymentId: String,
        signature: String
    }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;