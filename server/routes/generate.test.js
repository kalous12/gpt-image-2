import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb, getDb } from '../db.js';
import { generateRouter } from './generate.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, '..', 'test_generate.db');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api', generateRouter);

beforeAll(() => {
  initDb(TEST_DB);
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apikey', 'sk-test')").run();
});

afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Generate API', () => {
  it('POST /api/generate returns 400 without prompt', async () => {
    const res = await request(app).post('/api/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('prompt');
  });

  it('POST /api/generate returns 400 without apikey set', async () => {
    getDb().prepare("UPDATE settings SET value = '' WHERE key = 'apikey'").run();

    const res = await request(app).post('/api/generate').send({ prompt: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('API Key');
  });

  it('POST /api/generate submits task and stores record', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

    // Mock fetch to return a fake successful response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: [{ status: 'submitted', task_id: 'task_test_123' }],
      }),
    });
    globalThis.fetch = mockFetch;

    const res = await request(app).post('/api/generate').send({
      prompt: 'a cat',
      resolution: '1k',
      size: '1:1',
      n: 1,
      image_urls: [],
    });

    expect(res.status).toBe(200);
    expect(res.body.taskId).toBe('task_test_123');

    // Verify DB record was created
    const db = getDb();
    const record = db.prepare('SELECT * FROM generated_images WHERE task_id = ?').get('task_test_123');
    expect(record).toBeDefined();
    expect(record.status).toBe('generating');

    globalThis.fetch = undefined;
  });

  it('GET /api/tasks/:id polls task status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: {
          id: 'task_test_123',
          status: 'completed',
          progress: 100,
          result: {
            images: [{ url: ['https://example.com/img.png'] }],
          },
        },
      }),
    });
    globalThis.fetch = mockFetch;

    const res = await request(app).get('/api/tasks/task_test_123');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.result.images[0].url[0]).toBe('https://example.com/img.png');

    globalThis.fetch = undefined;
  });

  it('GET /api/tasks/:id handles failed task', async () => {
    // First insert a record
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test', 'generating', 'task_fail_123')"
    ).run();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: { id: 'task_fail_123', status: 'failed' },
      }),
    });
    globalThis.fetch = mockFetch;

    const res = await request(app).get('/api/tasks/task_fail_123');
    expect(res.status).toBe(200);

    const record = getDb().prepare('SELECT status FROM generated_images WHERE task_id = ?').get('task_fail_123');
    expect(record.status).toBe('failed');

    globalThis.fetch = undefined;
  });
});
