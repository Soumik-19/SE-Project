/**
 * server.js
 * ─────────
 * Express application entry point.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Route files
import authRouter from './routes/auth.js';
import kanbanRouter from './routes/kanban.js';
import requirementsRouter from './routes/requirements.js';
import cocomoRouter from './routes/cocomo.js';
import dashboardRouter from './routes/dashboard.js';

// Global error handler
import { errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ─────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://127.0.0.1:5500',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-project-id'
    ]
  })
);

// ── Rate limiting ───────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: true,
    message: 'Too many requests, please try again later.',
    code: 429,
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: true,
    message: 'Too many auth attempts, please try again later.',
    code: 429,
  },
});

app.use(globalLimiter);

// ── Body parsing ────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Request logging ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ──────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/kanban', kanbanRouter);
app.use('/api/requirements', requirementsRouter);
app.use('/api/cocomo', cocomoRouter);

// ── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found.',
    code: 404,
  });
});

// ── Global error handler ────────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n✅ SE Project Tool API running');
  console.log(`→ http://localhost:${PORT}`);
  console.log(`→ Health: http://localhost:${PORT}/health`);
  console.log(`→ Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;