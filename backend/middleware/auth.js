import { admin, db } from '../config/firebase-admin.js';

// ── Verify Firebase ID token ──────────────────────────────────────────────
export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    // Fetch user profile from Firestore to get role
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const profile = userSnap.exists ? userSnap.data() : {};

    req.user = {
      uid:         decoded.uid,
      email:       decoded.email,
      role:        profile.role || 'developer',
      displayName: profile.displayName || decoded.email,
    };

    next();
  } catch (err) {
    console.error('verifyToken error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// ── Role guard ────────────────────────────────────────────────────────────
export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
}