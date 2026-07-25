// routes/auth.js
// -----------------------------------------------------------------------
// Handles user registration, login, and logout.
// Passwords are always hashed with bcrypt before being written to disk.
// The hardcoded admin account is authenticated separately in this same
// file's /login handler and is never written to users.json.
// -----------------------------------------------------------------------

const express = require('express');
const bcrypt = require('bcrypt');
const { getUsers, saveUsers, findUser } = require('../store');

const router = express.Router();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123AMMA';
const SALT_ROUNDS = 12;

// Only allow simple, safe usernames: letters, numbers, underscore, dash.
const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,20}$/;

function sanitizeUsername(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

// POST /register
router.post('/register', async (req, res) => {
  const username = sanitizeUsername(req.body.username);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, or dashes.',
    });
  }
  if (username.toLowerCase() === ADMIN_USERNAME) {
    return res.status(400).json({ error: 'That username is reserved.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const users = getUsers();
  if (findUser(username)) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const newUser = {
    username,
    passwordHash,
    registeredAt: new Date().toISOString(),
    points: 0,
    flagsSolved: [],
    lastSubmission: null,
  };

  users.push(newUser);
  saveUsers(users);

  return res.status(201).json({ message: 'Registration successful. You can now log in.' });
});

// POST /login
router.post('/login', async (req, res) => {
  const username = sanitizeUsername(req.body.username);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Check hardcoded admin credentials first. Admin is NOT in users.json.
  if (username.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.username = ADMIN_USERNAME;
    return res.json({ message: 'Admin login successful.', isAdmin: true, username: ADMIN_USERNAME });
  }

  const user = findUser(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.isAdmin = false;
  req.session.username = user.username;

  return res.json({ message: 'Login successful.', isAdmin: false, username: user.username });
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out, please try again.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out.' });
  });
});

// GET /me - lets the frontend know who (if anyone) is logged in
router.get('/me', (req, res) => {
  if (req.session && req.session.username) {
    return res.json({ username: req.session.username, isAdmin: !!req.session.isAdmin });
  }
  return res.status(401).json({ error: 'Not logged in.' });
});

module.exports = router;
