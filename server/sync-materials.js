import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

const SYNC_VERSION = 3; // 同步版本号，用于增量更新

export function syncMaterials() {
  const db = getDb();

  // 检查同步版本，如果版本号低于当前版本则重新同步
  const versionRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_version'").get();
  const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (currentVersion >= SYNC_VERSION) {
    const count = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    if (count.c > 0) {
      console.log('Materials already synced, skipping');
      return;
    }
  }

  // 异步同步，不阻塞启动
  setImmediate(() => doSync(db));
}

async function doSync(db) {
  const casesPath = path.join(import.meta.dirname, '..', 'materials', 'data', 'cases.json');

  if (!fs.existsSync(casesPath)) {
    console.log('Materials submodule not found, skipping sync');
    return;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
    const cases = raw.cases || [];

    // 清空旧数据
    db.prepare('DELETE FROM materials').run();

    const insert = db.prepare(`
      INSERT OR REPLACE INTO materials (category, prompt_text, image_path, author, source_url)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((items) => {
      for (const item of items) {
        insert.run(item.category, item.prompt, item.imagePath, item.author, item.url);
      }
    });

    const toInsert = cases.map(c => ({
      category: c.category || '',
      prompt: c.prompt || '',
      imagePath: `materials/data/images/case${c.id}.jpg`,
      author: c.sourceLabel || '',
      url: c.sourceUrl || '',
    }));

    tx(toInsert);

    // 更新同步版本
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('sync_version', ?)").run(String(SYNC_VERSION));

    console.log(`Synced ${toInsert.length} materials from cases.json`);
  } catch (err) {
    console.error('Failed to sync materials:', err.message);
  }
}

// 手动触发重新同步的接口
export function forceSyncMaterials() {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key = 'sync_version'").run();
  return doSync(db);
}
