// routes/admin.js
// -----------------------------------------------------------------------
// All routes here are protected by requireAdmin and are only usable by
// the hardcoded admin session (see routes/auth.js for the admin login).
// -----------------------------------------------------------------------

const express = require('express');
const path = require('path');
const {
  getUsers,
  saveUsers,
  getSubmissions,
  saveSubmissions,
  getCompetition,
  saveCompetition,
  FILES,
} = require('../store');
const { buildLeaderboard } = require('../leaderboard');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

router.use(requireAdmin);

function broadcastLeaderboard(req) {
  const io = req.app.get('io');
  if (io) {
    io.emit('leaderboard:update', { leaderboard: buildLeaderboard(getUsers()) });
  }
}

function broadcastCompetition(req) {
  const io = req.app.get('io');
  if (io) {
    io.emit('competition:update', getCompetition());
  }
}

// POST /admin/start
router.post('/start', (req, res) => {
  const comp = getCompetition();
  const now = Date.now();
  const duration = comp.duration || 9000; // seconds (2h30m default)

  const updated = {
    running: true,
    startTime: new Date(now).toISOString(),
    endTime: new Date(now + duration * 1000).toISOString(),
    duration,
  };
  saveCompetition(updated);
  broadcastCompetition(req);
  res.json({ message: 'Competition started.', competition: updated });
});

// POST /admin/end
router.post('/end', (req, res) => {
  const comp = getCompetition();
  const updated = { ...comp, running: false, endTime: new Date().toISOString() };
  saveCompetition(updated);
  broadcastCompetition(req);
  res.json({ message: 'Competition ended.', competition: updated });
});

// POST /admin/reset - resets the timer only (not scores)
router.post('/reset', (req, res) => {
  const updated = { running: false, startTime: null, endTime: null, duration: 9000 };
  saveCompetition(updated);
  broadcastCompetition(req);
  res.json({ message: 'Competition timer reset.', competition: updated });
});

// POST /admin/resetScores - zero out every user's points/flags
router.post('/resetScores', (req, res) => {
  const users = getUsers().map((u) => ({
    ...u,
    points: 0,
    flagsSolved: [],
    lastSubmission: null,
  }));
  saveUsers(users);
  broadcastLeaderboard(req);
  res.json({ message: 'All scores reset.' });
});

// POST /admin/resetSubmissions - clear the submissions audit log only
router.post('/resetSubmissions', (req, res) => {
  saveSubmissions({});
  res.json({ message: 'Submissions log cleared.' });
});

// GET /admin/users - list all registered (non-admin) users
router.get('/users', (req, res) => {
  const users = getUsers().map((u) => ({
    username: u.username,
    registeredAt: u.registeredAt,
    points: u.points,
    flagsSolved: u.flagsSolved,
    lastSubmission: u.lastSubmission,
  }));
  res.json({ users });
});

// DELETE /admin/user/:username
router.delete('/user/:username', (req, res) => {
  const target = req.params.username.toLowerCase();
  const users = getUsers();
  const filtered = users.filter((u) => u.username.toLowerCase() !== target);

  if (filtered.length === users.length) {
    return res.status(404).json({ error: 'User not found.' });
  }

  saveUsers(filtered);

  const submissions = getSubmissions();
  delete submissions[req.params.username];
  saveSubmissions(submissions);

  broadcastLeaderboard(req);
  res.json({ message: `User "${req.params.username}" deleted.` });
});

// GET /admin/download/:file - download a raw JSON data file
const DOWNLOADABLE = {
  users: FILES.users,
  submissions: FILES.submissions,
  competition: FILES.competition,
  flags: FILES.flags,
};

router.get('/download/:file', (req, res) => {
  const key = req.params.file;
  const filePath = DOWNLOADABLE[key];
  if (!filePath) {
    return res.status(404).json({ error: 'Unknown file. Valid options: users, submissions, competition, flags.' });
  }
  res.download(filePath, path.basename(filePath));
});

module.exports = router;
