import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
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

  it('POST /api/generate validates resolution parameter', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

    const res = await request(app).post('/api/generate').send({
      prompt: 'test',
      resolution: 'invalid',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('resolution');
  });

  it('POST /api/generate validates size parameter', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

    const res = await request(app).post('/api/generate').send({
      prompt: 'test',
      size: 'invalid',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('size');
  });

  it('POST /api/generate validates n parameter', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

    const res = await request(app).post('/api/generate').send({
      prompt: 'test',
      n: 10,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('n');
  });

  it('POST /api/generate validates prompt length', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

    const longPrompt = 'a'.repeat(5000);
    const res = await request(app).post('/api/generate').send({
      prompt: longPrompt,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('4000');
  });

  it('POST /api/generate submits task and stores record', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

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

    const db = getDb();
    const record = db.prepare('SELECT * FROM generated_images WHERE task_id = ?').get('task_test_123');
    expect(record).toBeDefined();
    expect(record.status).toBe('generating');
    expect(record.request_hash).toBeDefined();

    globalThis.fetch = undefined;
  });

  it('POST /api/generate returns cached result for identical requests', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();
    getDb().prepare("DELETE FROM generated_images").run();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: [{ status: 'submitted', task_id: 'task_cached_1' }],
      }),
    });
    globalThis.fetch = mockFetch;

    // 第一个请求
    const res1 = await request(app).post('/api/generate').send({
      prompt: 'same prompt for cache test',
      resolution: '1k',
      size: '1:1',
    });
    expect(res1.status).toBe(200);
    expect(res1.body.taskId).toBe('task_cached_1');
    expect(res1.body.cached).toBeUndefined();

    // 将任务状态设为已完成，模拟缓存场景
    getDb().prepare("UPDATE generated_images SET status = 'completed' WHERE task_id = ?").run('task_cached_1');

    // 第二个相同请求在30秒内应该返回 cached 标记
    const res2 = await request(app).post('/api/generate').send({
      prompt: 'same prompt for cache test',
      resolution: '1k',
      size: '1:1',
    });
    expect(res2.status).toBe(200);
    expect(res2.body.cached).toBe(true);
    expect(res2.body.taskId).toBe('task_cached_1');

    globalThis.fetch = undefined;
  });

  it('POST /api/generate stores request_hash for deduplication', async () => {
    getDb().prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();
    getDb().prepare("DELETE FROM generated_images").run();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: [{ status: 'submitted', task_id: 'task_hash_test' }],
      }),
    });
    globalThis.fetch = mockFetch;

    const res = await request(app).post('/api/generate').send({
      prompt: 'hash test prompt',
      resolution: '2k',
      size: '16:9',
    });
    expect(res.status).toBe(200);

    const record = getDb().prepare('SELECT request_hash FROM generated_images WHERE task_id = ?').get('task_hash_test');
    expect(record.request_hash).toBeDefined();
    expect(record.request_hash.length).toBe(32); // MD5 hash

    globalThis.fetch = undefined;
  });

  it('GET /api/tasks/:id polls task status', async () => {
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test', 'generating', 'task_test_456')"
    ).run();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: {
          id: 'task_test_456',
          status: 'completed',
          progress: 100,
          result: {
            images: [{ url: ['https://example.com/img.png'] }],
          },
        },
      }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    globalThis.fetch = mockFetch;

    const res = await request(app).get('/api/tasks/task_test_456');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');

    globalThis.fetch = undefined;
  }, 10000);

  it('GET /api/tasks/:id handles failed task', async () => {
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test', 'generating', 'task_fail_123')"
    ).run();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: { id: 'task_fail_123', status: 'failed', error: 'Test error' },
      }),
    });
    globalThis.fetch = mockFetch;

    const res = await request(app).get('/api/tasks/task_fail_123');
    expect(res.status).toBe(200);

    const record = getDb().prepare('SELECT status, error_message FROM generated_images WHERE task_id = ?').get('task_fail_123');
    expect(record.status).toBe('failed');
    expect(record.error_message).toBeDefined();

    globalThis.fetch = undefined;
  });

  it('POST /api/generate rejects when concurrent limit reached', async () => {
    getDb().prepare("DELETE FROM generated_images").run();

    // 插入 3 个 generating 任务，达到并发上限
    for (let i = 1; i <= 3; i++) {
      getDb().prepare(
        "INSERT INTO generated_images (prompt, status, task_id) VALUES (?, 'generating', ?)"
      ).run(`test${i}`, `concurrent_${i}`);
    }

    const res = await request(app).post('/api/generate').send({
      prompt: 'too many concurrent',
      resolution: '1k',
      size: '1:1',
    });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('最多同时进行');
  });

  it('GET /api/tasks/:id returns 503 on query error', async () => {
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test', 'generating', 'task_err_1')"
    ).run();

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    globalThis.fetch = mockFetch;

    const res = await request(app).get('/api/tasks/task_err_1');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe(503);
    expect(res.body.data.status).toBe('error');
    expect(res.body.data.message).toContain('Network timeout');

    globalThis.fetch = undefined;
  });

  it('GET /api/active returns generating tasks', async () => {
    // 清理旧数据
    getDb().prepare("DELETE FROM generated_images").run();

    // 插入一些任务
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test1', 'generating', 'active_1')"
    ).run();
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test2', 'completed', 'active_2')"
    ).run();
    getDb().prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test3', 'generating', 'active_3')"
    ).run();

    const res = await request(app).get('/api/active');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2); // 只有 generating 状态的
    expect(res.body.every(t => t.status === 'generating')).toBe(true);
  });
});
