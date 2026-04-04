const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');

const INTER_FONT_HEAD =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />';


function createApp() {
  const app = express();
  app.get('/about', (req, res) => {
    res.render('about');
  });
  // Middleware to protect authenticated routes
  function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
      return next();
    }
    return res.redirect('/login');
  }

  app.engine('handlebars', engine({ defaultLayout: 'main' }));
  app.set('view engine', 'handlebars');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: 'archers-forum-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
  }));

  app.get('/', (req, res) => {
    res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    res.render('auth', {
      pageTitle: "Archer's Forum | Login",
      mode: 'login',
      isLogin: true,
      heading: 'Welcome Back',
      subtitle: 'Enter your email and password to login',
      submitLabel: 'Sign In',
      styles: ['/css/login_register.css'],
      scripts: ['/js/login_register.js'],
    });
  });

  app.get('/register', (req, res) => {
    res.render('auth', {
      pageTitle: "Archer's Forum | Register",
      mode: 'register',
      isRegister: true,
      heading: 'Create Account',
      subtitle: 'Enter your details to register',
      submitLabel: 'Register',
      styles: ['/css/login_register.css'],
      scripts: ['/js/login_register.js'],
    });
  });

  app.get('/mainpage', requireAuth, (req, res) => {
    res.render('mainpage', {
      pageTitle: "Archer's Forum | Main Page",
      pageHead: INTER_FONT_HEAD,
      styles: ['/css/main_page.css'],
      scripts: [
        '/js/storage.js',
        '/js/mainpage/utils.js',
        '/js/mainpage/ui.js',
        '/js/mainpage/history.js',
        '/js/mainpage/commentTree.js',
        '/js/mainpage/feedFilters.js',
        '/js/mainpage/reportModal.js',
        '/js/mainpage/detailRenderer.js',
        '/js/mainpage/feedRenderer.js',
        '/js/mainpage/eventBindings.js',
        '/js/mainpage.js',
      ],
    });
  });

  app.get('/profile', requireAuth, (req, res) => {
    res.render('profile', {
      pageTitle: 'My Profile - Archers Forum',
      pageHead: INTER_FONT_HEAD,
      styles: ['/css/main_page.css', '/css/profile.css'],
      scripts: ['/js/storage.js', '/js/mainpage/utils.js', '/js/profile.js'],
    });
  });

  app.get('/admin', requireAuth, (req, res) => {
    res.render('admin', {
      pageTitle: "Archer's Forum | Admin",
      pageHead: INTER_FONT_HEAD,
      styles: ['/css/main_page.css', '/css/admin.css'],
      scripts: ['/js/mainpage/utils.js', '/js/admin.js'],
    });
  });

  app.get('/bookmarks', requireAuth, (req, res) => {
    res.render('bookmarks', {
      pageTitle: "Archer's Forum | Bookmarks",
      pageHead: INTER_FONT_HEAD,
      styles: ['/css/main_page.css', '/css/admin.css', '/css/bookmarks.css'],
      scripts: ['/js/storage.js', '/js/bookmarks.js'],
    });
  });

  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth', authRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.get('*', (req, res) => {
    res.redirect('/login');
  });

  return app;
}

module.exports = {
  createApp,
};
