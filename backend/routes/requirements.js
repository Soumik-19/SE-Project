// backend/routes/requirements.js

import express from 'express';
import { admin, db } from '../config/firebase-admin.js';
import { verifyToken, requireRole } from '../middleware/auth.js'; // FIX: import from shared middleware

const router = express.Router(); // FIX: was missing

const COLLECTION = 'requirements';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function logActivity(projectId, userId, action, detail) {
  try {
    await db.collection('activity_logs').add({
      projectId,
      userId,
      action,
      detail,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Activity log error:', err);
  }
}

// ─── GET /api/requirements/:projectId ───────────────────────────────────────
// FIX: added verifyToken — was completely unauthenticated
router.get('/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type } = req.query;

    let query = db
      .collection(COLLECTION)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'asc');

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    const requirements = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, data: requirements });
  } catch (err) {
    console.error('GET requirements error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch requirements.' });
  }
});

// ─── GET /api/requirements/:projectId/:requirementId ────────────────────────
// FIX: added verifyToken — was completely unauthenticated
router.get('/:projectId/:requirementId', verifyToken, async (req, res) => {
  try {
    const { projectId, requirementId } = req.params;
    const doc = await db.collection(COLLECTION).doc(requirementId).get();

    if (!doc.exists || doc.data().projectId !== projectId) {
      return res.status(404).json({ success: false, message: 'Requirement not found.' });
    }

    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error('GET requirement error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch requirement.' });
  }
});

// ─── POST /api/requirements/:projectId ──────────────────────────────────────
// FIX: added verifyToken before requireRole so req.user is populated
router.post(
  '/:projectId',
  verifyToken,
  requireRole(['admin', 'manager', 'member']),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const {
        type,
        title,
        description,
        priority,
        status,
        feasibilityCategory,
        score,
        notes,
      } = req.body;

      if (!type || !title) {
        return res
          .status(400)
          .json({ success: false, message: 'type and title are required.' });
      }

      const validTypes = ['functional', 'non_functional', 'feasibility'];
      if (!validTypes.includes(type)) {
        return res
          .status(400)
          .json({ success: false, message: `type must be one of: ${validTypes.join(', ')}.` });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      const payload = {
        projectId,
        type,
        title:       title.trim(),
        description: description?.trim() || '',
        priority:    priority || 'medium',
        status:      status || 'draft',
        createdBy:   req.user.uid,
        createdAt:   now,
        updatedAt:   now,
      };

      if (type === 'feasibility') {
        payload.feasibilityCategory = feasibilityCategory || 'technical';
        payload.score = typeof score === 'number' ? score : null;
        payload.notes = notes?.trim() || '';
      }

      const docRef = await db.collection(COLLECTION).add(payload);

      await logActivity(
        projectId,
        req.user.uid,
        'REQUIREMENT_CREATED',
        `Created ${type} requirement: "${title}"`
      );

      res.status(201).json({ success: true, data: { id: docRef.id, ...payload } });
    } catch (err) {
      console.error('POST requirement error:', err);
      res.status(500).json({ success: false, message: 'Failed to create requirement.' });
    }
  }
);

// ─── PUT /api/requirements/:projectId/:requirementId ────────────────────────
// FIX: added verifyToken before requireRole so req.user is populated
router.put(
  '/:projectId/:requirementId',
  verifyToken,
  requireRole(['admin', 'manager', 'member']),
  async (req, res) => {
    try {
      const { projectId, requirementId } = req.params;

      const docRef = db.collection(COLLECTION).doc(requirementId);
      const doc = await docRef.get();

      if (!doc.exists || doc.data().projectId !== projectId) {
        return res.status(404).json({ success: false, message: 'Requirement not found.' });
      }

      const existing = doc.data();

      if (
        ['approved', 'rejected'].includes(req.body.status) &&
        !['admin', 'manager'].includes(req.user?.role)
      ) {
        return res
          .status(403)
          .json({ success: false, message: 'Only managers or admins can approve/reject requirements.' });
      }

      const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const editableFields = [
        'title',
        'description',
        'priority',
        'status',
        'feasibilityCategory',
        'score',
        'notes',
      ];

      editableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] =
            typeof req.body[field] === 'string'
              ? req.body[field].trim()
              : req.body[field];
        }
      });

      await docRef.update(updates);

      await logActivity(
        projectId,
        req.user.uid,
        'REQUIREMENT_UPDATED',
        `Updated ${existing.type} requirement: "${existing.title}"`
      );

      const updated = await docRef.get();
      res.json({ success: true, data: { id: updated.id, ...updated.data() } });
    } catch (err) {
      console.error('PUT requirement error:', err);
      res.status(500).json({ success: false, message: 'Failed to update requirement.' });
    }
  }
);

// ─── DELETE /api/requirements/:projectId/:requirementId ─────────────────────
// FIX: added verifyToken before requireRole so req.user is populated
router.delete(
  '/:projectId/:requirementId',
  verifyToken,
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const { projectId, requirementId } = req.params;

      const docRef = db.collection(COLLECTION).doc(requirementId);
      const doc = await docRef.get();

      if (!doc.exists || doc.data().projectId !== projectId) {
        return res.status(404).json({ success: false, message: 'Requirement not found.' });
      }

      const { title, type } = doc.data();
      await docRef.delete();

      await logActivity(
        projectId,
        req.user.uid,
        'REQUIREMENT_DELETED',
        `Deleted ${type} requirement: "${title}"`
      );

      res.json({ success: true, data: { id: requirementId } });
    } catch (err) {
      console.error('DELETE requirement error:', err);
      res.status(500).json({ success: false, message: 'Failed to delete requirement.' });
    }
  }
);

export default router;
