// frontend/js/dashboard.js
// Module 3 — Dashboard
// Fetches metrics and recent activity from the backend API and
// populates the existing prototype UI elements without altering markup.

import { apiFetch } from './api.js';

// ─── DOM references ───────────────────────────────────────────────────────────
const elTotalTasks      = document.getElementById('total-tasks');
const elCompletedTasks  = document.getElementById('completed-tasks');
const elPendingTasks    = document.getElementById('pending-tasks');
const elProgressPercent = document.getElementById('progress-percent');
const elProgressBar     = document.getElementById('progress-bar');
const elActivityFeed    = document.getElementById('activity-feed');

// ─── Metrics ──────────────────────────────────────────────────────────────────
async function loadMetrics() {
  try {
    const res = await apiFetch('/api/dashboard/metrics');
    if (!res.success) throw new Error(res.message);

    const { totalTasks, completedTasks, pendingTasks, progressPercent } = res.data;

    if (elTotalTasks)      elTotalTasks.textContent      = totalTasks;
    if (elCompletedTasks)  elCompletedTasks.textContent  = completedTasks;
    if (elPendingTasks)    elPendingTasks.textContent     = pendingTasks;
    if (elProgressPercent) elProgressPercent.textContent = `${progressPercent}%`;

    // Update progress bar width if the element uses a style-based bar
    if (elProgressBar) {
      elProgressBar.style.width = `${progressPercent}%`;
      elProgressBar.setAttribute('aria-valuenow', progressPercent);
    }
  } catch (err) {
    console.error('loadMetrics error:', err);
    showMetricsError();
  }
}

function showMetricsError() {
  [elTotalTasks, elCompletedTasks, elPendingTasks, elProgressPercent].forEach((el) => {
    if (el) el.textContent = '—';
  });
}

// ─── Activity feed ────────────────────────────────────────────────────────────
async function loadActivity() {
  if (!elActivityFeed) return;

  try {
    const res = await apiFetch('/api/dashboard/activity');
    if (!res.success) throw new Error(res.message);

    const activities = res.data;

    if (activities.length === 0) {
      elActivityFeed.innerHTML = '<li class="activity-empty">No recent activity.</li>';
      return;
    }

    elActivityFeed.innerHTML = activities
      .map((act) => buildActivityItem(act))
      .join('');
  } catch (err) {
    console.error('loadActivity error:', err);
    elActivityFeed.innerHTML = '<li class="activity-empty">Could not load activity.</li>';
  }
}

/**
 * Renders a single activity list item.
 * Matches the <li class="activity-item"> pattern used in the prototype.
 */
function buildActivityItem(act) {
  const timeStr = act.timestamp
    ? formatTimestamp(act.timestamp)
    : '';

  return `
    <li class="activity-item">
      <span class="activity-icon ${iconClass(act.type)}"></span>
      <div class="activity-details">
        <span class="activity-text">${escapeHtml(act.message || act.description || '')}</span>
        ${timeStr ? `<span class="activity-time">${timeStr}</span>` : ''}
      </div>
    </li>`.trim();
}

/** Maps an activity type string to a CSS modifier class for the icon. */
function iconClass(type) {
  const map = {
    task_created:   'activity-icon--created',
    task_updated:   'activity-icon--updated',
    task_completed: 'activity-icon--completed',
    task_deleted:   'activity-icon--deleted',
    member_added:   'activity-icon--member',
    comment:        'activity-icon--comment',
  };
  return map[type] || 'activity-icon--default';
}

/** Converts a Firestore Timestamp or ISO string to a readable relative time. */
function formatTimestamp(ts) {
  let date;
  if (ts && typeof ts.toDate === 'function') {
    date = ts.toDate();              // Firestore Timestamp object
  } else if (ts && ts._seconds) {
    date = new Date(ts._seconds * 1000); // serialised Firestore Timestamp
  } else {
    date = new Date(ts);
  }

  if (isNaN(date)) return '';

  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initDashboard() {
  await Promise.all([loadMetrics(), loadActivity()]);
}
