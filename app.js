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
  async function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
      try {
        // Check if user account is disabled
        const User = require('./model/User');
        const user = await User.findOne({ email: req.session.user.email });
        
        if (!user) {
          // User account no longer exists
          req.session.destroy();
          return res.redirect('/login');
        }
        
        if (user.isDisabled) {
          // User account is disabled
          req.session.destroy();
          return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Account Disabled - Archer's Forum</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                       text-align: center; padding: 60px 20px; background: #f8fafc; }
                .container { max-width: 400px; margin: 0 auto; 
                           background: white; padding: 40px; border-radius: 12px; 
                           box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                h1 { color: #dc2626; margin-bottom: 16px; }
                p { color: #64748b; margin-bottom: 24px; }
                a { display: inline-block; background: #16a34a; color: white; 
                    text-decoration: none; padding: 12px 24px; border-radius: 8px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Account Disabled</h1>
                <p>Your account has been disabled by an administrator. Please contact support if you believe this is an error.</p>
                <a href="/login">Return to Login</a>
              </div>
            </body>
            </html>
          `);
        }
        
        return next();
      } catch (err) {
        console.error('Auth middleware error:', err);
        return next();
      }
    }
    return res.redirect('/login');
  }

  app.engine('handlebars', engine({ defaultLayout: 'main' }));
  app.set('view engine', 'handlebars');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.json({ limit: '50mb' })); 
  app.use(express.urlencoded({ extended: true, limit: '50mb' })); 

  app.use(session({
    secret: 'archers-forum-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } 
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
        '/js/mainpage/userSearch.js',
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

  app.get('/profile', requireAuth, async (req, res) => {
    // Check if user is admin by looking up their role
    const userEmail = req.session?.user?.email;
    if (userEmail) {
      try {
        const User = require('./model/User');
        const user = await User.findOne({ email: userEmail });
        
        if (user && user.role === 'admin') {
          // Redirect admins to user management page
          return res.render('user-management', {
            pageTitle: 'User Management - Archers Forum',
            pageHead: INTER_FONT_HEAD,
            styles: ['/css/main_page.css', '/css/admin.css'],
            scripts: ['/js/storage.js', '/js/mainpage/utils.js', '/js/user-management.js'],
          });
        }
      } catch (err) {
        console.error('Error checking user role:', err);
      }
    }
    
    // Regular users get the profile page
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
