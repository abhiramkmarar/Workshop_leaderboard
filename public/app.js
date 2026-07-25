// app.js
// -----------------------------------------------------------------------
// Shared client-side helpers used across every page: a tiny fetch wrapper,
// the live countdown timer, and the socket.io connection used for
// realtime leaderboard updates without page refreshes.
// -----------------------------------------------------------------------

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = `msg show ${kind}`;
}

// ---- Countdown timer --------------------------------------------------
// Renders into any element with id="countdown" and id="countdown-status".
// Pulls /competition once, then ticks locally using the server-provided
// start/end times so the display doesn't depend on repeated polling.
let countdownInterval = null;

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

async function initCountdown() {
  const el = document.getElementById('countdown');
  const statusEl = document.getElementById('countdown-status');
  if (!el) return;

  async function refresh() {
    try {
      const comp = await api('/competition');
      if (countdownInterval) clearInterval(countdownInterval);

      if (!comp.running) {
        el.textContent = '00:00:00';
        el.classList.remove('ended');
        if (statusEl) statusEl.textContent = 'Competition has not started yet.';
        return;
      }

      const endTime = new Date(comp.endTime).getTime();

      function tick() {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          el.textContent = '00:00:00';
          el.classList.add('ended');
          if (statusEl) statusEl.textContent = 'Competition has ended. Flag submissions are closed.';
          clearInterval(countdownInterval);
          return;
        }
        el.textContent = formatDuration(remaining);
        if (statusEl) statusEl.textContent = 'Competition is live — go get those flags.';
      }

      tick();
      countdownInterval = setInterval(tick, 1000);
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Could not load competition status.';
    }
  }

  refresh();
  // Re-sync with the server periodically in case admin starts/ends it
  // while we're sitting on this page.
  setInterval(refresh, 15000);
}

// ---- Live leaderboard via Socket.IO -------------------------------------
function connectLeaderboardSocket(onUpdate) {
  if (typeof io === 'undefined') return null;
  const socket = io();
  socket.on('leaderboard:update', (payload) => onUpdate(payload.leaderboard));
  return socket;
}

function renderLeaderboardRows(tbody, leaderboard) {
  tbody.innerHTML = '';
  leaderboard.forEach((row) => {
    const tr = document.createElement('tr');
    const rankClass = row.rank === 1 ? 'rank-1' : row.rank === 2 ? 'rank-2' : row.rank === 3 ? 'rank-3' : '';
    const flagsHtml = row.flagsSolved.length
      ? row.flagsSolved.map((f) => `<span class="flag-pill">${escapeHtml(f)}</span>`).join('')
      : '<span style="color:var(--text-dim)">—</span>';
    const lastSub = row.lastSubmission ? new Date(row.lastSubmission).toLocaleString() : '—';
    tr.innerHTML = `
      <td class="${rankClass}">#${row.rank}</td>
      <td>${escapeHtml(row.username)}</td>
      <td>${row.points}</td>
      <td>${flagsHtml}</td>
      <td>${lastSub}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadLeaderboardOnce(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  try {
    const data = await api('/leaderboard');
    renderLeaderboardRows(tbody, data.leaderboard);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Could not load leaderboard.</td></tr>`;
  }
}
