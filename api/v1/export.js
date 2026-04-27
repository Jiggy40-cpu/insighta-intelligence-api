import express from 'express';
import cors from 'cors';
import { queryProfiles } from '../../lib/db-extended.js';
import { parseNaturalLanguageQuery } from '../../lib/parser.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';

const router = express.Router();
router.use(cors());
router.use(express.json());

const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => `"${h}"`).join(',');

  const dataRows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
};

router.get('/csv', authenticateToken, requireRole(['admin', 'analyst']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, parseInt(process.env.MAX_CSV_ROWS) || 50000);

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

    const sort = {
      by: req.query.sort_by || 'created_at',
      order: (req.query.order || 'desc').toLowerCase(),
    };

    const result = await queryProfiles(filters, sort, { page, limit });
    const csv = convertToCSV(result.data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profiles-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error in /api/v1/export/csv:', error);
    return res.status(500).json({ status: 'error', message: 'Export failed' });
  }
});

router.get('/json', authenticateToken, requireRole(['admin', 'analyst']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, parseInt(process.env.MAX_CSV_ROWS) || 50000);

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

    const sort = {
      by: req.query.sort_by || 'created_at',
      order: (req.query.order || 'desc').toLowerCase(),
    };

    const result = await queryProfiles(filters, sort, { page, limit });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="profiles-${Date.now()}.json"`);
    res.json({
      status: 'success',
      export_date: new Date().toISOString(),
      total_records: result.total,
      page,
      limit,
      data: result.data,
    });
  } catch (error) {
    console.error('Error in /api/v1/export/json:', error);
    return res.status(500).json({ status: 'error', message: 'Export failed' });
  }
});

export default router;
