// adminRouter.js
const express = require('express');
const router = express.Router();

const adminControllers = require('../controllers/Admin/adminController');
const customerController = require('../controllers/Admin/customerController');
const categoryController = require('../controllers/Admin/categoryController');
const productController = require('../controllers/Admin/productController');
const orderController = require('../controllers/Admin/orderControllers');
const offerController = require('../controllers/Admin/offerController');
const couponController = require('../controllers/Admin/couponController');
const returnController = require('../controllers/Admin/returnOrderController');
const { upload, handleMulterError } = require('../config/cloudinary');
const admin = require('../middleware/adminAuth');

// Admin Authentication Routes
router.get('/pageerror', adminControllers.pageerror);
router.get('/login', adminControllers.loadLogin);
router.post('/login', adminControllers.login);
router.get('/dashboard', admin.isAdmin, adminControllers.loadDashboard);
router.get('/logout', adminControllers.logout);

// Sales Report Routes (API Endpoints Only)
router.get('/sales-report/data', admin.isAdmin, adminControllers.getSalesReport);
router.get('/sales-report/download', admin.isAdmin, adminControllers.downloadSalesReport);
router.get('/top-sellers', admin.isAdmin, adminControllers.getTopSellers);
router.get('/detailed-orders', admin.isAdmin, adminControllers.getDetailedOrders);

// Coupon Application Route
router.post('/apply-coupon', admin.isAdmin, adminControllers.applyCouponToOrder);

// User Management Routes
router.get('/users', admin.isAdmin, customerController.customerInfo);
router.put('/users/block/:id', admin.isAdmin, customerController.blockUser);

// Category Management Routes
router.get('/categories', admin.isAdmin, categoryController.categoryInfo);
router.get('/categories/:id', admin.isAdmin, categoryController.getCategoryDetails);
router.get('/addCategory', admin.isAdmin, categoryController.loadCategory);
router.post('/addCategory', admin.isAdmin, categoryController.addCategory);
router.get('/editCategory/:id', admin.isAdmin, categoryController.loadEditCategory);
router.put('/updateCategory/:id', admin.isAdmin, categoryController.updateCategory);
router.put('/toggleCategoryStatus/:id', admin.isAdmin, categoryController.toggleCategoryStatus);

// Product Management 
router.get('/products', admin.isAdmin, productController.loadProduct);
router.get('/addProduct', admin.isAdmin, productController.loadAddProduct);
router.post('/addProduct', admin.isAdmin, upload, handleMulterError, productController.addProduct);
router.get('/editProduct/:id', admin.isAdmin, productController.loadEditProduct);
router.post('/editProduct/:id', admin.isAdmin, upload, handleMulterError, productController.updateProduct);
router.post('/replaceProductImage/:productId', admin.isAdmin, upload, handleMulterError, productController.replaceProductImage);
router.post('/products/:id/toggle-list', admin.isAdmin, productController.toggleListStatus);
router.post('/products/:id/toggle-featured', admin.isAdmin, productController.toggleFeaturedStatus);
router.post('/softDeleteProduct/:id', admin.isAdmin, productController.softDeleteProduct);

// Order Management
router.get('/orders', admin.isAdmin, orderController.getOrders);
router.patch('/orders/:orderId/toggle-status', admin.isAdmin, orderController.toggleOrderStatus);
router.get('/orders/:orderId', admin.isAdmin, orderController.viewOrderDetails);
router.post('/orders/:orderId/cancel-product', admin.isAdmin, orderController.cancelProduct);
router.post('/orders/:orderId/return-product', admin.isAdmin, orderController.returnProduct);
router.post('/orders/:orderId/approve-return', admin.isAdmin, orderController.approveReturn);

// Offer Management
router.get('/offers', admin.isAdmin, offerController.getAllOffers);
router.get('/offers/add', admin.isAdmin, offerController.getAddOffer);
router.post('/offers/add', admin.isAdmin, offerController.postAddOffer);
router.get('/offers/edit/:id', admin.isAdmin, offerController.getEditOffer);
router.post('/offers/edit/:id', admin.isAdmin, offerController.postEditOffer);
router.patch('/offers/toggle/:id', admin.isAdmin, offerController.toggleOfferStatus);

// Coupon Management
router.get('/coupons', admin.isAdmin, couponController.getAllCoupon);
router.get('/add-coupon', admin.isAdmin, couponController.getCreateCouponForm);
router.post('/addCoupon', admin.isAdmin, couponController.postCreateCoupon);
router.get('/editCoupon/:Id', admin.isAdmin, couponController.getEditCouponForm);
router.post('/editCoupon/:Id', admin.isAdmin, couponController.updateCoupon);
router.get('/deleteCoupon/:Id', admin.isAdmin, couponController.deleteCoupon);
router.delete('/deleteCoupon/:Id', admin.isAdmin, couponController.deleteCoupon);

// Return Request Management
router.get('/return/requests', admin.isAdmin, returnController.getReturnRequests);
router.post('/return/approve/:id', admin.isAdmin, returnController.approveReturnRequest);
router.post('/return/reject/:id', admin.isAdmin, returnController.rejectReturnRequest);
router.get('/return/order-details/:id', admin.isAdmin, returnController.getReturnRequestDetails);

module.exports = router;