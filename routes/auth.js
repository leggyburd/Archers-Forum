const express = require('express');
const router  = express.Router();
const User    = require('../model/User');
const bcrypt = require('bcryptjs');

// Register a new account
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'That email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role: 'user' });
    res.status(201).json({ name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Log in with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
    };
    res.json({ name: user.name, email: user.email, role: user.role || 'user', id: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
// Log out and destroy session
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});
});

module.exports = router;
