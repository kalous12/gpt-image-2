import { Router } from 'express';
import { getDb } from '../db.js';

export const materialsRouter = Router();

materialsRouter.get('/', (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();

  let countQuery, dataQuery, params;

  if (category) {
    countQuery = 'SELECT COUNT(*) as total FROM materials WHERE category = ?';
    dataQuery = `SELECT id, category, prompt_text, image_path, author, source_url, created_at
      FROM materials WHERE category = ?
      ORDER BY CASE WHEN prompt_text != '' THEN 0 ELSE 1 END, id DESC
      LIMIT ? OFFSET ?`;
    params = [category, category, parseInt(limit), offset];
  } else {
    countQuery = 'SELECT COUNT(*) as total FROM materials';
    dataQuery = `SELECT id, category, prompt_text, image_path, author, source_url, created_at
      FROM materials
      ORDER BY CASE WHEN prompt_text != '' THEN 0 ELSE 1 END, id DESC
      LIMIT ? OFFSET ?`;
    params = [parseInt(limit), offset];
  }

  const { total } = db.prepare(countQuery).get(category ? [category] : []);
  const rows = db.prepare(dataQuery).all(...params);

  res.json({
    items: rows,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    hasMore: offset + rows.length < total,
  });
});
