import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let db;

export function initDb(dbPath) {
  const resolvedPath = dbPath || path.join(import.meta.dirname, 'data.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');

  const uploadsDir = path.join(import.meta.dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS generated_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      file_path TEXT,
      sha256 TEXT,
      task_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'generating',
      resolution TEXT,
      size TEXT,
      ref_image_ids TEXT,
      request_hash TEXT,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      prompt_text TEXT,
      image_path TEXT UNIQUE,
      author TEXT,
      source_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_generated_task_id ON generated_images(task_id);
    CREATE INDEX IF NOT EXISTS idx_generated_status ON generated_images(status);
    CREATE INDEX IF NOT EXISTS idx_generated_created_at ON generated_images(created_at);
    CREATE INDEX IF NOT EXISTS idx_generated_request_hash ON generated_images(request_hash);
    CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
  `);

  // 迁移：添加新列（如果不存在）
  migrateTable();

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('apikey', '')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('model', 'gpt-image-2')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('quality', 'auto')").run();
}

function migrateTable() {
  const columns = db.prepare("PRAGMA table_info(generated_images)").all();
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('request_hash')) {
    db.exec("ALTER TABLE generated_images ADD COLUMN request_hash TEXT");
  }
  if (!columnNames.includes('retry_count')) {
    db.exec("ALTER TABLE generated_images ADD COLUMN retry_count INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('error_message')) {
    db.exec("ALTER TABLE generated_images ADD COLUMN error_message TEXT");
  }
  if (!columnNames.includes('updated_at')) {
    db.exec("ALTER TABLE generated_images ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  }
}

export function getDb() { return db; }
export function closeDb() { if (db) { db.close(); db = null; } }

export function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function computeRequestHash(prompt, resolution, size, imageUrls, model, quality) {
  const data = JSON.stringify({ prompt, resolution, size, imageUrls: (imageUrls || []).sort(), model, quality });
  return crypto.createHash('md5').update(data).digest('hex');
}

export function getUploadsDir() {
  return path.join(import.meta.dirname, 'uploads');
}
