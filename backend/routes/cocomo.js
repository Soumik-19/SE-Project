// backend/routes/cocomo.js
// Mount in server.js: app.use('/api/cocomo', cocomoRouter);

import express from 'express';
import { admin, db } from '../config/firebase-admin.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router(); // FIX: was missing

// ─── Basic COCOMO Constants ───────────────────────────────────────────────────
// Project Type → { a, b, c, d }
// Effort   (person-months) = a * (KLOC ^ b)
// Duration (months)        = c * (Effort ^ d)
// Staffing (persons)       = Effort / Duration
const COCOMO_COEFFICIENTS = {
  organic:      { a: 2.4, b: 1.05, c: 2.5, d: 0.38 },
  semidetached: { a: 3.0, b: 1.12, c: 2.5, d: 0.35 },
  embedded:     { a: 3.6, b: 1.20, c: 2.5, d: 0.32 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeCocomo(kloc, projectType) {
  const coeff = COCOMO_COEFFICIENTS[projectType];
  if (!coeff) return null;

  const effort   = parseFloat((coeff.a * Math.pow(kloc, coeff.b)).toFixed(2));
  const duration = parseFloat((coeff.c * Math.pow(effort, coeff.d)).toFixed(2));
  const staffing = parseFloat((effort / duration).toFixed(2));

  return { effort, duration, staffing };
}

async function logActivity(userId, action, details) {
  try {
    await db.collection('activityLogs').add({
      userId,
      action,
      details,
      module: 'cocomo',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

// ─── POST /api/cocomo/estimate ────────────────────────────────────────────────
router.post('/estimate', verifyToken, requireRole(['admin', 'manager', 'member']), async (req, res) => {
  try {
    const { kloc, projectType, teamSize, projectId, label } = req.body;

    if (!kloc || !projectType || !teamSize) {
      return res.status(400).json({ success: false, message: 'kloc, projectType, and teamSize are required.' });
    }

    const klocNum     = parseFloat(kloc);
    const teamSizeNum = parseInt(teamSize, 10);

    if (isNaN(klocNum) || klocNum <= 0) {
      return res.status(400).json({ success: false, message: 'kloc must be a positive number.' });
    }
    if (!COCOMO_COEFFICIENTS[projectType]) {
      return res.status(400).json({ success: false, message: `projectType must be one of: ${Object.keys(COCOMO_COEFFICIENTS).join(', ')}.` });
    }
    if (isNaN(teamSizeNum) || teamSizeNum <= 0) {
      return res.status(400).json({ success: false, message: 'teamSize must be a positive integer.' });
    }

    const result = computeCocomo(klocNum, projectType);

    const docRef = await db.collection('cocomoEstimations').add({
      userId:      req.user.uid,
      projectId:   projectId || null,
      label:       label || null,
      kloc:        klocNum,
      projectType,
      teamSize:    teamSizeNum,
      effort:      result.effort,
      duration:    result.duration,
      staffing:    result.staffing,
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    await logActivity(req.user.uid, 'COCOMO_ESTIMATE_CREATED', {
      estimationId: docRef.id,
      kloc: klocNum,
      projectType,
      teamSize: teamSizeNum,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: docRef.id,
        kloc: klocNum,
        projectType,
        teamSize: teamSizeNum,
        effort:   result.effort,
        duration: result.duration,
        staffing: result.staffing,
      },
    });
  } catch (err) {
    console.error('COCOMO estimate error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/cocomo/history ──────────────────────────────────────────────────
// admin/manager → all records; member → own records only
router.get('/history', verifyToken, requireRole(['admin', 'manager', 'member']), async (req, res) => {
  try {
    const { projectId, limit = 20 } = req.query;
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);

    let query = db.collection('cocomoEstimations').orderBy('createdAt', 'desc');

    if (!isPrivileged) {
      query = query.where('userId', '==', req.user.uid);
    }
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }

    query = query.limit(parseInt(limit, 10));

    const snapshot = await query.get();
    const estimations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, data: estimations });
  } catch (err) {
    console.error('COCOMO history error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/cocomo/history/:id ─────────────────────────────────────────────
router.get('/history/:id', verifyToken, requireRole(['admin', 'manager', 'member']), async (req, res) => {
  try {
    const doc = await db.collection('cocomoEstimations').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Estimation not found.' });
    }

    const data = doc.data();
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);

    if (!isPrivileged && data.userId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: { id: doc.id, ...data } });
  } catch (err) {
    console.error('COCOMO fetch error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── DELETE /api/cocomo/history/:id ──────────────────────────────────────────
// admin/manager only
router.delete('/history/:id', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const doc = await db.collection('cocomoEstimations').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Estimation not found.' });
    }

    await db.collection('cocomoEstimations').doc(req.params.id).delete();

    await logActivity(req.user.uid, 'COCOMO_ESTIMATE_DELETED', { estimationId: req.params.id });

    return res.status(200).json({ success: true, data: { message: 'Estimation deleted.' } });
  } catch (err) {
    console.error('COCOMO delete error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

export default router;
