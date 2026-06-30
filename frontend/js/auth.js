/**
 * auth.js
 * ───────
 * Client-side auth helpers shared across the whole app.
 *
 * Responsibilities:
 *   - requireAuth()      → redirect to login.html if not signed in
 *   - getCurrentUser()   → returns { uid, email, displayName, role, roll }
 *   - getIdToken()       → returns fresh Firebase ID token for API calls
 *   - logout()           → signs out and redirects to login.html
 *   - renderUserBar()    → populates the topbar user chip + logout button
 *
 * PLACEMENT: frontend/js/auth.js
 * IMPORTED BY: app.js (and indirectly used by every page module)
 */

import { auth, db }             from './firebase-config.js';
import { onAuthStateChanged,
         signOut }              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc }          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Internal state ────────────────────────────────────────────────────────
let _currentUser  = null;   // Firebase Auth user object
let _userProfile  = null;   // Firestore users/{uid} document data

// ── Role colour map (matches prototype palette) ───────────────────────────
const ROLE_STYLES = {
  admin:     { bg: '#FCEBEB', color: '#791F1F', label: 'Admin' },
  developer: { bg: '#E6F1FB', color: '#0C447C', label: 'Developer' },
  tester:    { bg: '#EAF3DE', color: '#27500A', label: 'Tester' },
};

// ─────────────────────────────────────────────────────────────────────────────
// requireAuth()
// Call at the top of every protected page's init.
// Resolves with { firebaseUser, profile } once auth state is confirmed.
// Redirects to login.html if no user is signed in.
// ─────────────────────────────────────────────────────────────────────────────
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      _currentUser = user;

      // Load Firestore profile (role, roll, displayName)
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        _userProfile = snap.exists() ? snap.data() : { role: 'developer', displayName: user.email };
      } catch (_) {
        _userProfile = { role: 'developer', displayName: user.email };
      }

      resolve({ firebaseUser: user, profile: _userProfile });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentUser()
// Returns the cached profile. Call after requireAuth() has resolved.
// ─────────────────────────────────────────────────────────────────────────────
export function getCurrentUser() {
  return _userProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// getIdToken()
// Fetches a fresh Firebase ID token (auto-refreshed every hour by SDK).
// Used by api.js to attach Authorization: Bearer <token> to every API call.
// ─────────────────────────────────────────────────────────────────────────────
export async function getIdToken() {
  if (!_currentUser) throw new Error('Not authenticated');
  return _currentUser.getIdToken(/* forceRefresh */ false);
}

// ─────────────────────────────────────────────────────────────────────────────
// logout()
// Signs out from Firebase, clears local state, redirects to login.
// ─────────────────────────────────────────────────────────────────────────────
export async function logout() {
  await signOut(auth);
  _currentUser = null;
  _userProfile = null;
  window.location.href = 'login.html';
}

// ─────────────────────────────────────────────────────────────────────────────
// hasRole(role)
// Convenience guard used by modules to conditionally show/hide edit controls.
// e.g. if (!hasRole('admin')) hideDeleteButtons();
// ─────────────────────────────────────────────────────────────────────────────
export function hasRole(...roles) {
  return roles.includes(_userProfile?.role);
}

// ─────────────────────────────────────────────────────────────────────────────
// renderUserBar(containerId)
// Injects a user chip + logout button into the topbar.
// containerId should match the id of the right-hand topbar div in index.html.
// ─────────────────────────────────────────────────────────────────────────────
export function renderUserBar(containerId = 'user-bar') {
  const container = document.getElementById(containerId);
  if (!container || !_userProfile) return;

  const style = ROLE_STYLES[_userProfile.role] || ROLE_STYLES.developer;
  const initials = (_userProfile.displayName || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:28px;height:28px;border-radius:50%;
                  background:${style.bg};color:${style.color};
                  display:flex;align-items:center;justify-content:center;
                  font-size:11px;font-weight:700;">
        ${initials}
      </div>
      <div style="line-height:1.3;">
        <div style="font-size:13px;font-weight:500;">${_userProfile.displayName || _userProfile.email}</div>
        <div style="font-size:10px;padding:1px 7px;border-radius:20px;
                    background:${style.bg};color:${style.color};
                    display:inline-block;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.04em;">
          ${style.label}
        </div>
      </div>
      <button onclick="window.__logout()"
              style="margin-left:4px;padding:5px 10px;border-radius:6px;
                     font-size:12px;cursor:pointer;border:1px solid #e0e0e0;
                     background:#fff;color:#666;transition:all 0.15s;"
              onmouseover="this.style.background='#f0f0f0'"
              onmouseout="this.style.background='#fff'">
        Sign out
      </button>
    </div>`;

  // Expose logout globally so the inline onclick above can reach it
  window.__logout = logout;
}
