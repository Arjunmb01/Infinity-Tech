const Offer = require('../../models/offerSchema');
const Categories = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

// Get all offers (for /admin/offers route)
exports.getAllOffers = async (req, res) => {
    try {
        const offers = await Offer.find()
            .populate('Categories', 'name')
            .populate('Product', 'name');

        res.render('offer', {
            path: '/admin/offers',
            offers,
            success: req.flash('success')[0] || '',
            error: req.flash('error')[0] || '',
            oldInput: {}
        });
    } catch (error) {
        console.error('Error fetching offers:', error);
        req.flash('error', 'Failed to load offers');
        res.redirect('/admin/dashboard');
    }
};

// Load add offer form
exports.getAddOffer = async (req, res) => {
    try {
        const categories = await Categories.find();
        const products = await Product.find();

        res.render('addOffer', {
            editing: false,
            categories,
            products,
            offer: {},
            errorMessage: req.flash('error')[0],
            validationErrors: [],
            oldInput: req.flash('oldInput')[0] || {}
        });
    } catch (error) {
        console.error('Error loading form:', error);
        req.flash('error', 'Failed to load form data');
        res.redirect('/admin/offers');
    }
};

// Create a new offer
exports.postAddOffer = async (req, res) => {
    try {
        console.log('Request Body:', req.body); // Debug log
        const { name, description, discountType, discountValue, maxDiscount, minimumAmount, startDate, endDate, product, category, offerType } = req.body;

        // Check required fields and collect missing ones
        const missingFields = [];
        if (!name) missingFields.push('Offer Name');
        if (!discountType) missingFields.push('Discount Type');
        if (!discountValue) missingFields.push('Discount Value');
        if (!startDate) missingFields.push('Start Date');
        if (!endDate) missingFields.push('End Date');
        if (!offerType) missingFields.push('Offer Type');

        if (missingFields.length > 0) {
            throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
        }

        // Validate offer name length
        if (name.length < 3 || name.length > 30) {
            throw new Error('Offer name must be between 3 and 30 characters');
        }

        // Validate discount type
        if (!['percentage', 'fixed'].includes(discountType)) {
            throw new Error('Invalid discount type');
        }

        // Validate discount value
        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (discountType === 'percentage' && discountValueNum > 100) {
            throw new Error('Percentage discount cannot exceed 100');
        }

        // Validate minimum amount (optional field)
        const minimumAmountNum = parseFloat(minimumAmount || 0);
        if (isNaN(minimumAmountNum) || minimumAmountNum < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new Error('Invalid date format');
        }
        if (startDateObj < currentDate) {
            throw new Error('Start date cannot be in the past');
        }
        if (endDateObj <= startDateObj) {
            throw new Error('End date must be after start date');
        }

        // Handle product or category based on offerType
        let productArray = [];
        let categoryArray = [];

        if (offerType === 'product') {
            if (!product) throw new Error('Please select at least one product');
            const productIdArray = Array.isArray(product) ? product : [product];
            for (const prodId of productIdArray) {
                if (!mongoose.Types.ObjectId.isValid(prodId)) throw new Error(`Invalid product ID: ${prodId}`);
                const existingProduct = await Product.findById(prodId);
                if (!existingProduct) throw new Error(`Product not found: ${prodId}`);
                productArray.push(prodId);
            }
        } else if (offerType === 'category') {
            if (!category) throw new Error('Please select a category');
            const categoryIdArray = Array.isArray(category) ? category : [category];
            for (const catId of categoryIdArray) {
                if (!mongoose.Types.ObjectId.isValid(catId)) throw new Error(`Invalid category ID: ${catId}`);
                const existingCategory = await Categories.findById(catId);
                if (!existingCategory) throw new Error(`Category not found: ${catId}`);
                categoryArray.push(catId);
            }
        } else {
            throw new Error('Invalid offer type');
        }

        // Prepare offer data
        const offerData = {
            name,
            description: description || '',
            discountType,
            discountValue: discountValueNum,
            minimumAmount: minimumAmountNum,
            maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
            startDate: startDateObj,
            endDate: endDateObj,
            isActive: true,
            Categories: categoryArray,
            Product: productArray
        };

        const newOffer = new Offer(offerData);
        await newOffer.save();

        res.json({
            success: true,
            message: 'Offer created successfully',
            redirect: '/admin/offers'
        });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Load edit offer form
exports.getEditOffer = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id)
            .populate('Categories', 'name')
            .populate('Product', 'name');
        if (!offer) {
            throw new Error('Offer not found');
        }

        const categories = await Categories.find();
        const products = await Product.find();

        res.render('addOffer', {
            editing: true,
            offer,
            categories,
            products,
            errorMessage: req.flash('error')[0],
            validationErrors: [],
            oldInput: req.flash('oldInput')[0] || offer
        });
    } catch (error) {
        console.error('Error loading offer:', error);
        req.flash('error', error.message);
        res.redirect('/admin/offers');
    }
};

// Update an existing offer
exports.postEditOffer = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            throw new Error('Offer not found');
        }

        const { name, description, discountType, discountValue, maxDiscount, minimumAmount, startDate, endDate, product, category, isActive } = req.body;

        if (!name || !discountType || !discountValue || !startDate || !endDate) {
            throw new Error('Please fill in all required fields');
        }

        if (name.length < 3 || name.length > 30) {
            throw new Error('Offer name must be between 3 and 30 characters');
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            throw new Error('Invalid discount type');
        }

        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (discountType === 'percentage' && discountValueNum > 100) {
            throw new Error('Percentage discount cannot exceed 100');
        }

        const minimumAmountNum = parseFloat(minimumAmount || 0);
        if (isNaN(minimumAmountNum) || minimumAmountNum < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new Error('Invalid date format');
        }
        if (endDateObj <= startDateObj) {
            throw new Error('End date must be after start date');
        }

        let productArray = [];
        let categoryArray = [];
        const offerType = offer.Product.length > 0 ? 'product' : 'category';

        if (offerType === 'product' && product) {
            const productIdArray = Array.isArray(product) ? product : [product];
            for (const prodId of productIdArray) {
                if (!mongoose.Types.ObjectId.isValid(prodId)) throw new Error('Invalid product ID');
                const existingProduct = await Product.findById(prodId);
                if (!existingProduct) throw new Error('Selected product does not exist');
                productArray.push(prodId);
            }
        } else if (offerType === 'category' && category) {
            const categoryIdArray = Array.isArray(category) ? category : [category];
            for (const catId of categoryIdArray) {
                if (!mongoose.Types.ObjectId.isValid(catId)) throw new Error('Invalid category ID');
                const existingCategory = await Categories.findById(catId);
                if (!existingCategory) throw new Error('Selected category does not exist');
                categoryArray.push(catId);
            }
        }

        offer.name = name;
        offer.description = description || '';
        offer.discountType = discountType;
        offer.discountValue = discountValueNum;
        offer.minimumAmount = minimumAmountNum;
        offer.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        offer.startDate = startDateObj;
        offer.endDate = endDateObj;
        offer.isActive = isActive === 'on';
        offer.Categories = categoryArray.length ? categoryArray : offer.Categories;
        offer.Product = productArray.length ? productArray : offer.Product;

        await offer.save();

        res.json({
            success: true,
            message: 'Offer updated successfully',
            redirect: '/admin/offers'
        });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Toggle offer status (for /admin/offers/toggle/:id route)
exports.toggleOfferStatus = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            throw new Error('Offer not found');
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        res.status(200).json({
            success: true,
            message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Error toggling offer status:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};