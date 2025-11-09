const { body, validationResult } = require('express-validator');

// Validation rules for product
const productValidationRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Product name is required')
        .matches(/^[a-zA-Z]/).withMessage('Product name must start with an alphabet')
        .custom(async (value, { req }) => {
            const Product = require('../models/productSchema');
            const productId = req.params.id;
            const query = { name: value, isDeleted: false };
            
            // If updating, exclude current product from duplicate check
            if (productId) {
                query._id = { $ne: productId };
            }
            
            const existingProduct = await Product.findOne(query);
            if (existingProduct) {
                throw new Error('A product with this name already exists');
            }
            return true;
        }),

    body('brand')
        .trim()
        .notEmpty().withMessage('Brand is required')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Brand must contain only alphabetic characters'),

    body('description')
        .trim()
        .notEmpty().withMessage('Description is required')
        .isLength({ min: 10 }).withMessage('Description must be at least 10 characters long'),

    body('price')
        .notEmpty().withMessage('Price is required')
        .isFloat({ min: 0 }).withMessage('Price must be a positive number in INR'),

    body('stock')
        .notEmpty().withMessage('Stock is required')
        .isInt({ min: 0 }).withMessage('Stock must be a non-negative number'),

    body('discountPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Discount percentage must be between 0 and 100'),

    body('category')
        .notEmpty().withMessage('Category is required'),

    body('specifications')
        .custom((value, { req }) => {
            let specs;
            
            // Handle specifications as string (from form) or object (from JSON)
            if (typeof value === 'string') {
                try {
                    specs = JSON.parse(value);
                } catch (e) {
                    throw new Error('Invalid specifications format');
                }
            } else {
                specs = value;
            }

            // Validate required fields
            const requiredFields = ['processor', 'ram', 'storage', 'graphics'];
            for (const field of requiredFields) {
                if (!specs[field] || !specs[field].trim()) {
                    throw new Error(`${field.charAt(0).toUpperCase() + field.slice(1)} specification is required`);
                }
            }

            // Store parsed specifications for later use
            req.body.specifications = specs;
            return true;
        })
];

// Middleware to validate product
const validateProduct = async (req, res, next) => {
    try {
        // Run validation rules
        await Promise.all(productValidationRules.map(validation => validation.run(req)));

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg
            });
        }

        next();
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during validation'
        });
    }
};

module.exports = {
    validateProduct
};
