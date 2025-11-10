// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config(); // Load env variables early
const morgan = require('morgan');
const connectDb = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const flash = require('connect-flash');
const { errorHandler } = require('./middleware/errorHandler');
const { handleMulterError } = require('./config/multer');

// ✅ Connect to Database before starting the server
connectDb();

const app = express();
const port = process.env.PORT || 3000;

// Logger
app.use(morgan('dev'));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/admin'),
  path.join(__dirname, 'views/user'),
]);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/manifest.json', express.static(path.join(__dirname, 'public', 'manifest.json')));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// AJAX response helpers
app.use((req, res, next) => {
  if (req.xhr || req.headers.accept?.includes('json')) {
    res.error = (status, message) => res.status(status).json({ success: false, message });
    res.success = (data, message = 'Success') => res.json({ success: true, message, data });
  }
  next();
});

// ✅ Trust Vercel proxy for secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ✅ Session configuration (works on local + Vercel)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production', // only on HTTPS
    },
  })
);

// ✅ Passport + Flash
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// ✅ Global variables for all EJS templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// ✅ Optional route for testing session login state
app.get('/api/auth/me', (req, res) => {
  res.json({
    loggedIn: !!req.session.user || !!req.user,
    user: req.session.user || req.user || null,
  });
});

// Multer error handler
app.use(handleMulterError);

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// 404 handler
app.use((req, res) => {
  console.log(`404 Error: ${req.method} ${req.url}`);
  if (req.xhr || req.headers.accept?.includes('json')) {
    res.status(404).json({ success: false, message: 'API route not found' });
  } else {
    res.status(404).render('404', { title: 'Page Not Found' });
  }
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

module.exports = app;
