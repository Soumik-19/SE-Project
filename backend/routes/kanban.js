// backend/routes/kanban.js
// Module 4 — Kanban Board API Route
// Full CRUD for tasks with activity logging on every mutation.
// All writes also update the `activities` collection so the M3 dashboard feed stays live.

import express from 'express';
import { admin, db } from '../config/firebase-admin.js';
import { verifyToken } from '../middleware/auth.js'; // FIX: was missing

const router = express.Router(); // FIX: was missing

const TASKS_COL      = 'tasks';
const ACTIVITIES_COL = 'activities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Write one document to `activities`. Fire-and-forget — never blocks a response. */
async function logActivity({ type, message, userId, projectId, taskId = null }) {
  try {
    await db.collection(ACTIVITIES_COL).add({
      type,
      message,
      userId:    userId    || 'system',
      projectId: projectId || null,
      taskId:    taskId    || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('logActivity error:', err);
  }
}

/** Pull userId + projectId from request (header or body — flexible). */
function getContext(req) {
  return {
    userId:    req.user?.uid || req.headers['x-user-id'] || 'anonymous', // FIX: prefer verified uid
    projectId: req.headers['x-project-id'] || req.body?.projectId || null,
  };
}

// ─── GET /api/kanban/tasks ────────────────────────────────────────────────────
router.get('/tasks', verifyToken, async (req, res) => { // FIX: added verifyToken
  try {
    const { projectId } = req.query;
    let query = db.collection(TASKS_COL);
    if (projectId) query = query.where('projectId', '==', projectId);

    const snapshot = await query.orderBy('createdAt', 'asc').get();
    const tasks = [];
    snapshot.forEach((doc) => tasks.push({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('GET /kanban/tasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
});

// ─── POST /api/kanban/tasks ───────────────────────────────────────────────────
router.post('/tasks', verifyToken, async (req, res) => { // FIX: added verifyToken
  try {
    const {
      title,
      description  = '',
      status       = 'todo',
      priority     = 'medium',
      assigneeId   = null,
      assigneeName = null,
      projectId    = null,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const { userId } = getContext(req);

    const VALID_STATUSES   = ['todo', 'in-progress', 'review', 'done'];
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

    const taskData = {
      title:        title.trim(),
      description:  description.trim(),
      status:       VALID_STATUSES.includes(status)     ? status   : 'todo',
      priority:     VALID_PRIORITIES.includes(priority) ? priority : 'medium',
      assigneeId,
      assigneeName,
      projectId,
      createdBy:    userId,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(TASKS_COL).add(taskData);

    await logActivity({
      type:      'task_created',
      message:   `Task "${title.trim()}" was created`,
      userId,
      projectId,
      taskId:    docRef.id,
    });

    res.status(201).json({ success: true, data: { id: docRef.id, ...taskData } });
  } catch (error) {
    console.error('POST /kanban/tasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
});

// ─── PATCH /api/kanban/tasks/:id ─────────────────────────────────────────────
router.patch('/tasks/:id', verifyToken, async (req, res) => { // FIX: added verifyToken
  try {
    const { id } = req.params;
    const { userId, projectId } = getContext(req);

    const VALID_STATUSES   = ['todo', 'in-progress', 'review', 'done'];
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

    const docRef  = db.collection(TASKS_COL).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const existing = docSnap.data();
    const updates  = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let activityType    = 'task_updated';
    let activityMessage = `Task "${existing.title}" was updated`;

    if (req.body.title !== undefined) {
      updates.title = req.body.title.trim();
    }
    if (req.body.description !== undefined) {
      updates.description = req.body.description.trim();
    }
    if (req.body.status !== undefined && VALID_STATUSES.includes(req.body.status)) {
      updates.status = req.body.status;
      if (req.body.status === 'done') {
        activityType    = 'task_completed';
        activityMessage = `Task "${existing.title}" was marked as done`;
      } else {
        activityMessage = `Task "${existing.title}" moved to ${req.body.status}`;
      }
    }
    if (req.body.priority !== undefined && VALID_PRIORITIES.includes(req.body.priority)) {
      updates.priority = req.body.priority;
    }
    if (req.body.assigneeId !== undefined) {
      updates.assigneeId   = req.body.assigneeId;
      updates.assigneeName = req.body.assigneeName || null;
      activityMessage = `Task "${existing.title}" assigned to ${req.body.assigneeName || req.body.assigneeId}`;
    }

    await docRef.update(updates);

    await logActivity({
      type:      activityType,
      message:   activityMessage,
      userId,
      projectId: existing.projectId || projectId,
      taskId:    id,
    });

    res.json({ success: true, data: { id, ...existing, ...updates } });
  } catch (error) {
    console.error('PATCH /kanban/tasks/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
});

// ─── DELETE /api/kanban/tasks/:id ────────────────────────────────────────────
router.delete('/tasks/:id', verifyToken, async (req, res) => { // FIX: added verifyToken
  try {
    const { id } = req.params;
    const { userId, projectId } = getContext(req);

    const docRef  = db.collection(TASKS_COL).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const { title, projectId: taskProject } = docSnap.data();
    await docRef.delete();

    await logActivity({
      type:      'task_deleted',
      message:   `Task "${title}" was deleted`,
      userId,
      projectId: taskProject || projectId,
      taskId:    id,
    });

    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('DELETE /kanban/tasks/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

export default router;
