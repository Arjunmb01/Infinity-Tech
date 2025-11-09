const mongoose = require('mongoose');
const { Schema } = mongoose;

const laptopCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    thumbnail: {
        type: String,
        required: false
    },
    createdOn: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
});

const LaptopCategory = mongoose.model('LaptopCategory', laptopCategorySchema);

module.exports = LaptopCategory;
