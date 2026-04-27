import express from 'express';
import cors from 'cors';
import { queryProfiles } from '../../lib/db-extended.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();
router.use(cors());
router.use(express.json());

router.get('/', authenticateToken, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (page < 1 || limit < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid pagination parameters' });
    }

    const filters = {};

    if (req.query.gender && ['male', 'female'].includes(req.query.gender)) {
      filters.gender = req.query.gender;
    }

    if (req.query.age_group && ['child', 'teenager', 'adult', 'senior'].includes(req.query.age_group)) {
      filters.age_group = req.query.age_group;
    }

    if (req.query.country_id) {
      filters.country_id = req.query.country_id.toUpperCase();
    }

    if (req.query.min_age) {
      const minAge = parseInt(req.query.min_age);
      if (!isNaN(minAge)) filters.min_age = minAge;
    }

    if (req.query.max_age) {
      const maxAge = parseInt(req.query.max_age);
      if (!isNaN(maxAge)) filters.max_age = maxAge;
    }

    if (req.query.min_gender_probability) {
      const minProb = parseFloat(req.query.min_gender_probability);
      if (!isNaN(minProb) && minProb >= 0 && minProb <= 1) {
        filters.min_gender_probability = minProb;
      }
    }

    if (req.query.min_country_probability) {
      const minProb = parseFloat(req.query.min_country_probability);
      if (!isNaN(minProb) && minProb >= 0 && minProb <= 1) {
        filters.min_country_probability = minProb;
      }
    }

    const sort = {
      by: req.query.sort_by || 'created_at',
      order: (req.query.order || 'desc').toLowerCase(),
    };

    if (!['age', 'created_at', 'gender_probability'].includes(sort.by)) {
      sort.by = 'created_at';
    }

    if (!['asc', 'desc'].includes(sort.order)) {
      sort.order = 'desc';
    }

    const result = await queryProfiles(filters, sort, { page, limit });

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total: result.total,
      data: result.data,
    });
  } catch (error) {
    console.error('Error in /api/v1/profiles:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

export default router;
