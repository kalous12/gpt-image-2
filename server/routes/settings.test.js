import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb } from '../db.js';
import { settingsRouter } from './settings.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, '..', 'test_settings.db');
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

beforeAll(async () => await initDb(TEST_DB));
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Settings API', () => {
  it('GET /api/settings/apikey returns empty by default', async () => {
    const res = await request(app).get('/api/settings/apikey');
    expect(res.status).toBe(200);
    expect(res.body.apikey).toBe('');
  });

  it('PUT /api/settings/apikey updates and returns new value', async () => {
    const res = await request(app)
      .put('/api/settings/apikey')
      .send({ apikey: 'sk-test-123' });
    expect(res.status).toBe(200);
    expect(res.body.apikey).toBe('sk-test-123');
  });

  it('GET /api/settings/apikey returns updated value', async () => {
    const res = await request(app).get('/api/settings/apikey');
    expect(res.body.apikey).toBe('sk-test-123');
  });
});
