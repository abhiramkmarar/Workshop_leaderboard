// store.js
// -----------------------------------------------------------------------
// Small helper module that centralizes all reads/writes to the JSON
// "database" files. Using synchronous fs calls here is intentional:
// Node.js executes JS on a single thread, so sync calls cannot interleave
// with each other the way concurrent async calls could, which keeps our
// simple JSON-file storage free of race conditions for a CTF-scale
// number of concurrent users.
// -----------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  submissions: path.join(DATA_DIR, 'submissions.json'),
  competition: path.join(DATA_DIR, 'competition.json'),
  flags: path.join(DATA_DIR, 'flags.json'),
};

function readJSON(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    // If the file is missing or corrupt, fall back to a safe default
    // rather than crashing the whole server.
    return fallback;
  }
}

function writeJSON(filePath, data) {
  // Guard against a missing data/ directory (e.g. a fresh clone on a
  // host with an ephemeral filesystem) so writes don't crash the server.
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---- Users -------------------------------------------------------------
function getUsers() {
  return readJSON(FILES.users, []);
}
function saveUsers(users) {
  writeJSON(FILES.users, users);
}
function findUser(username) {
  const users = getUsers();
  return users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
}

// ---- Submissions log -----------------------------------------------------
function getSubmissions() {
  return readJSON(FILES.submissions, {});
}
function saveSubmissions(submissions) {
  writeJSON(FILES.submissions, submissions);
}

// ---- Competition state ---------------------------------------------------
function getCompetition() {
  return readJSON(FILES.competition, {
    running: false,
    startTime: null,
    endTime: null,
    duration: 9000,
  });
}
function saveCompetition(comp) {
  writeJSON(FILES.competition, comp);
}

// ---- Flags (server-side only, NEVER sent to any client) -----------------
function getFlags() {
  return readJSON(FILES.flags, []);
}

module.exports = {
  FILES,
  getUsers,
  saveUsers,
  findUser,
  getSubmissions,
  saveSubmissions,
  getCompetition,
  saveCompetition,
  getFlags,
};
