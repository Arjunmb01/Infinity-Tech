const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    time: {
        type: Date,
    },
    description: {
        type: String,
        default: ''
    }
});

const walletSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [transactionSchema],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

walletSchema.pre('save', function (next) {
    this.lastUpdated = Date.now();
    next();
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;