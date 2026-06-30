// backend/routes/dashboard.js
// Module 3 — Dashboard API Route
// Provides task metrics and recent activity feed from Firestore

import express from 'express';
import { admin, db } from '../config/firebase-admin.js';
import { verifyToken } from '../middleware/auth.js'; // FIX: was missing

const router = express.Router(); // FIX: was missing

// ─── GET /api/dashboard/metrics ──────────────────────────────────────────────
// Returns: totalTasks, completedTasks, pendingTasks, progressPercent
router.get('/metrics', verifyToken, async (req, res) => { // FIX: added verifyToken
  try {
    const tasksSnapshot = await db.collection('tasks').get();

    let totalTasks     = 0;
    let completedTasks = 0;
    let pendingTasks   = 0;

    tasksSnapshot.forEach((doc) => {
      const task = doc.data();
      totalTasks++;
      if (task.status === 'done') { // FIX: was 'completed' — kanban uses 'done'
        completedTasks++;
      } else {
        pendingTasks++;
      }
    });

    const progressPercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        pendingTasks,
        progressPercent,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch metrics' });
  }
});

// ─── GET /api/dashboard/activity ─────────────────────────────────────────────
// Returns: last 10 activity entries ordered by timestamp desc
router.get('/activity', verifyToken, async (req, res) => { // FIX: added verifyToken
  try {
    const activitySnapshot = await db
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const activities = [];
    activitySnapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
});

export default router; // FIX: was missing
