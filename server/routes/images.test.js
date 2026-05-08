import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb } from '../db.js';
import { imagesRouter } from './images.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, '..', 'test_images.db');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api/images', imagesRouter);

beforeAll(() => initDb(TEST_DB));
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Images API', () => {
  it('GET /api/images?type=user returns empty array', async () => {
    const res = await request(app).get('/api/images?type=user');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/images/upload uploads a base64 image', async () => {
    const res = await request(app)
      .post('/api/images/upload')
      .send({ data: 'data:image/png;base64,iVBORw0KGgo=', original_name: 'test.png' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.original_name).toBe('test.png');
  });

  it('GET /api/images?type=user returns uploaded image', async () => {
    const res = await request(app).get('/api/images?type=user');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].original_name).toBe('test.png');
    expect(res.body[0].data).toBeUndefined();
  });

  it('GET /api/images/:id/data returns 410 (deprecated endpoint)', async () => {
    const res = await request(app).get('/api/images/1/data?type=user');
    expect(res.status).toBe(410);
    expect(res.body.error).toContain('deprecated');
  });

  it('DELETE /api/images/:id removes image', async () => {
    const res = await request(app).delete('/api/images/1?type=user');
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/images?type=user');
    expect(list.body.length).toBe(0);
  });
});
