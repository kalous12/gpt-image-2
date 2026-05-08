import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { getDb, initDb, closeDb, computeRequestHash } from './db.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, 'test.db');

describe('Database', () => {
  beforeAll(async () => {
    await initDb(TEST_DB);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should create all tables on init', () => {
    const db = getDb();

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    const names = tables.map(t => t.name);
    expect(names).toContain('user_images');
    expect(names).toContain('generated_images');
    expect(names).toContain('materials');
    expect(names).toContain('settings');
  });

  it('should set default settings', () => {
    const db = getDb();
    const apikey = db.prepare(
      "SELECT value FROM settings WHERE key = 'apikey'"
    ).get();
    expect(apikey).toBeDefined();
    expect(apikey.value).toBe('');
  });

  it('should create indexes', () => {
    const db = getDb();

    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all();

    const names = indexes.map(i => i.name);
    expect(names).toContain('idx_generated_task_id');
    expect(names).toContain('idx_generated_status');
    expect(names).toContain('idx_generated_created_at');
    expect(names).toContain('idx_generated_request_hash');
    expect(names).toContain('idx_materials_category');
  });

  it('should have unique constraint on task_id', () => {
    const db = getDb();

    db.prepare(
      "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test', 'generating', 'unique_task_1')"
    ).run();

    // 应该抛出错误，因为 task_id 是唯一的
    expect(() => {
      db.prepare(
        "INSERT INTO generated_images (prompt, status, task_id) VALUES ('test2', 'generating', 'unique_task_1')"
      ).run();
    }).toThrow();
  });

  it('should have unique constraint on image_path in materials', () => {
    const db = getDb();

    db.prepare(
      "INSERT INTO materials (category, image_path) VALUES ('test', 'path/1.jpg')"
    ).run();

    expect(() => {
      db.prepare(
        "INSERT INTO materials (category, image_path) VALUES ('test', 'path/1.jpg')"
      ).run();
    }).toThrow();
  });
});

describe('computeRequestHash', () => {
  it('should generate consistent hash for same input', () => {
    const hash1 = computeRequestHash('test prompt', '1k', '1:1', ['url1', 'url2']);
    const hash2 = computeRequestHash('test prompt', '1k', '1:1', ['url1', 'url2']);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different prompt', () => {
    const hash1 = computeRequestHash('test prompt 1', '1k', '1:1', []);
    const hash2 = computeRequestHash('test prompt 2', '1k', '1:1', []);
    expect(hash1).not.toBe(hash2);
  });

  it('should be order-independent for image_urls', () => {
    const hash1 = computeRequestHash('test', '1k', '1:1', ['url1', 'url2']);
    const hash2 = computeRequestHash('test', '1k', '1:1', ['url2', 'url1']);
    expect(hash1).toBe(hash2); // 排序后应该相同
  });

  it('should handle undefined image_urls', () => {
    const hash1 = computeRequestHash('test', '1k', '1:1', undefined);
    const hash2 = computeRequestHash('test', '1k', '1:1', []);
    expect(hash1).toBe(hash2);
  });
});
