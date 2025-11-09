const Product = require('../../models/productSchema');
const LaptopCategory = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const { getBestOfferForProduct } = require('../../utils/offer');
const { default: mongoose } = require('mongoose');

// Get Home Page Products
const getHomePageProducts = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activeCategories = await LaptopCategory.find({ isActive: true }).select('_id');
        const activeCategoryIds = activeCategories.map(cat => cat._id);

        const newArrivals = await Product.find({
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds },
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ createdAt: -1 }).limit(8).lean();

        const featuredProducts = await Product.find({
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds }
        }).sort({ createdAt: -1 }).limit(8).lean();

        const topSellingProducts = await Product.find({
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds }
        }).sort({ salesCount: -1 }).limit(8).lean();

        const dealProducts = await Product.find({
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds }
        }).sort({ createdAt: -1 }).limit(8).lean();

        const enhanceProducts = async (products) => {
            return await Promise.all(products.map(async (product) => {
                try {
                    const offerDetails = await getBestOfferForProduct(product);
                    return { ...product, offerDetails };
                } catch (error) {
                    console.error(`Error calculating offer for product ${product._id}:`, error);
                    return {
                        ...product,
                        offerDetails: {
                            originalPrice: product.price,
                            finalPrice: product.price,
                            discountAmount: 0,
                            discountPercentage: 0,
                            appliedOfferType: null
                        }
                    };
                }
            }));
        };

        const enhancedNewArrivals = await enhanceProducts(newArrivals);
        const enhancedFeaturedProducts = await enhanceProducts(featuredProducts);
        const enhancedTopSellingProducts = await enhanceProducts(topSellingProducts);
        const enhancedDealProducts = await enhanceProducts(dealProducts);

        res.render('user/home', {
            newArrivals: enhancedNewArrivals,
            featuredProducts: enhancedFeaturedProducts,
            topSellingProducts: enhancedTopSellingProducts,
            dealProducts: enhancedDealProducts,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getHomePageProducts:', error);
        req.flash('error', 'Error loading home page');
        res.redirect('/');
    }
};

// Get Single Product Details
const getSingleProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findOne({
            _id: productId,
            isListed: true,
            isDeleted: false
        }).populate('category').lean();

        if (!product) {
            req.flash('error', 'Product not found or unavailable');
            return res.redirect('/shop');
        }

        const offerDetails = await getBestOfferForProduct(product);

        const recommendedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isListed: true,
            isDeleted: false
        }).populate('category').limit(4).sort('-createdAt').lean();

        const recommendedProductsWithOffers = await Promise.all(recommendedProducts.map(async (prod) => {
            const recOfferDetails = await getBestOfferForProduct(prod);
            return { ...prod, offerDetails: recOfferDetails };
        }));

        let cartItemsCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ user: req.user._id });
            if (cart) {
                cartItemsCount = cart.items.length;
            }
        }

        res.render('user/product', {
            product: { ...product, offerDetails },
            recommendedProducts: recommendedProductsWithOffers,
            cartItemsCount,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getSingleProduct:', error);
        req.flash('error', 'Error loading product details');
        res.redirect('/shop');
    }
};

// Get All Categories
const getAllCategories = async (req, res) => {
    try {
        const categories = await LaptopCategory.find({ isActive: true })
            .sort('name')
            .lean();

        const categoriesWithCount = await Promise.all(categories.map(async category => {
            const count = await Product.countDocuments({ category: category._id });
            return { ...category, productCount: count };
        }));

        res.render('user/categories', {
            categories: categoriesWithCount,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getAllCategories:', error);
        req.flash('error', 'Error loading categories');
        res.redirect('/');
    }
};

// Get Category Products
const getCategoryProducts = async (req, res) => {
    try {
        const categoryId = req.params.id;

        const category = await LaptopCategory.findOne({ _id: categoryId, isActive: true });
        if (!category) {
            req.flash('error', 'Category not found or inactive');
            return res.redirect('/categories');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const [products, totalProducts] = await Promise.all([
            Product.find({
                category: categoryId,
                isListed: true,
                isDeleted: false
            })
                .populate('category')
                .skip(skip)
                .limit(limit)
                .sort('-createdAt')
                .lean(),
            Product.countDocuments({
                category: categoryId,
                isListed: true,
                isDeleted: false
            })
        ]);

        const productsWithOffers = await Promise.all(products.map(async (product) => {
            const offerDetails = await getBestOfferForProduct(product);
            return { ...product, offerDetails };
        }));

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/categoryProducts', {
            category,
            products: productsWithOffers,
            currentPage: page,
            totalPages,
            totalProducts,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getCategoryProducts:', error);
        req.flash('error', 'Error loading category products');
        res.redirect('/categories');
    }
};

// Load Shop Page
const loadShop = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const selectedCategories = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
        const sortOption = req.query.sort || 'newest';
        const searchQuery = req.query.search || '';
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

        let activeCategories = [];
        try {
            activeCategories = await LaptopCategory.find({ isActive: true }).select('_id name').lean();
        } catch (err) {
            console.error('Error fetching categories:', err);
            activeCategories = [];
        }

        const filter = {
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategories.length > 0 ? activeCategories.map(cat => cat._id) : [] }
        };

        if (searchQuery) {
            filter.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        if (selectedCategories.length > 0) {
            filter.category = { $in: selectedCategories };
        }

        let allProducts = [];
        try {
            allProducts = await Product.find(filter).populate('category').lean();
        } catch (err) {
            console.error('Error fetching products:', err);
            allProducts = [];
        }

        const productsWithOffers = await Promise.all(allProducts.map(async (product) => {
            try {
                const offerDetails = await getBestOfferForProduct(product);
                return { ...product, offerDetails };
            } catch (err) {
                console.error(`Error calculating offer for product ${product._id}:`, err);
                return {
                    ...product,
                    offerDetails: {
                        originalPrice: product.price,
                        finalPrice: product.price,
                        discountAmount: 0,
                        discountPercentage: 0,
                        appliedOfferType: null
                    }
                };
            }
        }));

        let filteredProducts = productsWithOffers;
        if (minPrice !== null) {
            filteredProducts = filteredProducts.filter(p => p.offerDetails.finalPrice >= minPrice);
        }
        if (maxPrice !== null) {
            filteredProducts = filteredProducts.filter(p => p.offerDetails.finalPrice <= maxPrice);
        }

        const sortQuery = {
            'price_low_to_high': (a, b) => a.offerDetails.finalPrice - b.offerDetails.finalPrice,
            'price_high_to_low': (a, b) => b.offerDetails.finalPrice - a.offerDetails.finalPrice,
            'newest': (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        }[sortOption] || ((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        filteredProducts.sort(sortQuery);

        const paginatedProducts = filteredProducts.slice(skip, skip + limit);

        const finalPrices = productsWithOffers.map(p => p.offerDetails.finalPrice);
        const minPriceInDb = finalPrices.length > 0 ? Math.min(...finalPrices) : 0;
        const maxPriceInDb = finalPrices.length > 0 ? Math.max(...finalPrices) : 0;

        const totalProducts = filteredProducts.length;
        const totalPages = Math.ceil(totalProducts / limit);

        let wishlist = [];
        if (req.user && req.user._id) {
            try {
                const user = await User.findById(req.user._id).select('wishlist').lean();
                wishlist = user ? user.wishlist.map(id => id.toString()) : [];
            } catch (err) {
                console.error('Error fetching wishlist:', err);
                wishlist = [];
            }
        }

        res.render('user/shop', {
            products: paginatedProducts,
            categories: activeCategories,
            currentPage: page,
            totalPages,
            totalProducts,
            selectedCategory: selectedCategories.length > 0 ? selectedCategories[0] : '',
            sortOption,
            searchQuery,
            minPrice: minPriceInDb,
            maxPrice: maxPriceInDb,
            selectedMinPrice: minPrice || minPriceInDb,
            selectedMaxPrice: maxPrice || maxPriceInDb,
            wishlist,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Unexpected error in loadShop:', error);
        req.flash('error', 'Something went wrong while loading the shop page.');
        res.render('user/shop', {
            products: [],
            categories: [],
            currentPage: 1,
            totalPages: 1,
            totalProducts: 0,
            selectedCategory: '',
            sortOption: 'newest',
            searchQuery: '',
            minPrice: 0,
            maxPrice: 0,
            selectedMinPrice: 0,
            selectedMaxPrice: 0,
            wishlist: [],
            message: {
                type: 'error',
                content: 'Failed to load shop data. Please try again later.'
            }
        });
    }
};

// Search Products
const searchProducts = async (req, res) => {
    try {
        const searchQuery = req.query.q;
        const products = await Product.find({
            isListed: true,
            isDeleted: false,
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        })
        .populate('category')
        .lean();

        products.forEach(product => {
            product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));
        });

        if (req.accepts('json')) {
            return res.json({
                html: `
                    <div class="container mx-auto px-4 py-8">
                        <h1 class="text-2xl font-bold mb-4">Search Results for "${searchQuery}"</h1>
                        ${products.length > 0 ? `
                            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                ${products.map(product => `
                                    <div class="bg-white rounded-lg shadow-md overflow-hidden">
                                        <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover">
                                        <div class="p-4">
                                            <h2 class="text-lg font-semibold">${product.name}</h2>
                                            <p class="text-gray-600">${product.description}</p>
                                            <div class="mt-4">
                                                <span class="text-lg font-bold">$${product.discountedPrice.toFixed(2)}</span>
                                                ${product.discountPercentage > 0 ? `
                                                    <span class="text-sm text-gray-500 line-through">$${product.price.toFixed(2)}</span>
                                                    <span class="text-sm text-green-600 ml-2">${product.discountPercentage}% off</span>
                                                ` : ''}
                                            </div>
                                            <div class="mt-4">
                                                <a href="/product/${product._id}" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">View Product</a>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <p class="text-gray-600">No products found.</p>
                        `}
                    </div>
                `
            });
        }

        res.render('user/search', {
            products,
            searchQuery,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in searchProducts:', error);
        req.flash('error', 'Error searching products');
        res.redirect('/shop');
    }
};

// Add to Wishlist
const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user._id;

        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const user = await User.findById(userId);
        if (user.wishlist.includes(productId)) {
            return res.json({
                success: false,
                message: 'Product already in wishlist'
            });
        }

        user.wishlist.push(productId);
        await user.save();

        res.json({
            success: true,
            message: 'Product added to wishlist successfully'
        });
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding product to wishlist'
        });
    }
};

// Get Product Stock
const getProductStock = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        const product = await Product.findById(productId).select('stock');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, stock: product.stock });
    } catch (error) {
        console.error('Error fetching product stock:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getHomePageProducts,
    getSingleProduct,
    getAllCategories,
    getCategoryProducts,
    loadShop,
    searchProducts,
    addToWishlist,
    getProductStock
};