import { Router } from 'express';
import { getDb, computeSha256, getUploadsDir, computeRequestHash } from '../db.js';
import path from 'path';
import fs from 'fs';

export const generateRouter = Router();

// 并发限制
const MAX_CONCURRENT_GENERATIONS = 3;

// 请求去重窗口（毫秒）
const DEDUP_WINDOW_MS = 30000;

// 带重试的 fetch
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return resp;
    } catch (err) {
      lastError = err;
      console.error(`Fetch attempt ${i + 1} failed:`, err.message, err.code || '', err.cause || '');
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

// 将本地文件路径或 URL 转换为 apimart.ai 接受的格式
async function processImageUrl(url) {
  if (!url) return null;

  // 已经是 http/https URL 或 data URI
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
    return url;
  }

  // 本地文件路径
  if (url.startsWith('/') || url.includes('uploads/')) {
    // 提取文件名
    const filename = url.split('/').pop();
    const filePath = path.join(getUploadsDir(), filename);

    if (fs.existsSync(filePath)) {
      const buffer = await fs.promises.readFile(filePath);
      const base64 = buffer.toString('base64');
      // 检测图片类型
      const ext = filename.split('.').pop().toLowerCase();
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      return `data:${mimeType};base64,${base64}`;
    }
  }

  return null;
}

// 参数验证
function validateGenerateParams({ prompt, resolution, size, n, model, quality }) {
  const errors = [];

  if (!prompt || typeof prompt !== 'string') {
    errors.push('prompt is required and must be a string');
  } else if (prompt.length > 4000) {
    errors.push('prompt must be less than 4000 characters');
  }

  const validResolutions = ['1k', '2k', '4k'];
  if (resolution && !validResolutions.includes(resolution)) {
    errors.push(`resolution must be one of: ${validResolutions.join(', ')}`);
  }

  const validSizes = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '21:9', '9:21'];
  if (size && !validSizes.includes(size)) {
    errors.push(`size must be one of: ${validSizes.join(', ')}`);
  }

  if (n && (!Number.isInteger(n) || n < 1 || n > 4)) {
    errors.push('n must be an integer between 1 and 4');
  }

  const validModels = ['gpt-image-2', 'gpt-image-2-official'];
  if (model && !validModels.includes(model)) {
    errors.push(`model must be one of: ${validModels.join(', ')}`);
  }

  const validQualities = ['auto', 'low', 'medium', 'high'];
  if (quality && !validQualities.includes(quality)) {
    errors.push(`quality must be one of: ${validQualities.join(', ')}`);
  }

  return errors;
}

// 下载图片并保存
async function downloadAndSaveImage(imageUrl, taskId) {
  const db = getDb();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Download] Attempt ${attempt + 1} for task ${taskId}`);
      const imgResp = await fetchWithRetry(imageUrl, {});
      const buffer = Buffer.from(await imgResp.arrayBuffer());

      const sha256 = computeSha256(buffer);
      const filename = `${sha256}.png`;
      const filePath = `/uploads/${filename}`;
      const absolutePath = path.join(getUploadsDir(), filename);

      await fs.promises.writeFile(absolutePath, buffer);

      db.prepare(`
        UPDATE generated_images
        SET status = 'completed', file_path = ?, sha256 = ?, updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
      `).run(filePath, sha256, taskId);

      console.log(`[Download] Task ${taskId} completed, saved to ${filename}`);
      return { success: true, filePath };
    } catch (err) {
      lastError = err;
      console.error(`[Download] Attempt ${attempt + 1} failed for task ${taskId}:`, err.message);

      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  // 所有重试都失败，更新状态
  db.prepare(`
    UPDATE generated_images
    SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE task_id = ?
  `).run(lastError?.message || 'Download failed', taskId);

  return { success: false, error: lastError?.message || 'Download failed' };
}

generateRouter.post('/generate', async (req, res) => {
  const { prompt, resolution, size, n, image_urls, model, quality } = req.body;

  // 参数验证
  const errors = validateGenerateParams({ prompt, resolution, size, n, model, quality });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const db = getDb();
  const apikeyRow = db.prepare("SELECT value FROM settings WHERE key = 'apikey'").get();
  if (!apikeyRow?.value) {
    return res.status(400).json({ error: '请先设置 API Key' });
  }

  const actualModel = model || 'gpt-image-2';
  const requestHash = computeRequestHash(prompt, resolution, size, image_urls, actualModel, quality);

  // 原子事务：并发限制检查 + 去重检查 + 插入
  let genId;
  try {
    const tx = db.transaction(() => {
      const row = db.prepare("SELECT COUNT(*) as c FROM generated_images WHERE status = 'generating'").get();
      if (row.c >= MAX_CONCURRENT_GENERATIONS) {
        throw new Error('CONCURRENT_LIMIT');
      }

      const recent = db.prepare(`
        SELECT id, task_id, status, file_path, created_at
        FROM generated_images
        WHERE request_hash = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(requestHash);

      if (recent) {
        const createdAt = new Date(recent.created_at.replace(' ', 'T') + 'Z').getTime();
        const age = Date.now() - createdAt;
        if (age < DEDUP_WINDOW_MS && recent.status === 'completed') {
          throw Object.assign(new Error('DEDUP_COMPLETED'), { recent });
        }
        if (recent.status === 'generating') {
          throw Object.assign(new Error('DEDUP_GENERATING'), { recent });
        }
      }

      const info = db.prepare(`
        INSERT INTO generated_images (prompt, status, resolution, size, ref_image_ids, request_hash)
        VALUES (?, 'generating', ?, ?, ?, ?)
      `).run(prompt, resolution || '1k', size || '1:1', JSON.stringify(image_urls || []), requestHash);

      return info.lastInsertRowid;
    });

    genId = tx();
  } catch (err) {
    if (err.message === 'CONCURRENT_LIMIT') {
      return res.status(429).json({ error: `最多同时进行 ${MAX_CONCURRENT_GENERATIONS} 个生成任务，请稍后再试` });
    }
    if (err.message === 'DEDUP_COMPLETED') {
      return res.json({ taskId: err.recent.task_id, genId: err.recent.id, cached: true });
    }
    if (err.message === 'DEDUP_GENERATING') {
      return res.json({
        taskId: err.recent.task_id,
        genId: err.recent.id,
        duplicate: true,
        message: '已有相同请求正在生成中'
      });
    }
    throw err;
  }

  try {
    // 处理 image_urls，将本地文件路径转换为 base64 data URI
    let processedImageUrls = null;
    if (image_urls?.length) {
      processedImageUrls = (await Promise.all(image_urls.map(processImageUrl))).filter(Boolean);
    }

    const body = {
      model: actualModel,
      prompt,
      n: n || 1,
      size: size || '1:1',
      resolution: resolution || '1k',
    };
    if (processedImageUrls?.length) body.image_urls = processedImageUrls;

    // gpt-image-2-official 支持 quality 参数
    if (actualModel === 'gpt-image-2-official' && quality) {
      body.quality = quality;
    }

    const resp = await fetchWithRetry('https://api.apimart.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apikeyRow.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json();

    if (json.code === 200) {
      const taskId = json.data[0].task_id;
      db.prepare('UPDATE generated_images SET task_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(taskId, genId);

      res.json({ taskId, genId });
    } else {
      db.prepare("UPDATE generated_images SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        json.error?.message || 'API error',
        genId
      );
      const error = json.error || {};
      res.status(error.code || 400).json({
        error: error.message || 'API error',
        code: error.code,
        type: error.type
      });
    }
  } catch (err) {
    db.prepare("UPDATE generated_images SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      err.message || 'fetch failed',
      genId
    );
    res.status(500).json({ error: err.message || 'fetch failed' });
  }
});

generateRouter.get('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true';
  const db = getDb();
  const apikeyRow = db.prepare("SELECT value FROM settings WHERE key = 'apikey'").get();

  const genRow = db.prepare('SELECT id, status, retry_count, file_path FROM generated_images WHERE task_id = ?').get(id);

  // 如果已经完成，直接返回结果
  if (genRow?.status === 'completed' && genRow.file_path) {
    return res.json({
      code: 200,
      data: {
        id,
        status: 'completed',
        filePath: genRow.file_path
      }
    });
  }

  // 如果已经失败且不是强制刷新，返回失败状态
  if (genRow?.status === 'failed' && !force) {
    return res.json({
      code: 200,
      data: {
        id,
        status: 'failed',
        error: { message: genRow.error_message || '生成失败，请重试' }
      }
    });
  }

  // 强制刷新或任务仍在处理中，去 API 查询最新状态
  try {
    const resp = await fetchWithRetry(`https://api.apimart.ai/v1/tasks/${id}`, {
      headers: { Authorization: `Bearer ${apikeyRow?.value || ''}` },
    });
    const json = await resp.json();

    if (json.code === 200 && json.data?.status === 'completed') {
      const imageUrl = json.data.result?.images?.[0]?.url?.[0];
      if (genRow && imageUrl) {
        const result = await downloadAndSaveImage(imageUrl, id);
        if (result.success) {
          json.data.filePath = result.filePath;
        } else {
          json.data.status = 'failed';
          json.data.errorMessage = result.error;
        }
      }
    } else if (json.data?.status === 'failed') {
      if (genRow) {
        const errorMsg = json.data.error?.message || json.data.error || 'Unknown error';
        db.prepare(`
          UPDATE generated_images
          SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
          WHERE task_id = ?
        `).run(errorMsg, id);
        json.data.errorMessage = errorMsg;
      }
    }
    // 其他状态（submitted, processing）不更新数据库，继续轮询

    res.json(json);
  } catch (err) {
    console.error(`Task ${id} query failed:`, err.message);
    res.status(503).json({
      code: 503,
      data: { id, status: 'error', message: err.message || 'Query failed, please retry' }
    });
  }
});

// 取消/忽略正在生成的任务
generateRouter.post('/tasks/:id/cancel', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const row = db.prepare('SELECT id, status FROM generated_images WHERE task_id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (row.status !== 'generating') {
    return res.status(400).json({ error: 'Task is not in generating status' });
  }
  db.prepare(`
    UPDATE generated_images
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE task_id = ?
  `).run(id);
  res.json({ success: true });
});

// 获取正在生成的任务列表
generateRouter.get('/active', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, task_id, prompt, status, resolution, size, created_at
    FROM generated_images
    WHERE status = 'generating'
    ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

// 后端主动轮询配置
const POLL_INTERVAL = 5000; // 5秒轮询一次
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 任务超时时间：5分钟
let pollTimer = null;

// 查询单个任务状态并处理
async function pollTask(taskId, apikey) {
  const db = getDb();
  const genRow = db.prepare('SELECT id, status, file_path FROM generated_images WHERE task_id = ?').get(taskId);

  // 如果已经完成或失败，跳过
  if (!genRow || genRow.status === 'completed' || genRow.status === 'failed') {
    return;
  }

  try {
    console.log(`[${new Date().toLocaleString()}] [Poller] Checking task ${taskId}...`);
    const resp = await fetchWithRetry(`https://api.apimart.ai/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apikey}` },
    });
    const json = await resp.json();

    if (json.code === 200 && json.data?.status === 'completed') {
      const imageUrl = json.data.result?.images?.[0]?.url?.[0];
      if (imageUrl) {
        console.log(`[${new Date().toLocaleString()}] [Poller] Task ${taskId} completed, downloading image...`);
        await downloadAndSaveImage(imageUrl, taskId);
      }
    } else if (json.data?.status === 'failed') {
      const errorMsg = json.data.error?.message || json.data.error || 'Unknown error';
      console.log(`[${new Date().toLocaleString()}] [Poller] Task ${taskId} failed: ${errorMsg}`);
      db.prepare(`
        UPDATE generated_images
        SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
      `).run(errorMsg, taskId);
    }
    // submitted/processing 状态不做处理，下次继续轮询
  } catch (err) {
    console.error(`[${new Date().toLocaleString()}] [Poller] Task ${taskId} query failed:`, err.message);
  }
}

// 后端主动轮询所有正在生成的任务
async function pollAllTasks() {
  const db = getDb();
  const apikeyRow = db.prepare("SELECT value FROM settings WHERE key = 'apikey'").get();

  if (!apikeyRow?.value) {
    return;
  }

  const generatingTasks = db.prepare(`
    SELECT task_id, created_at FROM generated_images
    WHERE status = 'generating' AND task_id IS NOT NULL
    ORDER BY created_at ASC
  `).all();

  if (generatingTasks.length === 0) {
    return;
  }

  const now = Date.now();
  const validTasks = [];

  for (const task of generatingTasks) {
    const createdAt = new Date(task.created_at.replace(' ', 'T') + 'Z').getTime();
    if (now - createdAt > TASK_TIMEOUT_MS) {
      db.prepare(`
        UPDATE generated_images
        SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
      `).run('任务生成超时', task.task_id);
      console.log(`[${new Date().toLocaleString()}] [Poller] Task ${task.task_id} timed out`);
    } else {
      validTasks.push(task);
    }
  }

  if (validTasks.length === 0) {
    return;
  }

  console.log(`[${new Date().toLocaleString()}] [Poller] Polling ${validTasks.length} valid tasks`);

  // 限制并发，每批最多 3 个
  const CONCURRENCY = 3;
  for (let i = 0; i < validTasks.length; i += CONCURRENCY) {
    const batch = validTasks.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(t => pollTask(t.task_id, apikeyRow.value))
    );
  }
}

// 启动轮询
export function startPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  // 立即执行一次
  pollAllTasks();

  // 定时轮询
  pollTimer = setInterval(pollAllTasks, POLL_INTERVAL);
  console.log(`[${new Date().toLocaleString()}] [Poller] Started, interval: ${POLL_INTERVAL}ms`);
}

// 停止轮询
export function stopPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log(`[${new Date().toLocaleString()}] [Poller] Stopped`);
  }
}

