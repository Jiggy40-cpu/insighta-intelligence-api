import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeExtendedDatabase } from './lib/db-extended.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/logging.js';
import authRouter from './api/v1/auth.js';
import profilesRouter from './api/v1/profiles.js';
import searchRouter from './api/v1/search.js';
import exportRouter from './api/v1/export.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(createRateLimiter());
app.use(requestLogger);

// Initialize database on startup
initializeExtendedDatabase().catch(err => console.error('DB init error:', err));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', version: '2.0.0' });
});

// API v1 Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/profiles', profilesRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/export', exportRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Insighta Labs+ API v2.0.0 running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1/docs`);
});
