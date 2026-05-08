import { Router } from 'express';
import { getDb } from '../db.js';

export const imagesRouter = Router();

imagesRouter.get('/', (req, res) => {
  const { type } = req.query;
  if (type === 'user') {
    const rows = getDb().prepare(
      'SELECT id, original_name, filename, file_size, created_at FROM user_images ORDER BY created_at DESC'
    ).all();
    res.json(rows);
  } else {
    const rows = getDb().prepare(
      'SELECT id, prompt, filename, task_id, status, resolution, size, ref_image_ids, created_at FROM generated_images ORDER BY created_at DESC'
    ).all();
    res.json(rows);
  }
});

imagesRouter.post('/upload', (req, res) => {
  const { data, original_name } = req.body;
  const db = getDb();
  const info = db.prepare(
    'INSERT INTO user_images (filename, original_name, file_size, data) VALUES (?, ?, ?, ?)'
  ).run(original_name, original_name, Math.round(data.length * 0.75), data);
  const row = db.prepare('SELECT id, original_name, created_at FROM user_images WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

imagesRouter.delete('/:id', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

imagesRouter.get('/:id/data', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  const row = getDb().prepare(`SELECT data FROM ${table} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ data: row.data });
});
