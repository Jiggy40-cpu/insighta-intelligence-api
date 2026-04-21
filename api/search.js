import express from 'express';
import cors from 'cors';
import { queryProfiles } from '../lib/db.js';
import { parseNaturalLanguageQuery } from '../lib/parser.js';

const app = express();
app.use(cors());
app.use(express.json());

const handler = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required' });
    }

    // Parse natural language query
    const filters = parseNaturalLanguageQuery(query);

    if (!filters) {
      return res.status(200).json({ status: 'error', message: 'Unable to interpret query' });
    }

    // Validate pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (page < 1 || limit < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid pagination parameters' });
    }

    // Default sort
    const sort = {
      by: 'created_at',
      order: 'desc',
    };

    // Query database
    const result = await queryProfiles(filters, sort, { page, limit });

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total: result.total,
      data: result.data,
      query,
      parsedFilters: filters,
    });
  } catch (error) {
    console.error('Error in /api/search:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export default handler;