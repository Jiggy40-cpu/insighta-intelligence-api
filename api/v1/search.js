import express from 'express';
import cors from 'cors';
import { queryProfiles } from '../../lib/db-extended.js';
import { parseNaturalLanguageQuery } from '../../lib/parser.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();
router.use(cors());
router.use(express.json());

router.get('/', authenticateToken, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');

  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required' });
    }

    const filters = parseNaturalLanguageQuery(query);

    if (!filters) {
      return res.status(200).json({ status: 'error', message: 'Unable to interpret query' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (page < 1 || limit < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid pagination parameters' });
    }

    const sort = {
      by: 'created_at',
      order: 'desc',
    };

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
    console.error('Error in /api/v1/search:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

export default router;
