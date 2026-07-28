// routes/api.js
// -----------------------------------------------------------------------
// Core gameplay routes available to logged-in regular users:
//   POST /submitFlag  - validate & score a flag submission
//   GET  /leaderboard - public (to logged-in users) ranked scoreboard
//   GET  /competition - current timer state
//   GET  /downloads    - list challenge APKs
//   GET  /download/:filename - serve a single challenge APK
//
// IMPORTANT: flags.json is only ever read on the server. Its contents
// are never sent to the client in any response.
// -----------------------------------------------------------------------

const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  getUsers,
  saveUsers,
  getSubmissions,
  saveSubmissions,
  getCompetition,
  getFlags,
} = require('../store');
const { buildLeaderboard } = require('../leaderboard');

const router = express.Router();

// Challenge APKs live outside of /public so they can never be fetched
// anonymously by a direct URL - only through the routes below, which
// require a logged-in session.
const CHALLENGES_DIR = path.join(__dirname, '..', 'challenges');
const CHALLENGES_MANIFEST = path.join(CHALLENGES_DIR, 'manifest.json');

function getChallengeManifest() {
  try {
    return JSON.parse(fs.readFileSync(CHALLENGES_MANIFEST, 'utf-8'));
  } catch (err) {
    return [];
  }
}

// Require any logged-in user (admin or regular) for read-only routes,
// but flag submission is only meaningful for regular (non-admin) users.
function requireLogin(req, res, next) {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ error: 'You must be logged in.' });
  }
  next();
}

function competitionStatus() {
  const comp = getCompetition();
  if (!comp.running || !comp.startTime || !comp.endTime) {
    return { ...comp, active: false };
  }
  const now = Date.now();
  const end = new Date(comp.endTime).getTime();
  const active = now < end;
  return { ...comp, active };
}

// GET /competition - anyone logged in can check the timer
router.get('/competition', requireLogin, (req, res) => {
  const status = competitionStatus();
  res.json({
    running: status.running,
    active: status.active,
    startTime: status.startTime,
    endTime: status.endTime,
    duration: status.duration,
    serverTime: new Date().toISOString(),
  });
});

// GET /leaderboard
router.get('/leaderboard', requireLogin, (req, res) => {
  const users = getUsers();
  res.json({ leaderboard: buildLeaderboard(users) });
});

// POST /submitFlag
router.post('/submitFlag', requireLogin, (req, res) => {
  if (req.session.isAdmin) {
    return res.status(403).json({ error: 'Admin accounts cannot submit flags.' });
  }

  const status = competitionStatus();
  if (!status.running) {
    return res.status(403).json({ error: 'Competition has not started yet.' });
  }
  if (!status.active) {
    return res.status(403).json({ error: 'Competition has ended. Flag submissions are closed.' });
  }

  const submitted = typeof req.body.flag === 'string' ? req.body.flag.trim() : '';
  if (!submitted) {
    return res.status(400).json({ error: 'Please enter a flag.' });
  }

  const flags = getFlags();
  const matchedFlag = flags.find((f) => f.value === submitted);

  if (!matchedFlag) {
    return res.json({ result: 'incorrect', message: 'Incorrect flag.' });
  }

  const users = getUsers();
  const userIndex = users.findIndex(
    (u) => u.username.toLowerCase() === req.session.username.toLowerCase()
  );
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const user = users[userIndex];

  if (user.flagsSolved.includes(matchedFlag.name)) {
    return res.json({ result: 'duplicate', message: 'Flag already submitted.' });
  }

  const now = new Date().toISOString();
  user.flagsSolved.push(matchedFlag.name);
  user.points += matchedFlag.points;
  user.lastSubmission = now;
  users[userIndex] = user;
  saveUsers(users);

  // Append to the submissions audit log as well.
  const submissions = getSubmissions();
  if (!submissions[user.username]) {
    submissions[user.username] = { flags: [], points: 0 };
  }
  submissions[user.username].flags.push({ name: matchedFlag.name, submittedAt: now });
  submissions[user.username].points = user.points;
  saveSubmissions(submissions);

  // Notify all connected clients so the leaderboard updates live.
  const io = req.app.get('io');
  if (io) {
    io.emit('leaderboard:update', { leaderboard: buildLeaderboard(getUsers()) });
  }

  return res.json({
    result: 'correct',
    message: `Correct! You earned ${matchedFlag.points} points.`,
    points: user.points,
    flagsSolved: user.flagsSolved,
  });
});

// GET /downloads - list available challenge files (name + label only)
router.get('/downloads', requireLogin, (req, res) => {
  const manifest = getChallengeManifest();
  res.json({
    challenges: manifest.map((c) => ({
      filename: c.filename,
      label: c.label,
      description: c.description,
    })),
  });
});

// GET /download/:filename - serve one challenge APK, logged-in users only
router.get('/download/:filename', requireLogin, (req, res) => {
  const manifest = getChallengeManifest();
  // Only allow filenames that are explicitly listed in the manifest -
  // this blocks path traversal (e.g. "../server.js") and stops anyone
  // from requesting arbitrary files off the server's disk.
  const requested = path.basename(req.params.filename);
  const entry = manifest.find((c) => c.filename === requested);
  if (!entry) {
    return res.status(404).json({ error: 'No such challenge file.' });
  }

  const filePath = path.join(CHALLENGES_DIR, entry.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server.' });
  }

  res.download(filePath, entry.filename);
});

module.exports = router;
