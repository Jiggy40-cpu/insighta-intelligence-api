import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './lib/db.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize database on startup (creates tables)
initializeDatabase().catch(err => console.error('DB init error:', err));

// Import handlers
import profilesHandler from './api/profiles.js';
import searchHandler from './api/search.js';

// Routes
app.get('/api/profiles', profilesHandler);
app.get('/api/profiles/search', searchHandler);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});