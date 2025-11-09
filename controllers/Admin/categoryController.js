const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

// Load Categories Page
const categoryInfo = async (req, res) => {
    try {
        const { page = 1, search = "", status = "", sort = "date" } = req.query;
        const perPage = 5;
        const currentPage = parseInt(page);

        let query = { isDeleted: false };

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }
        if (status !== "") {
            query.isActive = status === "true";
        }

        let sortOption = sort === "name" ? { name: 1 } : { createdAt: -1 };

        const totalCategories = await Category.countDocuments(query);
        const categories = await Category.find(query)
            .sort(sortOption)
            .skip((currentPage - 1) * perPage)
            .limit(perPage);

        res.render('admin/categories', { 
            path: req.path,
            categories, 
            currentPage,
            totalPages: Math.ceil(totalCategories / perPage),
            search,
            status,
            sort
        });

    } catch (error) {
        console.error('Error in categoryInfo:', error);
        req.flash('error', 'Error loading categories');
        res.redirect('/admin/dashboard');
    }
};

// Load Add Category Page
const loadCategory = async (req, res) => {
    try {
        res.render('admin/addCategory');
    } catch (error) {
        console.error('Error in loadCategory:', error);
        res.redirect('/admin/categories');
    }
};

// Add New Category
const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Backend Validation
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        if (name.trim().length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Category name must be at least 4 characters'
            });
        }

        if (!description || !description.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Category description is required'
            });
        }

        if (description.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Description must be at least 10 characters'
            });
        }

        // Check for existing category (case-insensitive)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            isDeleted: false
        });

        if (existingCategory) {
            return res.status(409).json({
                success: false,
                message: 'Category with this name already exists'
            });
        }

        // Create new category
        const newCategory = new Category({
            name: name.trim(),
            description: description.trim()
        });

        await newCategory.save();

        return res.status(201).json({
            success: true,
            message: 'Category added successfully'
        });

    } catch (error) {
        console.error('Error in addCategory:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while adding the category'
        });
    }
};

// Load Edit Category Page
const loadEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Ensure valid MongoDB ObjectId
        if (!categoryId.match(/^[0-9a-fA-F]{24}$/)) {
            req.flash('error', 'Invalid category ID');
            return res.redirect('/admin/categories');
        }

        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        // Pass category data to the view
        res.render('admin/editCategory', {
            category: {
                id: category._id,
                name: category.name,
                description: category.description,
                isActive: category.isActive
            },
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in loadEditCategory:', error);
        req.flash('error', 'Error loading category');
        res.redirect('/admin/categories');
    }
};

// Update Category
const updateCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, description } = req.body;

        // Validate required fields
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        if (!description || !description.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Category description is required'
            });
        }

        // Check for existing category with same name
        const existingCategory = await Category.findOne({
            name: name.trim(),
            _id: { $ne: categoryId },
            isDeleted: false
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category name already exists'
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            {
                name: name.trim(),
                description: description.trim()
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            message: 'Category updated successfully',
            category: updatedCategory
        });
    } catch (error) {
        console.error('Error in updateCategory:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating category'
        });
    }
};

// Delete Category
const deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Check if category has associated products
        const productsCount = await Product.countDocuments({
            category: categoryId,
            isDeleted: false
        });

        if (productsCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with associated products',
                productsCount
            });
        }

        const deletedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { isDeleted: true },
            { new: true }
        );

        if (!deletedCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteCategory:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting category'
        });
    }
};

// Toggle Category Status
const toggleCategoryStatus = async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Add validation for categoryId
        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: 'Category ID is required'
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Toggle the status
        category.isActive = !category.isActive;
        await category.save();

        // Set proper headers
        res.setHeader('Content-Type', 'application/json');
        
        return res.status(200).json({
            success: true,
            message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
            isActive: category.isActive,
            category: {
                _id: category._id,
                name: category.name,
                isActive: category.isActive
            }
        });
    } catch (error) {
        console.error('Error in toggleCategoryStatus:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error toggling category status'
        });
    }
};

const getCategoryDetails = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            category: {
                _id: category._id,
                name: category.name,
                description: category.description,
                isActive: category.isActive
            }
        });
    } catch (error) {
        console.error('Error in getCategoryDetails:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching category details'
        });
    }
};

module.exports = {
    categoryInfo,
    loadCategory,
    addCategory,
    loadEditCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    getCategoryDetails
};