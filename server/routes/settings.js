import { Router } from 'express';
import { getDb } from '../db.js';

export const settingsRouter = Router();

settingsRouter.get('/apikey', (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'apikey'").get();
  res.json({ apikey: row?.value || '' });
});

settingsRouter.put('/apikey', (req, res) => {
  const { apikey } = req.body;
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apikey', ?)").run(apikey || '');
  res.json({ apikey });
});

settingsRouter.get('/model', (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'model'").get();
  res.json({ model: row?.value || 'gpt-image-2' });
});

settingsRouter.put('/model', (req, res) => {
  const { model } = req.body;
  const validModels = ['gpt-image-2', 'gpt-image-2-official'];
  if (!validModels.includes(model)) {
    return res.status(400).json({ error: `Invalid model. Must be one of: ${validModels.join(', ')}` });
  }
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('model', ?)").run(model);
  res.json({ model });
});

settingsRouter.get('/quality', (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'quality'").get();
  res.json({ quality: row?.value || 'auto' });
});

settingsRouter.put('/quality', (req, res) => {
  const { quality } = req.body;
  const validQualities = ['auto', 'low', 'medium', 'high'];
  if (!validQualities.includes(quality)) {
    return res.status(400).json({ error: `Invalid quality. Must be one of: ${validQualities.join(', ')}` });
  }
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('quality', ?)").run(quality);
  res.json({ quality });
});

settingsRouter.get('/all', (req, res) => {
  const rows = getDb().prepare("SELECT key, value FROM settings").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json({
    apikey: settings.apikey || '',
    model: settings.model || 'gpt-image-2',
    quality: settings.quality || 'auto'
  });
});
