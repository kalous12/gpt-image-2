import { Router } from 'express';
import { getDb } from '../db.js';

export const settingsRouter = Router();

settingsRouter.get('/apikey', (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'apikey'").get();
  res.json({ apikey: row.value });
});

settingsRouter.put('/apikey', (req, res) => {
  const { apikey } = req.body;
  getDb().prepare("UPDATE settings SET value = ? WHERE key = 'apikey'").run(apikey || '');
  res.json({ apikey });
});
