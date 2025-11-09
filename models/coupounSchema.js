const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        minlength: 6,
        maxlength: 12
    },
    offerType: {
        type: String,
        enum: ['percentage', 'flat'],
        required: true
    },
    offerValue: {
        type: Number,
        required: true,
        min: 0.01
    },
    minimumPrice: {
        type: Number,
        required: true,
        min: 0
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiredOn: {
        type: Date,
        required: true,
        validate: {
            validator: function(value) {
                return value >= new Date().setHours(0, 0, 0, 0);
            },
            message: 'Expiration date must be today or in the future'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        min: 1,
        default: null
    },
    usagePerUserLimit: {
        type: Number,
        min: 1,
        default: 1
    },
    users: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        usageCount: {
            type: Number,
            default: 0,
            min: 0
        }
    }],
    couponUsed: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Coupon', couponSchema);