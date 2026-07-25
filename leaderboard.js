// leaderboard.js
// -----------------------------------------------------------------------
// Pure function that turns the raw users list into a sorted, ranked
// leaderboard. Sorting rules (in priority order):
//   1. Highest points first
//   2. Earlier "lastSubmission" timestamp ranks higher (finished sooner)
//   3. Username alphabetically as a final tiebreaker
// Users who have never submitted a flag (lastSubmission === null) are
// treated as "not yet finished" and sorted after anyone with a timestamp
// when points are tied.
// -----------------------------------------------------------------------

function buildLeaderboard(users) {
  const sorted = [...users].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    const aTime = a.lastSubmission ? new Date(a.lastSubmission).getTime() : Infinity;
    const bTime = b.lastSubmission ? new Date(b.lastSubmission).getTime() : Infinity;
    if (aTime !== bTime) return aTime - bTime;

    return a.username.localeCompare(b.username);
  });

  return sorted.map((u, idx) => ({
    rank: idx + 1,
    username: u.username,
    points: u.points,
    flagsSolved: u.flagsSolved,
    lastSubmission: u.lastSubmission,
  }));
}

module.exports = { buildLeaderboard };
