import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, closeDb, getDb } from './db.js';
import { syncMaterials } from './sync-materials.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, 'test_materials.db');

beforeAll(() => initDb(TEST_DB));
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Material sync', () => {
  it('should handle missing materials directory gracefully', () => {
    // 测试环境没有素材目录，应该优雅地跳过
    syncMaterials();
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    // 在没有素材目录的情况下，应该返回 0
    expect(count.c).toBe(0);
  });

  it('should be idempotent (skip if already synced)', () => {
    const db = getDb();
    const before = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    syncMaterials();
    const after = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    expect(after.c).toBe(before.c);
  });
});
