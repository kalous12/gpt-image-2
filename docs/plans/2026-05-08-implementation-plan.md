# GPT-Image-2 网站实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 TDD 构建文生图/图生图网站，React 前端 + Express 后端 + SQLite + APIMart API

**Architecture:** Monorepo 结构，`client/` 为 React+Vite 前端，`server/` 为 Express 后端。所有 API 通过后端代理转发 APIMart，前端不直接调用 APIMart。图片以 base64 存入 SQLite。

**Tech Stack:** React 18, Vite, Vitest, React Testing Library, Express, better-sqlite3, multer

**TDD 原则:** 每个任务先写失败的测试，再写实现，确认通过后提交。

---

## 准备: 项目脚手架

### 任务 0: 初始化 Monorepo 和 Git 子模块

**Files:**
- Create: `package.json`
- Create: `client/` (Vite + React)
- Create: `server/` (Express)
- Create: `.gitmodules`

**Step 1: 添加 Git 子模块**

```bash
cd /root/rv1106/flexkvm_sdk/gpt-image-2
git submodule add https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts.git materials
```

**Step 2: 初始化根 package.json**

```json
{
  "name": "gpt-image-2",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && node --watch index.js",
    "dev:client": "cd client && npx vite --host"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

**Step 3: 初始化 client/ (Vite + React)**

```bash
cd client && npm create vite@latest . -- --template react
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 4: 初始化 server/**

```bash
mkdir -p server/routes server/uploads
cd server && npm init -y
npm install express better-sqlite3 multer cors
npm install -D vitest supertest
```

**Step 5: 配置 Vitest (client/ 和 server/ 各自的 vite.config)**

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with Vite+React client and Express server"
```

---

## 阶段一: 后端核心

### 任务 1: 数据库初始化 + 建表

**Files:**
- Create: `server/db.js`
- Create: `server/db.test.js`

**Step 1: 写测试**

```js
// server/db.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, initDb, closeDb } from './db.js';
import fs from 'fs';

const TEST_DB = './test.db';

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
  });
});
```

**Step 2: 运行测试验证失败** → `npx vitest run db.test.js`

**Step 3: 实现 db.js**

```js
import Database from 'better-sqlite3';
import path from 'path';

let db;

export function initDb(dbPath) {
  db = new Database(dbPath || path.join(import.meta.dirname, 'data.db'));
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
export function closeDb() { if (db) db.close(); }
```

**Step 4: 运行测试验证通过** → `npx vitest run db.test.js`

**Step 5: Commit**

---

### 任务 2: Settings API (读写 API Key)

**Files:**
- Create: `server/routes/settings.js`
- Create: `server/routes/settings.test.js`
- Modify: `server/index.js`

**Step 1: 写测试**

```js
// server/routes/settings.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb } from '../db.js';
import { settingsRouter } from './settings.js';
import fs from 'fs';

const TEST_DB = './test_settings.db';
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

beforeAll(() => initDb(TEST_DB));
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Settings API', () => {
  it('GET /api/settings/apikey returns empty by default', async () => {
    const res = await request(app).get('/api/settings/apikey');
    expect(res.status).toBe(200);
    expect(res.body.apikey).toBe('');
  });

  it('PUT /api/settings/apikey updates and returns new value', async () => {
    const res = await request(app)
      .put('/api/settings/apikey')
      .send({ apikey: 'sk-test-123' });
    expect(res.status).toBe(200);
    expect(res.body.apikey).toBe('sk-test-123');
  });

  it('GET /api/settings/apikey returns updated value', async () => {
    const res = await request(app).get('/api/settings/apikey');
    expect(res.body.apikey).toBe('sk-test-123');
  });
});
```

**Step 2: 运行验证失败**

**Step 3: 实现**

```js
// server/routes/settings.js
import { Router } from 'express';
import { getDb } from '../db.js';

export const settingsRouter = Router();

settingsRouter.get('/apikey', (req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'apikey'").get();
  res.json({ apikey: row.value });
});

settingsRouter.put('/apikey', (req, res) => {
  const { apikey } = req.body;
  getDb().prepare("UPDATE settings SET value = ? WHERE key = 'apikey'").run(apikey || '');
  res.json({ apikey });
});
```

**Step 4: 运行验证通过**

**Step 5: 实现 server/index.js**

```js
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { settingsRouter } from './routes/settings.js';
import { syncMaterials } from './sync-materials.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

initDb();
syncMaterials();

app.use('/api/settings', settingsRouter);

app.listen(3001, () => console.log('Server running on :3001'));
```

**Step 6: Commit**

---

### 任务 3: 用户图片 API (上传/列表/删除)

**Files:**
- Create: `server/routes/images.js`
- Create: `server/routes/images.test.js`
- Modify: `server/index.js`

**Step 1: 写测试**

```js
// server/routes/images.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb, getDb } from '../db.js';
import { imagesRouter } from './images.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = './test_images.db';
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
  });

  it('DELETE /api/images/:id removes image', async () => {
    const res = await request(app).delete('/api/images/1');
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/images?type=user');
    expect(list.body.length).toBe(0);
  });
});
```

**Step 2: 运行验证失败**

**Step 3: 实现**

```js
// server/routes/images.js
import { Router } from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'crypto';

export const imagesRouter = Router();

imagesRouter.get('/', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  const rows = getDb().prepare(
    `SELECT id, original_name, prompt, filename, file_size, task_id, status, resolution, size, created_at FROM ${table} ORDER BY created_at DESC`
  ).all();
  res.json(rows);
});

imagesRouter.post('/upload', (req, res) => {
  const { data, original_name } = req.body;
  const db = getDb();
  const info = db.prepare(
    'INSERT INTO user_images (filename, original_name, file_size, data) VALUES (?, ?, ?, ?)'
  ).run(original_name, original_name, Math.round(data.length * 0.75), data);
  const row = db.prepare('SELECT id, original_name, created_at FROM user_images WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

imagesRouter.delete('/:id', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

imagesRouter.get('/:id/data', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  const row = getDb().prepare(`SELECT data FROM ${table} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ data: row.data });
});
```

**Step 4: 运行验证通过**

**Step 5: 注册路由到 server/index.js, Commit**

---

### 任务 4: 素材库同步

**Files:**
- Create: `server/sync-materials.js`
- Create: `server/sync-materials.test.js`

**Step 1: 写测试**

```js
// server/sync-materials.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, closeDb, getDb } from '../db.js';
import { syncMaterials } from './sync-materials.js';
import fs from 'fs';

const TEST_DB = './test_materials.db';

beforeAll(() => initDb(TEST_DB));
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Material sync', () => {
  it('should import materials from JSON data file', () => {
    syncMaterials(TEST_DB);
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    expect(count.c).toBeGreaterThan(0);
  });

  it('should be idempotent (skip if already synced)', () => {
    const db = getDb();
    const before = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    syncMaterials(TEST_DB);
    const after = db.prepare('SELECT COUNT(*) as c FROM materials').get();
    expect(after.c).toBe(before.c);
  });
});
```

**Step 2: 运行验证失败**

**Step 3: 实现 sync-materials.js**

```js
import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

export function syncMaterials(dbPath) {
  const db = getDb() || (dbPath ? (await import('./db.js')).initDb(dbPath) && getDb() : getDb());

  const count = db.prepare('SELECT COUNT(*) as c FROM materials').get();
  if (count.c > 0) return;

  const jsonPath = path.join(import.meta.dirname, '..', 'materials', 'data', 'valid_mapping_2026-05-08.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('Materials submodule not found, skipping sync');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const insert = db.prepare(
    'INSERT INTO materials (category, prompt_text, image_path, author, source_url) VALUES (?, ?, ?, ?, ?)'
  );

  const tx = db.transaction((items) => {
    for (const item of items) {
      const category = item.category || '';
      const prompt = item.prompt_text || '';
      const author = item.author_handle || '';
      const url = item.tweet_url || '';
      const imagePath = `images/${category.toLowerCase()}_case${item.tweet_id}/output.jpg`;
      insert.run(category, prompt, imagePath, author, url);
    }
  });

  tx(data);
  console.log(`Synced ${data.length} materials`);
}
```

**Step 4: 运行验证通过**

**Step 5: Commit**

---

### 任务 5: 素材库 API

**Files:**
- Create: `server/routes/materials.js`
- Create: `server/routes/materials.test.js`
- Modify: `server/index.js`

**Step 1: 写测试**

```js
// server/routes/materials.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb } from '../db.js';
import { syncMaterials } from '../sync-materials.js';
import { materialsRouter } from './materials.js';
import fs from 'fs';

const TEST_DB = './test_materials_api.db';
const app = express();
app.use('/api/materials', materialsRouter);

beforeAll(() => {
  initDb(TEST_DB);
  syncMaterials();
});
afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Materials API', () => {
  it('GET /api/materials returns array', async () => {
    const res = await request(app).get('/api/materials');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/materials?category=UI filters by category', async () => {
    const res = await request(app).get('/api/materials?category=UI');
    expect(res.status).toBe(200);
    res.body.forEach(m => expect(m.category).toBe('UI'));
  });
});
```

**Step 2-5: 实现并验证、注册路由、Commit**

---

### 任务 6: 生成 API (提交 + 任务查询)

**Files:**
- Create: `server/routes/generate.js`
- Create: `server/routes/generate.test.js`
- Modify: `server/index.js`

**Step 1: 写测试**

```js
// server/routes/generate.test.js
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, closeDb } from '../db.js';
import { generateRouter } from './generate.js';
import fs from 'fs';

const TEST_DB = './test_generate.db';
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api', generateRouter);

beforeAll(() => {
  initDb(TEST_DB);
  // 设置 apikey
  const db = (await import('../db.js')).getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apikey', 'sk-test')").run();
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
    const db = (await import('../db.js')).getDb();
    db.prepare("UPDATE settings SET value = '' WHERE key = 'apikey'").run();

    const res = await request(app).post('/api/generate').send({ prompt: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('API Key');
  });

  it('POST /api/generate submits task and stores record', async () => {
    const db = (await import('../db.js')).getDb();
    db.prepare("UPDATE settings SET value = 'sk-test' WHERE key = 'apikey'").run();

    // Mock APIMart response via nock or vi.mock
    // ...

    const res = await request(app).post('/api/generate').send({
      prompt: 'a cat',
      resolution: '1k',
      size: '1:1',
      n: 1,
      image_urls: []
    });
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBeDefined();
  });

  it('GET /api/tasks/:id returns task status', async () => {
    const res = await request(app).get('/api/tasks/task_test_123');
    expect(res.status).toBe(200);
  });
});
```

**Step 2: 运行验证失败**

**Step 3: 实现 generate.js**

```js
import { Router } from 'express';
import { getDb } from '../db.js';

export const generateRouter = Router();

generateRouter.post('/generate', async (req, res) => {
  const { prompt, resolution, size, n, image_urls } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const db = getDb();
  const apikeyRow = db.prepare("SELECT value FROM settings WHERE key = 'apikey'").get();
  if (!apikeyRow?.value) return res.status(400).json({ error: '请先设置 API Key' });

  // 插入生成记录
  const info = db.prepare(
    `INSERT INTO generated_images (prompt, status, resolution, size, ref_image_ids)
     VALUES (?, 'generating', ?, ?, ?)`
  ).run(prompt, resolution || '1k', size || '1:1', JSON.stringify(image_urls || []));

  const genId = info.lastInsertRowid;

  // 调用 APIMart
  try {
    const body = { model: 'gpt-image-2', prompt, n: n || 1, size: size || '1:1', resolution: resolution || '1k' };
    if (image_urls?.length) body.image_urls = image_urls;

    const resp = await fetch('https://api.apimart.ai/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apikeyRow.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await resp.json();

    if (json.code === 200) {
      const taskId = json.data[0].task_id;
      db.prepare('UPDATE generated_images SET task_id = ? WHERE id = ?').run(taskId, genId);
      res.json({ taskId, genId });
    } else {
      db.prepare("UPDATE generated_images SET status = 'failed' WHERE id = ?").run(genId);
      res.status(400).json({ error: json.error?.message || 'API error' });
    }
  } catch (err) {
    db.prepare("UPDATE generated_images SET status = 'failed' WHERE id = ?").run(genId);
    res.status(500).json({ error: err.message });
  }
});

generateRouter.get('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const apikeyRow = db.prepare("SELECT value FROM settings WHERE key = 'apikey'").get();

  try {
    const resp = await fetch(`https://api.apimart.ai/v1/tasks/${id}`, {
      headers: { 'Authorization': `Bearer ${apikeyRow?.value || ''}` }
    });
    const json = await resp.json();

    if (json.code === 200 && json.data.status === 'completed') {
      const imageUrl = json.data.result?.images?.[0]?.url?.[0];
      const genRow = db.prepare('SELECT id FROM generated_images WHERE task_id = ?').get(id);
      if (genRow && imageUrl) {
        db.prepare("UPDATE generated_images SET status = 'completed', filename = ? WHERE task_id = ?")
          .run(imageUrl, id);
      }
    } else if (json.data?.status === 'failed') {
      db.prepare("UPDATE generated_images SET status = 'failed' WHERE task_id = ?").run(id);
    }

    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 4-5: 验证通过、注册路由、Commit**

---

### 任务 7: 后端入口 index.js 整合

**Files:**
- Modify: `server/index.js`

整合所有路由，最终版本：

```js
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { syncMaterials } from './sync-materials.js';
import { settingsRouter } from './routes/settings.js';
import { imagesRouter } from './routes/images.js';
import { materialsRouter } from './routes/materials.js';
import { generateRouter } from './routes/generate.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

initDb();
syncMaterials();

app.use('/api/settings', settingsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api', generateRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
```

**Commit**

---

## 阶段二: 前端组件

### 任务 8: API 封装 + 类型定义

**Files:**
- Create: `client/src/api.ts`
- Create: `client/src/types.ts`

```ts
// client/src/types.ts
export interface ImageItem {
  id: number;
  original_name?: string;
  prompt?: string;
  filename?: string;
  file_size?: number;
  task_id?: string;
  status?: string;
  resolution?: string;
  size?: string;
  category?: string;
  author?: string;
  image_path?: string;
  data?: string;
  created_at: string;
}

export type TabType = 'user' | 'generated' | 'material';
export type Resolution = '1k' | '2k' | '4k';
export type ImageSize = 'auto' | '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16' | '2:1' | '1:2' | '21:9' | '9:21';
```

```ts
// client/src/api.ts
const BASE = 'http://localhost:3001/api';

async function request(url: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, opts);
  return res.json();
}

export const api = {
  getImages: (type: string) => request(`/images?type=${type}`),
  uploadImage: (data: string, original_name: string) =>
    request('/images/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, original_name }) }),
  deleteImage: (id: number, type: string) => request(`/images/${id}?type=${type}`, { method: 'DELETE' }),
  getImageData: (id: number, type: string) => request(`/images/${id}/data?type=${type}`),
  getMaterials: (category?: string) => request(`/materials${category ? `?category=${category}` : ''}`),
  generate: (body: object) => request('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  getTask: (id: string) => request(`/tasks/${id}`),
  getApiKey: () => request('/settings/apikey'),
  saveApiKey: (apikey: string) => request('/settings/apikey', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apikey }) }),
};
```

**Step 1: 测试 — 不涉及 UI 渲染，跳过组件测试**

**Commit**

---

### 任务 9: FloatingPanel 组件

**Files:**
- Create: `client/src/components/FloatingPanel.tsx`
- Create: `client/src/components/FloatingPanel.test.tsx`

**Step 1: 写测试**

```tsx
// client/src/components/FloatingPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingPanel } from './FloatingPanel';

describe('FloatingPanel', () => {
  it('renders three tabs', () => {
    render(<FloatingPanel current="user" onChange={() => {}} />);
    expect(screen.getByText('用户库')).toBeDefined();
    expect(screen.getByText('生成库')).toBeDefined();
    expect(screen.getByText('素材库')).toBeDefined();
  });

  it('highlights current tab', () => {
    render(<FloatingPanel current="generated" onChange={() => {}} />);
    const btn = screen.getByText('生成库');
    expect(btn.className).toContain('active');
  });

  it('calls onChange on tab click', async () => {
    const onChange = vi.fn();
    render(<FloatingPanel current="user" onChange={onChange} />);
    await userEvent.click(screen.getByText('生成库'));
    expect(onChange).toHaveBeenCalledWith('generated');
  });
});
```

**Step 2: 运行验证失败**

**Step 3: 实现**

```tsx
// client/src/components/FloatingPanel.tsx
import { TabType } from '../types';

interface Props {
  current: TabType;
  onChange: (tab: TabType) => void;
}

const tabs: { key: TabType; label: string }[] = [
  { key: 'user', label: '用户库' },
  { key: 'generated', label: '生成库' },
  { key: 'material', label: '素材库' },
];

export function FloatingPanel({ current, onChange }: Props) {
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, display: 'flex', gap: 2,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
      borderRadius: 12, padding: 4,
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          className={current === t.key ? 'active' : ''}
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 20px', borderRadius: 10, border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 500,
            background: current === t.key ? '#fff' : 'transparent',
            color: current === t.key ? '#000' : '#fff',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 4-5: 验证通过、Commit**

---

### 任务 10: ImageCard 组件

**Files:**
- Create: `client/src/components/ImageCard.tsx`
- Create: `client/src/components/ImageCard.test.tsx`

测试覆盖：
- 正常渲染图片
- hover 显示操作按钮
- 用户库/生成库/素材库各自显示不同按钮
- 第一张特殊渲染（上传按钮 / 旋转占位）

**Step 1: 写测试，Step 2: 验证失败，Step 3: 实现，Step 4: 验证通过，Step 5: Commit**

---

### 任务 11: MasonryGallery 组件

**Files:**
- Create: `client/src/components/MasonryGallery.tsx`
- Create: `client/src/components/MasonryGallery.test.tsx`

使用 CSS columns 实现瀑布流，加载对应库的图片。

**Commit**

---

### 任务 12: ImageModal 组件

**Files:**
- Create: `client/src/components/ImageModal.tsx`
- Create: `client/src/components/ImageModal.test.tsx`

模态框，显示大图。用户库只显示图片；生成库显示图片+prompt+参考图；素材库显示图片+prompt

**Commit**

---

### 任务 13: SelectedImages 组件

**Files:**
- Create: `client/src/components/SelectedImages.tsx`
- Create: `client/src/components/SelectedImages.test.tsx`

底部第一层：显示已选图片缩略图列表，最多16张，右上角删除按钮，点击打开模态框。

**Commit**

---

### 任务 14: PromptInput 组件

**Files:**
- Create: `client/src/components/PromptInput.tsx`
- Create: `client/src/components/PromptInput.test.tsx`

底部第二层：textarea 输入框，支持多行。

**Commit**

---

### 任务 15: ActionBar 组件（含子组件）

**Files:**
- Create: `client/src/components/ActionBar.tsx`
- Create: `client/src/components/ActionBar.test.tsx`

底部第三层：价格显示、API Key 按钮、分辨率选择、尺寸选择、数量选择、生成按钮。

**Commit**

---

### 任务 16: ApiKeyModal 组件

**Files:**
- Create: `client/src/components/ApiKeyModal.tsx`
- Create: `client/src/components/ApiKeyModal.test.tsx`

模态框输入 API Key 并保存。

**Commit**

---

### 任务 17: App 主组件整合

**Files:**
- Create: `client/src/App.tsx`
- Create: `client/src/App.test.tsx`
- Modify: `client/src/main.tsx`

整合所有组件，管理全局状态。

**Commit**

---

### 任务 18: 集成测试 & 端到端验证

- 启动后端 `npm run dev:server`
- 启动前端 `npm run dev:client`
- 手动测试完整流程
- 修复 bug

**Commit**

---

## 补充说明

### 图片存储策略

- 用户上传图片：转 base64 存入 SQLite `user_images.data`
- 生成结果图片：获取 APIMart 返回的 URL，存入 `generated_images.filename`
- 前端通过 `/api/images/:id/data` 获取 base64 数据用于渲染

### 价格显示

固定的价格表，根据选中分辨率动态显示：

```ts
const PRICES = { '1k': '¥0.04', '2k': '¥0.08', '4k': '¥0.13' };
```

### 4K 限制

4K 分辨率仅支持 `16:9` / `9:16` / `2:1` / `1:2` / `21:9` / `9:21` 六个比例，前端需要在选择 4K 时限制尺寸选项。
