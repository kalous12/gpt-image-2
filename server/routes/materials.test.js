import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb } from '../db.js';
import { syncMaterials } from '../sync-materials.js';
import { materialsRouter } from './materials.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, '..', 'test_materials_api.db');
const app = express();
app.use('/api/materials', materialsRouter);

beforeAll(() => {
  initDb(TEST_DB);
  syncMaterials();
});
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Materials API', () => {
  it('GET /api/materials returns array', async () => {
    const res = await request(app).get('/api/materials');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/materials?category=UI filters by category', async () => {
    const res = await request(app).get('/api/materials?category=UI');
    expect(res.status).toBe(200);
    res.body.forEach(m => expect(m.category).toBe('UI'));
  });

  it('GET /api/materials returns material with prompt_text', async () => {
    const res = await request(app).get('/api/materials');
    expect(res.body[0].prompt_text).toBeDefined();
    expect(res.body[0].category).toBeDefined();
  });
});
