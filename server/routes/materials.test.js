import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb, getDb } from '../db.js';
import { materialsRouter } from './materials.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, '..', 'test_materials_api.db');
const app = express();
app.use('/api/materials', materialsRouter);

beforeAll(async () => {
  await initDb(TEST_DB);
  // 插入一些测试数据
  const db = getDb();
  db.prepare(`
    INSERT INTO materials (category, prompt_text, image_path, author, source_url)
    VALUES ('UI', 'A modern dashboard design', 'materials/images/test/output.jpg', 'test_author', 'https://example.com')
  `).run();
  db.prepare(`
    INSERT INTO materials (category, prompt_text, image_path, author, source_url)
    VALUES ('Portrait', 'A beautiful portrait', 'materials/images/test2/output.jpg', 'test_author2', 'https://example.com/2')
  `).run();
});
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Materials API', () => {
  it('GET /api/materials returns paginated result', async () => {
    const res = await request(app).get('/api/materials');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/materials?category=UI filters by category', async () => {
    const res = await request(app).get('/api/materials?category=UI');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    res.body.items.forEach(m => expect(m.category).toBe('UI'));
  });

  it('GET /api/materials returns material with prompt_text', async () => {
    const res = await request(app).get('/api/materials');
    expect(res.status).toBe(200);
    if (res.body.items.length > 0) {
      expect(res.body.items[0].prompt_text).toBeDefined();
      expect(res.body.items[0].category).toBeDefined();
    }
  });
});
