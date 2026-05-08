import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function initDb(dbPath) {
  const resolvedPath = dbPath || path.join(import.meta.dirname, 'data.db');
  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS generated_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      filename TEXT,
      data TEXT,
      task_id TEXT,
      status TEXT NOT NULL DEFAULT 'generating',
      resolution TEXT,
      size TEXT,
      ref_image_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      prompt_text TEXT,
      image_path TEXT,
      author TEXT,
      source_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('apikey', '')").run();
}

export function getDb() { return db; }
export function closeDb() { if (db) { db.close(); db = null; } }
