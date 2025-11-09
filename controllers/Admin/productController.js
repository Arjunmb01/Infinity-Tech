const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs').promises;
const path = require('path');

// Load Products Page with pagination
const loadProduct = async (req, res) => {
    try {
        let page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 7;
        const { search, category, priceRange, stock, sortBy = '-createdAt', status } = req.query;

        let filterQuery = {};
        if (search) {
            filterQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) filterQuery.category = category;
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            filterQuery.price = {};
            if (min) filterQuery.price.$gte = min;
            if (max) filterQuery.price.$lte = max;
        }
        if (stock) {
            switch (stock) {
                case 'out': filterQuery.stock = 0; break;
                case 'low': filterQuery.stock = { $gt: 0, $lte: 10 }; break;
                case 'available': filterQuery.stock = { $gt: 10 }; break;
            }
        }
        if (status) {
            if (status === 'active') filterQuery.isDeleted = false;
            if (status === 'inactive') filterQuery.isDeleted = true;
            if (status === 'listed') filterQuery.isListed = true;
            if (status === 'unlisted') filterQuery.isListed = false;
            if (status === 'featured') filterQuery.isFeatured = true;
            if (status === 'notfeatured') filterQuery.isFeatured = false;
        }

        const skip = (page - 1) * limit;
        const [products, totalProducts, categories] = await Promise.all([
            Product.find(filterQuery).populate('category', 'name').sort(sortBy).skip(skip).limit(limit).lean(),
            Product.countDocuments(filterQuery),
            Category.find().lean()
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('admin/products', {
            path: req.path,
            products,
            categories,
            filters: { search, category, priceRange, stock, sortBy, status },
            pagination: {
                currentPage: page,
                totalPages,
                limit,
                totalProducts,
                startIndex: skip + 1,
                endIndex: Math.min(skip + limit, totalProducts),
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages
            },
            success_msg: req.flash('success')[0],
            error_msg: req.flash('error')[0]
        });
    } catch (error) {
        console.error('Error in loadProduct:', error);
        req.flash('error', 'Error loading products');
        res.redirect('/admin/dashboard');
    }
};

// Load Add Product Page
const loadAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isDeleted: false });
        res.render('admin/addProduct', {
            categories,
            message: req.flash('error')[0] || req.flash('success')[0],
            messageType: req.flash('error').length ? 'error' : 'success'
        });
    } catch (error) {
        console.error('Error in loadAddProduct:', error);
        req.flash('error', 'Error loading add product page');
        res.redirect('/admin/products');
    }
};

// Add New Product
const addProduct = async (req, res) => {
    try {
        if (!req.files || !req.files['images'] || req.files['images'].length === 0) {
            throw new Error('At least one product image is required');
        }

        const {
            name, brand, category, price, productOffer, stock, description, specifications
        } = req.body;

        const validateField = (field, value, message) => {
            if (!value || value.trim() === '') throw new Error(message);
            return value.trim();
        };

        const validatedFields = {
            name: validateField('name', name, 'Product name is required'),
            brand: validateField('brand', brand, 'Brand is required'),
            description: validateField('description', description, 'Description is required'),
            category: validateField('category', category, 'Category is required'),
            processor: validateField('processor', specifications?.processor, 'Processor is required'),
            ram: validateField('ram', specifications?.ram, 'RAM is required'),
            storage: validateField('storage', specifications?.storage, 'Storage is required'),
            graphics: validateField('graphics', specifications?.graphics, 'Graphics is required')
        };

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            throw new Error('Price must be a valid non-negative number');
        }

        const parsedStock = parseInt(stock);
        if (isNaN(parsedStock) || parsedStock < 0) {
            throw new Error('Stock must be a valid non-negative integer');
        }

        const discount = parseInt(productOffer || 0);
        if (isNaN(discount) || discount < 0 || discount > 100) {
            throw new Error('Discount must be a valid number between 0 and 100');
        }

        const categoryExists = await Category.findOne({ _id: category, isDeleted: false });
        if (!categoryExists) {
            throw new Error('Selected category does not exist or is deleted');
        }
        const images = req.files['images'].map(file => file.path);



        const newProduct = new Product({
            name: validatedFields.name,
            brand: validatedFields.brand,
            category,
            description: validatedFields.description,
            price: parsedPrice,
            productOffer: discount,
            stock: parsedStock,
            specifications: {
                processor: validatedFields.processor,
                ram: validatedFields.ram,
                storage: validatedFields.storage,
                graphics: validatedFields.graphics
            },
            images,
            isListed: true,
            isDeleted: false
        });

        await newProduct.save();
        res.status(200).json({ success: true, message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error('Error in addProduct:', error);
        if (req.files && req.files['images']) {
            await Promise.all(
                req.files['images'].map(file =>
                    fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
                )
            );
        }
        res.status(400).json({ success: false, message: error.message || 'Error adding product' });
    }
};

// Load Edit Product Page
const loadEditProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category', 'name').lean();
        if (!product) throw new Error('Product not found');
        const categories = await Category.find({ isDeleted: false }).lean();

        res.render('admin/editProduct', {
            product,
            categories,
            message: req.flash('error')[0] || req.flash('success')[0],
            messageType: req.flash('error').length ? 'error' : 'success'
        });
    } catch (error) {
        console.error('Error in loadEditProduct:', error);
        req.flash('error', error.message || 'Error loading product');
        res.redirect('/admin/products');
    }
};

// Update Product
const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const { name, brand, category, description, productOffer, price, stock, processor, ram, storage, graphics } = req.body;

        const requiredFields = {
            name: 'Product name',
            brand: 'Brand',
            category: 'Category',
            description: 'Description',
            price: 'Price',
            stock: 'Stock',
            processor: 'Processor',
            ram: 'RAM',
            storage: 'Storage',
            graphics: 'Graphics'
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([key]) => !req.body[key]?.trim())
            .map(([_, label]) => label);
        if (missingFields.length > 0) {
            return res.status(400).json({ success: false, message: `Missing required fields: ${missingFields.join(', ')}` });
        }

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ success: false, message: 'Price must be a valid non-negative number' });
        }

        const parsedStock = parseInt(stock);
        if (isNaN(parsedStock) || parsedStock < 0) {
            return res.status(400).json({ success: false, message: 'Stock must be a valid non-negative integer' });
        }

        const discountPercentage = parseInt(productOffer || 0);
        if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
            return res.status(400).json({ success: false, message: 'Discount must be a valid number between 0 and 100' });
        }

        const categoryExists = await Category.findOne({ _id: category, isDeleted: false });
        if (!categoryExists) {
            return res.status(400).json({ success: false, message: 'Selected category does not exist or is deleted' });
        }

        const updateData = {
            name: name.trim(),
            brand: brand.trim(),
            category,
            description: description.trim(),
            price: parsedPrice,
            productOffer: discountPercentage,
            stock: parsedStock,
            specifications: {
                processor: processor.trim(),
                ram: ram.trim(),
                storage: storage.trim(),
                graphics: graphics.trim()
            }
        };

        if (req.files && req.files['images'] && req.files['images'].length > 0) {
            updateData.images = [...product.images, ...req.files['images'].map(file => file.path)]; // Cloudinary URLs

        } else {
            updateData.images = product.images;
        }

        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { runValidators: true, new: true });
        return res.status(200).json({ success: true, message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        console.error('Error in updateProduct:', error);
        if (req.files && req.files['images']) {
            await Promise.all(
                req.files['images'].map(file =>
                    fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
                )
            );
        }
        return res.status(500).json({ success: false, message: error.message || 'Error updating product' });
    }
};

// Replace Product Image
const replaceProductImage = async (req, res) => {
    try {
        const { productId } = req.params;
        const { imageIndex } = req.body;

        if (!productId || imageIndex === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required parameters: productId and imageIndex' });
        }

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        if (!product.images[imageIndex]) return res.status(400).json({ success: false, message: 'Image index not found in product' });
        if (!req.files || !req.files['newImage'] || req.files['newImage'].length === 0) {
            return res.status(400).json({ success: false, message: 'A new image is required to replace the deleted one' });
        }

        const oldImagePath = product.images[imageIndex];
        const newImage = req.files['newImage'][0];
        const newImagePath = newImage.path; 


        const absoluteOldPath = path.join(__dirname, '../../uploads/products', path.basename(oldImagePath));
        await fs.unlink(absoluteOldPath).catch(err => console.error(`Warning: Could not delete file ${absoluteOldPath}:`, err));

        product.images[imageIndex] = newImagePath;
        await product.save();

        return res.status(200).json({
            success: true,
            message: 'Image replaced successfully',
            newImageUrl: newImagePath
        });
    } catch (error) {
        console.error('Error in replaceProductImage:', error);
        if (req.files && req.files['newImage']) {
            await fs.unlink(req.files['newImage'][0].path).catch(err => console.error('Error deleting file:', err));
        }
        return res.status(500).json({ success: false, message: error.message || 'Server error while replacing image' });
    }
};

// Toggle Listing Status
const toggleListStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        product.isListed = !product.isListed;
        await product.save();
        res.status(200).json({ success: true, message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully` });
    } catch (error) {
        console.error('Error toggling product list status:', error);
        res.status(500).json({ success: false, message: 'Server error while toggling product status' });
    }
};

// Toggle Featured Status
const toggleFeaturedStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        product.isFeatured = !product.isFeatured;
        await product.save();
        res.status(200).json({
            success: true,
            message: `Product ${product.isFeatured ? 'marked as featured' : 'removed from featured'} successfully`
        });
    } catch (error) {
        console.error('Error toggling featured status:', error);
        res.status(500).json({ success: false, message: 'Server error while toggling featured status' });
    }
};

// Soft Delete Product
const softDeleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        product.isDeleted = !product.isDeleted;
        await product.save();
        res.status(200).json({ success: true, message: `Product ${product.isDeleted ? 'marked as deleted' : 'restored'} successfully` });
    } catch (error) {
        console.error('Error soft deleting product:', error);
        res.status(500).json({ success: false, message: 'Server error while soft deleting product' });
    }
};

module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    updateProduct,
    replaceProductImage,
    toggleListStatus,
    toggleFeaturedStatus,
    softDeleteProduct
};