import { Router } from 'express';
import { getDb } from '../db.js';

export const materialsRouter = Router();

materialsRouter.get('/', (req, res) => {
  const { category } = req.query;
  const db = getDb();
  if (category) {
    const rows = db.prepare(
      'SELECT id, category, prompt_text, image_path, author, source_url, created_at FROM materials WHERE category = ? ORDER BY created_at DESC'
    ).all(category);
    res.json(rows);
  } else {
    const rows = db.prepare(
      'SELECT id, category, prompt_text, image_path, author, source_url, created_at FROM materials ORDER BY created_at DESC'
    ).all();
    res.json(rows);
  }
});
