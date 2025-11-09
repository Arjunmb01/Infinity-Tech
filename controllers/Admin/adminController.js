const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/coupounSchema');
const Return = require('../../models/returnSchema');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const QuickChart = require('quickchart-js');

const pageerror = async (req, res) => {
    res.render('admin-error');
};

const loadLogin = (req, res) => {
    try {
        if (req.session.admin) return res.redirect('/admin/dashboard');
        res.render('adminLogin', { message: null });
    } catch (error) {
        console.error('Error loading admin login:', error);
        res.status(500).send('Internal Server Error');
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.render('adminLogin', { message: 'Email and password are required' });

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) return res.render('adminLogin', { message: 'Invalid admin credentials' });

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (passwordMatch) {
            req.session.admin = { id: admin._id, email: admin.email, isAdmin: admin.isAdmin };
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.render('adminLogin', { message: 'An error occurred during login' });
                }
                res.redirect('/admin/dashboard');
            });
        } else {
            return res.render('adminLogin', { message: 'Invalid password' });
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.render('adminLogin', { message: 'An error occurred during login' });
    }
};

const applyCouponToOrder = async (req, res) => {
    try {
        const { orderId, couponCode } = req.body;
        const adminId = req.session.admin?.id;

        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon || !coupon.isActive || coupon.expiredOn < new Date()) {
            return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
        }

        if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        const order = await Order.findById(orderId);
        if (!order || order.status !== "Delivered" || order.orderAmount < coupon.minimumPrice) {
            return res.status(400).json({ success: false, message: "Order not eligible for this coupon" });
        }

        const discount = coupon.offerType === "percentage"
            ? (order.orderAmount * coupon.offerValue) / 100
            : coupon.offerValue;

        order.offerApplied = discount;
        order.couponApplied = coupon._id;
        order.couponDiscount = discount;
        order.couponCode = coupon.code;
        await order.save();

        coupon.couponUsed += 1;
        const userIndex = coupon.users.findIndex(u => u.userId.toString() === order.user.toString());
        if (userIndex >= 0) {
            coupon.users[userIndex].usageCount += 1;
        } else {
            coupon.users.push({ userId: order.user, usageCount: 1 });
        }
        await coupon.save();

        res.json({ success: true, message: "Coupon applied successfully", discount });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: "Error applying coupon" });
    }
};

const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) return res.redirect('/admin/login');

        const userCount = await User.countDocuments({ isBlocked: false });
        const totalOrders = await Order.countDocuments();
        const totalSalesData = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $group: { _id: null, total: { $sum: "$orderAmount" } } }
        ]);
        const totalSales = totalSalesData[0]?.total || 0;

        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

        const initialSales = await Order.aggregate([
            { $match: { status: "Delivered", orderDate: { $gte: thirtyDaysAgo, $lte: new Date() } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    orders: { $sum: 1 },
                    sales: { $sum: "$orderAmount" },
                    totalItems: { $sum: { $sum: "$products.quantity" } },
                    totalCouponsUsed: {
                        $sum: { $cond: { if: { $and: [{ $ne: ["$couponCode", null] }, { $ne: ["$couponCode", ""] }] }, then: 1, else: 0 } }
                    },
                    couponDeductions: { $sum: "$couponDiscount" }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", orders: 1, sales: 1, totalItems: 1, totalCouponsUsed: 1, couponDeductions: 1, _id: 0 } }
        ]);

        const couponStats = await Coupon.aggregate([
            { $group: { _id: null, totalCoupons: { $sum: 1 }, activeCoupons: { $sum: { $cond: ["$isActive", 1, 0] } } } }
        ]);

        const recentOrders = await Order.find({})
            .sort({ orderDate: -1 })
            .limit(5)
            .populate('user', 'name email') // Updated to include email
            .lean()
            .select('orderDate orderAmount paymentMethod status user');
        console.log('Recent Orders:', recentOrders); // Debugging

        res.render('adminDashboard', {
            path: req.path,
            userCount,
            totalOrders,
            totalSales,
            initialSales: JSON.stringify(initialSales),
            couponStats: JSON.stringify(couponStats[0] || { totalCoupons: 0, activeCoupons: 0 }),
            recentOrders: JSON.stringify(recentOrders)
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.redirect('/admin/pageerror');
    }
};

const logout = async (req, res) => {
    try {
        if (req.session) {
            req.session.destroy(err => {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.redirect('/admin/pageerror');
                }
                res.clearCookie('connect.sid');
                res.redirect('/admin/login');
            });
        } else {
            res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Unexpected error during logout:', error);
        res.redirect('/admin/pageerror');
    }
};

const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, timeFrame = 'daily' } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let dateFormat;
        switch (timeFrame) {
            case 'daily': dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } }; break;
            case 'weekly': dateFormat = { $week: "$orderDate" }; break;
            case 'monthly': dateFormat = { $month: "$orderDate" }; break;
            case 'yearly': dateFormat = { $year: "$orderDate" }; break;
            default: dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        }

        const salesData = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end }, status: "Delivered" } },
            {
                $group: {
                    _id: dateFormat,
                    orders: { $sum: 1 },
                    sales: { $sum: "$orderAmount" },
                    totalItems: { $sum: { $sum: "$products.quantity" } },
                    totalCouponsUsed: {
                        $sum: { $cond: { if: { $and: [{ $ne: ["$couponCode", null] }, { $ne: ["$couponCode", ""] }] }, then: 1, else: 0 } }
                    },
                    couponDeductions: { $sum: "$couponDiscount" }
                }
            },
            { $project: { date: "$_id", orders: 1, sales: 1, totalItems: 1, totalCouponsUsed: 1, couponDeductions: 1, _id: 0 } },
            { $sort: { date: 1 } }
        ]);

        const paymentMethodStats = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end }, status: "Delivered" } },
            { $group: { _id: "$paymentMethod", count: { $sum: 1 } } }
        ]);

        const summary = salesData.reduce(
            (acc, curr) => ({
                totalSales: acc.totalSales + curr.sales,
                totalOrders: acc.totalOrders + curr.orders,
                totalItems: acc.totalItems + curr.totalItems,
                totalCouponsUsed: acc.totalCouponsUsed + curr.totalCouponsUsed,
                couponDeductions: acc.couponDeductions + curr.couponDeductions,
                avgOrderValue: (acc.totalSales + curr.sales) / (acc.totalOrders + curr.orders) || 0
            }),
            { totalSales: 0, totalOrders: 0, totalItems: 0, totalCouponsUsed: 0, couponDeductions: 0, avgOrderValue: 0 }
        );

        res.json({ success: true, data: { salesData, summary, paymentMethodStats, timeFrame } });
    } catch (error) {
        console.error("Error fetching sales report:", error);
        res.status(500).json({ success: false, message: "Error fetching sales report" });
    }
};

const downloadSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, timeFrame = 'daily', format } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let dateFormat;
        switch (timeFrame) {
            case 'daily': dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } }; break;
            case 'weekly': dateFormat = { $week: "$orderDate" }; break;
            case 'monthly': dateFormat = { $month: "$orderDate" }; break;
            case 'yearly': dateFormat = { $year: "$orderDate" }; break;
            default: dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        }

        const salesData = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end }, status: "Delivered" } },
            {
                $group: {
                    _id: dateFormat,
                    orders: { $sum: 1 },
                    sales: { $sum: "$orderAmount" },
                    totalItems: { $sum: { $sum: "$products.quantity" } },
                    totalCouponsUsed: {
                        $sum: { $cond: { if: { $and: [{ $ne: ["$couponCode", null] }, { $ne: ["$couponCode", ""] }] }, then: 1, else: 0 } }
                    },
                    couponDeductions: { $sum: "$couponDiscount" }
                }
            },
            { $project: { date: "$_id", orders: 1, sales: 1, totalItems: 1, totalCouponsUsed: 1, couponDeductions: 1, _id: 0 } },
            { $sort: { date: 1 } }
        ]);

        const summary = salesData.reduce(
            (acc, curr) => ({
                totalSales: acc.totalSales + curr.sales,
                totalOrders: acc.totalOrders + curr.orders,
                totalItems: acc.totalItems + curr.totalItems,
                totalCouponsUsed: acc.totalCouponsUsed + curr.totalCouponsUsed,
                couponDeductions: acc.couponDeductions + curr.couponDeductions,
                avgOrderValue: (acc.totalSales + curr.sales) / (acc.totalOrders + curr.orders) || 0
            }),
            { totalSales: 0, totalOrders: 0, totalItems: 0, totalCouponsUsed: 0, couponDeductions: 0, avgOrderValue: 0 }
        );

        const paymentData = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end } } },
            { $group: { _id: "$paymentMethod", count: { $sum: 1 }, amount: { $sum: "$orderAmount" } } }
        ]);

        const failedTransactions = await Order.countDocuments({ orderDate: { $gte: start, $lte: end }, paymentStatus: "Failed" });
        const refunds = await Return.aggregate([
            { $match: { returnDate: { $gte: start, $lte: end }, status: "Approved" } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$refundAmount" } } }
        ]);

        const couponsUsed = await Coupon.find({ couponUsed: { $gt: 0 } }).lean();
        const topProducts = await Order.aggregate([
            { $match: { status: "Delivered", orderDate: { $gte: start, $lte: end } } },
            { $unwind: "$products" },
            { $group: { _id: "$products.productId", units: { $sum: "$products.quantity" }, revenue: { $sum: "$products.totalPrice" } } },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $project: { name: "$product.name", units: 1, revenue: 1 } },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
        ]);

        const topCategories = await Order.aggregate([
            { $match: { status: "Delivered", orderDate: { $gte: start, $lte: end } } },
            { $unwind: "$products" },
            { $lookup: { from: "products", localField: "products.productId", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $group: { _id: "$product.category", units: { $sum: "$products.quantity" }, revenue: { $sum: "$products.totalPrice" } } },
            { $lookup: { from: "laptopcategories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: { name: "$category.name", units: 1, revenue: 1 } },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
        ]);

        const orderStatus = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end } } },
            { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$orderAmount" } } }
        ]);

        const locationData = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end } } },
            { $group: { _id: "$shippingAddress.city", sales: { $sum: "$orderAmount" }, orders: { $sum: 1 } } },
            { $sort: { sales: -1 } },
            { $limit: 5 }
        ]);

        const totalCustomers = await User.countDocuments();
        const newCustomers = await User.countDocuments({ createdAt: { $gte: start, $lte: end } });
        const returningCustomers = totalCustomers - newCustomers;

        const chartGenerator = async (config) => {
            const chart = new QuickChart();
            chart.setConfig(config);
            chart.setWidth(600);
            chart.setHeight(400);
            const url = chart.getUrl();
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch chart image: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        };

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-to-${endDate}.pdf`);
            doc.pipe(res);

            doc.fontSize(25).font('Helvetica-Bold').fillColor('#2c3e50').text('E-Commerce Sales Report', { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(14).font('Helvetica').fillColor('#34495e').text('InfinityTech', { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(12).text(`Date Range: ${start.toDateString()} - ${end.toDateString()}`, { align: 'center' });
            doc.text(`Generated On: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.text(`Prepared By: ${req.session.admin.email}`, { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(10).text(`Report Summary: Sales totaled ₹${summary.totalSales.toFixed(2)} with ${summary.totalOrders} orders.`, { align: 'center' });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').fillColor('#2c3e50').text('Table of Contents', 50);
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica').fillColor('#34495e')
                .text('1. Sales Overview', 50, doc.y).text('2', 500, doc.y, { align: 'right' })
                .text('2. Discounts & Coupons', 50, doc.y + 20).text('3', 500, doc.y + 20, { align: 'right' })
                .text('3. Payment Breakdown', 50, doc.y + 40).text('4', 500, doc.y + 40, { align: 'right' })
                .text('4. Top-Selling Insights', 50, doc.y + 60).text('5', 500, doc.y + 60, { align: 'right' })
                .text('5. Order & Delivery Status', 50, doc.y + 80).text('7', 500, doc.y + 80, { align: 'right' })
                .text('6. Customer & Location Insights', 50, doc.y + 100).text('9', 500, doc.y + 100, { align: 'right' });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').text('1. Sales Overview', 50);
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica')
                .text(`Total Sales: ₹${summary.totalSales.toFixed(2)}`, 50)
                .text(`Total Orders: ${summary.totalOrders}`, 50, doc.y + 15)
                .text(`Net Revenue: ₹${(summary.totalSales - summary.couponDeductions).toFixed(2)}`, 50, doc.y + 15)
                .text(`Average Order Value: ₹${summary.avgOrderValue.toFixed(2)}`, 50, doc.y + 15)
                .text(`Total Items Sold: ${summary.totalItems}`, 50, doc.y + 15)
                .text(`Total Customers: ${totalCustomers} (New: ${newCustomers}, Returning: ${returningCustomers})`, 50, doc.y + 15);
            const salesChart = await chartGenerator({
                type: 'line',
                data: { labels: salesData.map(d => d.date), datasets: [{ label: 'Sales', data: salesData.map(d => d.sales), borderColor: '#3498db', fill: false }] },
                options: { scales: { y: { beginAtZero: true } } }
            });
            doc.image(salesChart, 50, doc.y + 20, { width: 500 });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').text('2. Discounts & Coupons', 50);
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica')
                .text(`Total Coupons Used: ${summary.totalCouponsUsed}`, 50)
                .text(`Total Discounts Applied: ${(summary.couponDeductions / summary.totalSales * 100 || 0).toFixed(2)}%`, 50, doc.y + 15)
                .text(`Total Coupon Deductions: ₹${summary.couponDeductions.toFixed(2)}`, 50, doc.y + 15);
            doc.moveDown(1);
            doc.text('Coupons Used:', 50);
            couponsUsed.forEach((coupon) => {
                doc.text(`${coupon.code} - ${coupon.offerValue}${coupon.offerType === 'percentage' ? '%' : '₹'}`, 70, doc.y + 15);
            });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').text('3. Payment Breakdown', 50);
            doc.moveDown(1);
            paymentData.forEach((method) => {
                doc.fontSize(12).font('Helvetica').text(`${method._id}: ₹${method.amount.toFixed(2)} (${method.count} orders)`, 50, doc.y + 15);
            });
            doc.text(`Total Failed Transactions: ${failedTransactions}`, 50, doc.y + 15);
            doc.text(`Refunds Processed: ${refunds[0]?.count || 0} (₹${refunds[0]?.amount.toFixed(2) || '0.00'})`, 50, doc.y + 15);
            const paymentChart = await chartGenerator({
                type: 'pie',
                data: { labels: paymentData.map(p => p._id), datasets: [{ data: paymentData.map(p => p.amount), backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f'] }] }
            });
            doc.image(paymentChart, 50, doc.y + 20, { width: 500 });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').text('4. Top-Selling Insights', 50);
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica').text('Top Products:', 50);
            topProducts.forEach((p) => doc.text(`${p.name}: ${p.units} units, ₹${p.revenue.toFixed(2)}`, 70, doc.y + 15));
            doc.moveDown(1);
            doc.text('Top Categories:', 50);
            topCategories.forEach((c) => doc.text(`${c.name}: ${c.units} units, ₹${c.revenue.toFixed(2)}`, 70, doc.y + 15));
            const productChart = await chartGenerator({
                type: 'bar',
                data: { labels: topProducts.map(p => p.name), datasets: [{ label: 'Revenue', data: topProducts.map(p => p.revenue), backgroundColor: '#3498db' }] }
            });
            doc.image(productChart, 50, doc.y + 20, { width: 500 });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').text('5. Order & Delivery Status', 50);
            doc.moveDown(1);
            orderStatus.forEach((status) => {
                doc.fontSize(12).font('Helvetica').text(`${status._id}: ${status.count} orders, ₹${status.amount.toFixed(2)}`, 50, doc.y + 15);
            });
            doc.addPage();

            doc.fontSize(18).font('Helvetica-Bold').text('6. Customer & Location Insights', 50);
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica').text('Top Sales by City:', 50);
            locationData.forEach((loc) => doc.text(`${loc._id}: ₹${loc.sales.toFixed(2)} (${loc.orders} orders)`, 70, doc.y + 15));
            const locationChart = await chartGenerator({
                type: 'bar',
                data: { labels: locationData.map(l => l._id), datasets: [{ label: 'Sales', data: locationData.map(l => l.sales), backgroundColor: '#2ecc71' }] }
            });
            doc.image(locationChart, 50, doc.y + 20, { width: 500 });

            doc.end();
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = req.session.admin.email;
            workbook.created = new Date();

            const salesSheet = workbook.addWorksheet('Sales Overview');
            salesSheet.mergeCells('A1:F1');
            salesSheet.getCell('A1').value = 'E-Commerce Sales Report';
            salesSheet.getCell('A1').font = { size: 16, bold: true };
            salesSheet.getCell('A1').alignment = { horizontal: 'center' };
            salesSheet.addRow([`Period: ${start.toDateString()} - ${end.toDateString()}`]).alignment = { horizontal: 'center' };
            salesSheet.addRow(['Total Sales', `₹${summary.totalSales.toFixed(2)}`]);
            salesSheet.addRow(['Total Orders', summary.totalOrders]);
            salesSheet.addRow(['Net Revenue', `₹${(summary.totalSales - summary.couponDeductions).toFixed(2)}`]);
            salesSheet.addRow(['Average Order Value', `₹${summary.avgOrderValue.toFixed(2)}`]);
            salesSheet.addRow(['Total Items Sold', summary.totalItems]);
            salesSheet.addRow(['Total Customers', `${totalCustomers} (New: ${newCustomers}, Returning: ${returningCustomers})`]);
            salesSheet.addRow([]);
            salesSheet.addRow(['Date', 'Orders', 'Sales (₹)', 'Items Sold', 'Coupons Used', 'Coupon Deductions (₹)']).font = { bold: true };
            salesData.forEach(d => salesSheet.addRow([d.date, d.orders, d.sales.toFixed(2), d.totalItems, d.totalCouponsUsed, d.couponDeductions.toFixed(2)]));
            salesSheet.columns.forEach(col => col.width = 15);
            const salesChartImg = workbook.addImage({
                buffer: await chartGenerator({
                    type: 'line',
                    data: { labels: salesData.map(d => d.date), datasets: [{ label: 'Sales', data: salesData.map(d => d.sales), borderColor: '#3498db', fill: false }] }
                }),
                extension: 'png'
            });
            salesSheet.addImage(salesChartImg, 'A12:F20');

            const couponSheet = workbook.addWorksheet('Discounts & Coupons');
            couponSheet.addRow(['Total Coupons Used', summary.totalCouponsUsed]);
            couponSheet.addRow(['Total Discounts Applied (%)', (summary.couponDeductions / summary.totalSales * 100 || 0).toFixed(2)]);
            couponSheet.addRow(['Total Coupon Deductions', `₹${summary.couponDeductions.toFixed(2)}`]);
            couponSheet.addRow([]);
            couponSheet.addRow(['Coupon Code', 'Discount']).font = { bold: true };
            couponsUsed.forEach(c => couponSheet.addRow([c.code, `${c.offerValue}${c.offerType === 'percentage' ? '%' : '₹'}`]));
            couponSheet.columns.forEach(col => col.width = 20);

            const paymentSheet = workbook.addWorksheet('Payment Breakdown');
            paymentSheet.addRow(['Payment Method', 'Orders', 'Amount (₹)']).font = { bold: true };
            paymentData.forEach(p => paymentSheet.addRow([p._id, p.count, p.amount.toFixed(2)]));
            paymentSheet.addRow(['Total Failed Transactions', failedTransactions]);
            paymentSheet.addRow(['Refunds Processed', `${refunds[0]?.count || 0} (₹${refunds[0]?.amount.toFixed(2) || '0.00'})`]);
            paymentSheet.columns.forEach(col => col.width = 15);
            const paymentChartImg = workbook.addImage({
                buffer: await chartGenerator({
                    type: 'pie',
                    data: { labels: paymentData.map(p => p._id), datasets: [{ data: paymentData.map(p => p.amount), backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f'] }] }
                }),
                extension: 'png'
            });
            paymentSheet.addImage(paymentChartImg, 'A7:F15');

            const topSheet = workbook.addWorksheet('Top-Selling Insights');
            topSheet.addRow(['Top Products']).font = { bold: true };
            topSheet.addRow(['Name', 'Units Sold', 'Revenue (₹)']).font = { bold: true };
            topProducts.forEach(p => topSheet.addRow([p.name, p.units, p.revenue.toFixed(2)]));
            topSheet.addRow([]);
            topSheet.addRow(['Top Categories']).font = { bold: true };
            topSheet.addRow(['Name', 'Units Sold', 'Revenue (₹)']).font = { bold: true };
            topCategories.forEach(c => topSheet.addRow([c.name, c.units, c.revenue.toFixed(2)]));
            topSheet.columns.forEach(col => col.width = 20);
            const productChartImg = workbook.addImage({
                buffer: await chartGenerator({
                    type: 'bar',
                    data: { labels: topProducts.map(p => p.name), datasets: [{ label: 'Revenue', data: topProducts.map(p => p.revenue), backgroundColor: '#3498db' }] }
                }),
                extension: 'png'
            });
            topSheet.addImage(productChartImg, 'A10:F20');

            const orderSheet = workbook.addWorksheet('Order & Delivery Status');
            orderSheet.addRow(['Status', 'Count', 'Amount (₹)']).font = { bold: true };
            orderStatus.forEach(s => orderSheet.addRow([s._id, s.count, s.amount.toFixed(2)]));
            orderSheet.columns.forEach(col => col.width = 15);

            const locationSheet = workbook.addWorksheet('Customer & Location');
            locationSheet.addRow(['City', 'Orders', 'Sales (₹)']).font = { bold: true };
            locationData.forEach(l => locationSheet.addRow([l._id, l.orders, l.sales.toFixed(2)]));
            locationSheet.columns.forEach(col => col.width = 15);
            const locationChartImg = workbook.addImage({
                buffer: await chartGenerator({
                    type: 'bar',
                    data: { labels: locationData.map(l => l._id), datasets: [{ label: 'Sales', data: locationData.map(l => l.sales), backgroundColor: '#2ecc71' }] }
                }),
                extension: 'png'
            });
            locationSheet.addImage(locationChartImg, 'A5:F15');

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-to-${endDate}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else {
            res.status(400).json({ success: false, message: 'Invalid format specified' });
        }
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({ success: false, message: "Error generating sales report" });
    }
};

const getTopSellers = async (req, res) => {
    try {
        const products = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$products" },
            { $group: { _id: "$products.productId", value: { $sum: "$products.totalPrice" }, quantity: { $sum: "$products.quantity" } } },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $project: { name: "$product.name", value: 1, quantity: 1 } },
            { $sort: { value: -1 } },
            { $limit: 10 }
        ]);

        const categories = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$products" },
            { $lookup: { from: "products", localField: "products.productId", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $group: { _id: "$product.category", value: { $sum: "$products.quantity" } } },
            { $lookup: { from: "laptopcategories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: { name: "$category.name", value: 1 } },
            { $sort: { value: -1 } },
            { $limit: 10 }
        ]);

        res.json({ success: true, products, categories });
    } catch (error) {
        console.error("Error fetching top sellers:", error);
        res.status(500).json({ success: false, message: "Error fetching top sellers" });
    }
};

const getDetailedOrders = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid date range provided" });
        }

        const orders = await Order.find({
            orderDate: { $gte: start, $lte: end }
        }).populate('user', 'name email').lean();

        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        console.error("Error fetching detailed orders:", error);
        res.status(500).json({ success: false, message: "Error fetching detailed orders", error: error.message });
    }
};

module.exports = {
    pageerror,
    loadLogin,
    login,
    applyCouponToOrder,
    loadDashboard,
    logout,
    getSalesReport,
    downloadSalesReport,
    getTopSellers,
    getDetailedOrders
};