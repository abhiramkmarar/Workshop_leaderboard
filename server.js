// server.js
// -----------------------------------------------------------------------
// Entry point for the CTF Leaderboard platform.
// Wires up Express, sessions, Socket.IO (for live leaderboard updates),
// static file serving, and mounts the auth/api/admin route modules.
// -----------------------------------------------------------------------

const express = require('express');
const session = require('express-session');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ---- Middleware ----------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ctf-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 6, // 6 hours
    },
  })
);

// Make the Socket.IO instance available to route handlers via req.app.get('io')
app.set('io', io);

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// ---- Routes ---------------------------------------------------------------
app.use('/', authRoutes);      // /register /login /logout /me
app.use('/', apiRoutes);       // /submitFlag /leaderboard /competition
app.use('/admin', adminRoutes); // /admin/*

// Simple auth-gate helper for HTML pages that require a session.
function requirePageAuth(req, res, next) {
  if (!req.session || !req.session.username) {
    return res.redirect('/login.html');
  }
  next();
}
function requirePageAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect('/login.html');
  }
  next();
}

app.get('/dashboard.html', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/admin.html', requirePageAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---- Socket.IO -------------------------------------------------------------
io.on('connection', (socket) => {
  // Clients just listen for 'leaderboard:update' and 'competition:update'
  // events; no inbound events are required from the client side.
  socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
  console.log(`CTF Leaderboard server running at http://localhost:${PORT}`);
});
