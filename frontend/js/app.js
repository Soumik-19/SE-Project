/**
 * app.js
 * ──────
 * Main application bootstrap — the entry point for index.html.
 *
 * Responsibilities:
 *   1. Auth guard: redirect to login.html if not signed in
 *   2. Render the user bar in the topbar
 *   3. Wire sidebar navigation (showPage)
 *   4. Lazy-initialise each page module on first visit
 *   5. Expose global helpers used by inline HTML onclick=""
 *
 * PLACEMENT: frontend/js/app.js
 * LOADED BY: index.html as <script type="module" src="js/app.js">
 */

import { requireAuth, renderUserBar, hasRole } from './auth.js';
import { initDashboard }     from './dashboard.js';
import { initKanban }        from './kanban.js';
import { initRequirements }  from './requirements.js';
import { initCocomo }        from './cocomo.js';
import { initTesting }       from './testing.js';
import { initTeam }          from './team.js';

// Track which pages have been initialised (lazy load)
const initialised = new Set();

// ── Boot ──────────────────────────────────────────────────────────────────
const { profile } = await requireAuth();
renderUserBar('user-bar');
applyRolePermissions(profile.role);

// Show the default page
showPage('dashboard', document.getElementById('nav-dashboard'));

// ── Page router ───────────────────────────────────────────────────────────
window.showPage = function(pageId, navEl) {
  // Deactivate all pages and nav items
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate selected
  document.getElementById('page-' + pageId)?.classList.add('active');
  navEl?.classList.add('active');

  // Update topbar breadcrumb title
  const titles = {
    dashboard:    'Dashboard',
    kanban:       'Kanban Board',
    requirements: 'Requirements',
    design:       'Design & Architecture',
    cocomo:       'Cost Estimator (COCOMO)',
    testing:      'Testing & QA',
    team:         'Team Members',
  };
  const h1 = document.querySelector('.topbar-left h1');
  if (h1) h1.textContent = titles[pageId] || pageId;

  // Lazy-init each module once
  if (!initialised.has(pageId)) {
    initialised.add(pageId);
    switch (pageId) {
      case 'dashboard':    initDashboard();    break;
      case 'kanban':       initKanban();       break;
      case 'requirements': initRequirements(); break;
      case 'cocomo':       initCocomo();       break;
      case 'testing':      initTesting();      break;
      case 'team':         initTeam();         break;
    }
  }
};

// ── Requirements tab switcher (shared helper for index.html) ──────────────
window.showReqTab = function(tab, el) {
  ['functional', 'nonfunctional', 'feasibility'].forEach(t => {
    const panel = document.getElementById('req-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#page-requirements .tab')
    .forEach(t => t.classList.remove('active'));
  el?.classList.add('active');
};

// ── Role-based UI permissions ─────────────────────────────────────────────
function applyRolePermissions(role) {
  // Testers cannot see Cost Estimator nav item
  if (role === 'tester') {
    document.getElementById('nav-cocomo')?.style.setProperty('display', 'none');
  }
  // Only admins see the full Team edit controls (handled per module)
}
