import { Router } from 'express';
import { getDb } from '../db.js';
import { API_ENDPOINTS, getApiEndpoint, setApiEndpoint, testApiEndpoint } from './generate.js';

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

// API 端点配置
settingsRouter.get('/api-endpoint', (req, res) => {
  const endpoint = getApiEndpoint();
  res.json({ endpoint, endpoints: API_ENDPOINTS });
});

settingsRouter.put('/api-endpoint', (req, res) => {
  const { endpoint } = req.body;
  try {
    setApiEndpoint(endpoint);
    res.json({ endpoint });
  } catch (err) {
    res.status(400).json({ error: 'Invalid endpoint' });
  }
});

// 测试端点连通性
settingsRouter.post('/api-endpoint/test', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint || !API_ENDPOINTS.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  const result = await testApiEndpoint(endpoint);
  res.json(result);
});

// 测试所有端点
settingsRouter.post('/api-endpoint/test-all', async (req, res) => {
  const results = await Promise.all(API_ENDPOINTS.map(async (endpoint) => {
    const result = await testApiEndpoint(endpoint);
    return { endpoint, ...result };
  }));
  res.json(results);
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
    quality: settings.quality || 'auto',
    api_endpoint: settings.api_endpoint || API_ENDPOINTS[0]
  });
});
