const mongoose = require('mongoose');
const { Schema } = mongoose;

const wishlistSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Adding index for better query performance
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true // Adding index for better query performance
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    // Adding unique constraint to prevent duplicate entries
    unique: true,
    indexes: [{ key: { user: 1, product: 1 }, unique: true }]
});

module.exports = mongoose.model('Wishlist', wishlistSchema);