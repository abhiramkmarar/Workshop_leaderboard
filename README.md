# CTF Leaderboard Platform

A self-contained Node.js/Express CTF flag-submission and leaderboard app.
No database — everything persists to JSON files in the project root.

## Run it locally

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The server listens on `PORT` env var if set, otherwise `3000`.

## Accounts

- **Players**: register at `/register.html`, then log in at `/login.html`.
- **Admin**: hardcoded, not stored in `users.json`.
  - Username: `admin`
  - Password: `123AMMA`
  - Log in at the same `/login.html` form — you'll be routed to `/admin.html`.

## How the competition works

1. Admin logs in and clicks **Start Competition** on `/admin.html`. This sets a
   2h30m (9000 second) window in `competition.json`.
2. While the timer is running, logged-in players can submit flags from
   `/dashboard.html`. Correct/incorrect/duplicate results are all validated
   **server-side only** — the three flag values live in `flags.json` and are
   never sent to the browser.
3. The leaderboard (`/leaderboard.html`, and embedded in both dashboards)
   updates live over Socket.IO the instant anyone scores, no refresh needed.
4. Admin can **End Competition** early, **Reset Timer** (clears start/end
   without touching scores), **Reset All Scores** (zeroes every user's
   points/flags), or **Reset Submissions Log** (clears the audit trail in
   `submissions.json`).
5. Admin can also view/delete registered users and download the raw
   `users.json` / `submissions.json` / `competition.json` files.

## Data files

All persistent JSON files live in `data/` (never in `public/`, so they're
never reachable by a browser URL):

| File | Purpose |
|---|---|
| `data/users.json` | Registered players: bcrypt password hash, points, solved flags, last submission time |
| `data/submissions.json` | Append-only audit log of every correct solve, per user |
| `data/competition.json` | Timer state: running flag, start/end ISO timestamps, duration in seconds |
| `data/flags.json` | The three correct flag values and point values — server-side only, never exposed to any API response |

`store.js` creates the `data/` folder automatically on first write if it's missing.

## Project layout

```
server.js            Express app entry point, sessions, Socket.IO
store.js              JSON read/write helpers (all paths point into data/)
leaderboard.js        Sorting logic (points desc -> earliest timestamp -> username)
routes/auth.js         /register /login /logout /me
routes/api.js          /submitFlag /leaderboard /competition
routes/admin.js         /admin/* (all protected by admin session check)
public/                 Static frontend (dark hacker/CTF theme)
data/                    users.json, submissions.json, competition.json, flags.json
```

## Security notes

- Passwords are hashed with bcrypt (12 salt rounds) before being written to disk.
- Sessions use `express-session` with an httpOnly cookie.
- All flag comparisons happen in `routes/api.js` on the server; the client
  only ever sends a guess and receives `correct` / `incorrect` / `duplicate`.
- Admin routes (`/admin/*`) check `req.session.isAdmin` on every request.
- Usernames are restricted to `[A-Za-z0-9_-]{3,20}` to keep things simple and safe.
- For a real deployment, set `SESSION_SECRET` in the environment and serve
  over HTTPS.

## Deploying to Render (recommended, free tier available)

1. Push this project to a GitHub repo (Render deploys from Git).
2. Go to [render.com](https://render.com), sign up/log in, click **New +** → **Web Service**.
3. Connect your GitHub repo.
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free is fine for a workshop/CTF
5. Add an environment variable: `SESSION_SECRET` = any long random string.
6. Click **Create Web Service**. Render builds and starts it — you'll get a
   URL like `https://your-app.onrender.com`.

**Important caveat for the free tier:** Render's free instances spin down
after inactivity and lose any local disk changes on restart/redeploy —
so `data/*.json` (registered users, scores) can reset unexpectedly between
sessions. Fine for a short workshop; if you need scores to survive restarts
reliably, add a paid instance with a persistent disk, or point `store.js` at
a real database.

Railway and Fly.io work the same way in spirit (connect repo → set start
command to `npm start` → deploy) if you'd rather use one of those instead.

## Note on hosting

Since this app writes to local JSON files, it needs a **persistent filesystem**
and a **long-running process** — Vercel's serverless functions have neither
(each invocation is ephemeral and the filesystem is read-only outside `/tmp`).
Good options: Render, Railway, Fly.io, a small VPS, or your own machine — any
of these run `npm start` as a standard long-lived Node process. If you do
want it on Vercel later, swap the JSON read/writes in `store.js` for a real
database or a hosted key-value store (e.g. Vercel KV) — everything else in
the app stays the same, since all storage access goes through that one file.
# Workshop_leaderboard
# Workshop_leaderboard
# Workshop_leaderboard
