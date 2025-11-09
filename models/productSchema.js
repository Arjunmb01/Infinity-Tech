const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        unique: true
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'LaptopCategory',
        required: [true, 'Category is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    salePrice: {
        type: Number,
        required: false
    },
    productOffer: {
        type: Number,
        default: 0
    },
    stock: {
        type: Number,
        required: [true, 'Stock is required'],
        min: [0, 'Stock cannot be negative'],
        default: 0
    },
    specifications: {
        processor: {
            type: String,
            required: [true, 'Processor specification is required'],
            trim: true
        },
        ram: {
            type: String,
            required: [true, 'RAM specification is required'],
            trim: true
        },
        storage: {
            type: String,
            required: [true, 'Storage specification is required'],
            trim: true
        },
        graphics: {
            type: String,
            required: [true, 'Graphics specification is required'],
            trim: true
        }
    },
    images: [{
        type: String,
        required: [true, 'At least one product image is required']
    }],
    isListed: {
        type: Boolean,
        default: true // Indicates if product is available/listed for sale
    },
    isFeatured: {
        type: Boolean,
        default: false // Indicates if product should be featured on homepage
    },
    isDeleted: {
        type: Boolean,
        default: false // Soft delete flag
    }
}, {
    timestamps: true
});

// Ensure virtuals are included in JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);