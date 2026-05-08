import { describe, it, expect, afterAll } from 'vitest';
import { getDb, initDb, closeDb } from './db.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, 'test.db');

describe('Database', () => {
  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('should create all tables on init', () => {
    initDb(TEST_DB);
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
});
