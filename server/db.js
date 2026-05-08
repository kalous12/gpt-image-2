import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let db;
let dbPath;

export async function initDb(databasePath) {
  dbPath = databasePath || path.join(import.meta.dirname, 'data.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();

  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const uploadsDir = path.join(import.meta.dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  db.run(`
    CREATE TABLE IF NOT EXISTS user_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
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
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      prompt_text TEXT,
      image_path TEXT UNIQUE,
      author TEXT,
      source_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_task_id ON generated_images(task_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_status ON generated_images(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_created_at ON generated_images(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_request_hash ON generated_images(request_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category)`);

  // 迁移：添加新列
  migrateTable();

  // 初始化默认设置
  const existingKeys = getSettingsKeys();
  if (!existingKeys.includes('apikey')) {
    db.run("INSERT INTO settings (key, value) VALUES ('apikey', '')");
  }
  if (!existingKeys.includes('model')) {
    db.run("INSERT INTO settings (key, value) VALUES ('model', 'gpt-image-2')");
  }
  if (!existingKeys.includes('quality')) {
    db.run("INSERT INTO settings (key, value) VALUES ('quality', 'auto')");
  }
  if (!existingKeys.includes('api_endpoint')) {
    db.run("INSERT INTO settings (key, value) VALUES ('api_endpoint', 'https://api.apimart.ai')");
  }

  saveDb();
}

function getSettingsKeys() {
  const result = db.exec("SELECT key FROM settings");
  if (!result[0]) return [];
  return result[0].values.map(v => v[0]);
}

function migrateTable() {
  const result = db.exec("PRAGMA table_info(generated_images)");
  if (!result[0]) return;
  const columnNames = result[0].values.map(c => c[1]);

  if (!columnNames.includes('request_hash')) {
    db.run("ALTER TABLE generated_images ADD COLUMN request_hash TEXT");
  }
  if (!columnNames.includes('retry_count')) {
    db.run("ALTER TABLE generated_images ADD COLUMN retry_count INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('error_message')) {
    db.run("ALTER TABLE generated_images ADD COLUMN error_message TEXT");
  }
  if (!columnNames.includes('updated_at')) {
    db.run("ALTER TABLE generated_images ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  }
  saveDb();
}

function saveDb() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 模拟 better-sqlite3 的 prepare API
function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      const lastId = getLastInsertRowid();
      const changes = db.getRowsModified();
      // 只在非事务状态下保存
      if (!inTransaction) {
        saveDb();
      }
      return { changes, lastInsertRowid: lastId };
    },
    get: function(...params) {
      const result = db.exec(sql, params);
      if (!result[0] || !result[0].values[0]) return undefined;
      return rowToObject(result[0].columns, result[0].values[0]);
    },
    all: function(...params) {
      const result = db.exec(sql, params);
      if (!result[0]) return [];
      return result[0].values.map(row => rowToObject(result[0].columns, row));
    },
  };
}

function getLastInsertRowid() {
  const result = db.exec("SELECT last_insert_rowid()");
  if (!result[0] || !result[0].values[0]) return 0;
  return result[0].values[0][0];
}

function rowToObject(columns, values) {
  const obj = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = values[i];
  }
  return obj;
}

// 数据库包装器
// 事务状态追踪
let inTransaction = false;

function getDbWrapper() {
  return {
    prepare,
    exec: function(sql) {
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        db.run(stmt);
      }
      saveDb();
    },
    transaction: function(fn) {
      return function(...args) {
        if (inTransaction) {
          // 已经在事务中，直接执行
          return fn(...args);
        }
        inTransaction = true;
        try {
          db.run("BEGIN");
        } catch (e) {
          // 事务可能已存在，忽略
        }
        try {
          const result = fn(...args);
          try {
            db.run("COMMIT");
            saveDb();
          } catch (e) {
            // commit 失败，可能已自动提交
          }
          return result;
        } catch (err) {
          try {
            db.run("ROLLBACK");
          } catch (e) {
            // rollback 失败，忽略
          }
          throw err;
        } finally {
          inTransaction = false;
        }
      };
    },
  };
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return getDbWrapper();
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

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