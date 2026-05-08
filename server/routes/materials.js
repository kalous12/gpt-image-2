import { Router } from 'express';
import { getDb } from '../db.js';

export const materialsRouter = Router();

materialsRouter.get('/', (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();

  try {
    let countResult, rows;

    if (category) {
      countResult = db.prepare('SELECT COUNT(*) as total FROM materials WHERE category = ?').get(category);
      rows = db.prepare(`
        SELECT id, category, prompt_text, image_path, author, source_url, created_at
        FROM materials WHERE category = ?
        ORDER BY CASE WHEN prompt_text != '' THEN 0 ELSE 1 END, id DESC
        LIMIT ? OFFSET ?
      `).all(category, parseInt(limit), offset);
    } else {
      countResult = db.prepare('SELECT COUNT(*) as total FROM materials').get();
      rows = db.prepare(`
        SELECT id, category, prompt_text, image_path, author, source_url, created_at
        FROM materials
        ORDER BY CASE WHEN prompt_text != '' THEN 0 ELSE 1 END, id DESC
        LIMIT ? OFFSET ?
      `).all(parseInt(limit), offset);
    }

    const total = countResult?.total || 0;

    res.json({
      items: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: offset + rows.length < total,
    });
  } catch (err) {
    console.error('Materials API error:', err);
    res.status(500).json({ error: err.message });
  }
});
