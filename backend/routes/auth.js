// backend/routes/auth.js

import express from 'express';
import { admin, db } from '../config/firebase-admin.js';

const router = express.Router();

// POST /api/auth/sync — called after registration to store user profile
router.post('/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: true, message: 'No token provided.' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const { displayName, roll } = req.body;

    // FIX: role is never accepted from the client — all new users start as 'developer'.
    // Role elevation must be done server-side by an admin via a separate privileged endpoint.
    await db.collection('users').doc(decoded.uid).set({
      uid:         decoded.uid,
      email:       decoded.email,
      displayName: displayName || '',
      roll:        roll || '',
      role:        'developer', // FIX: was `role || 'developer'` — client could self-assign 'admin'
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Auth sync error:', err);
    res.status(500).json({ error: true, message: 'Auth sync failed.' });
  }
});

export default router;
