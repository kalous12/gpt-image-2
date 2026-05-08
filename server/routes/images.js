import { Router } from 'express';
import { getDb, computeSha256, getUploadsDir } from '../db.js';
import path from 'path';
import fs from 'fs';

export const imagesRouter = Router();

imagesRouter.get('/', (req, res) => {
  const { type } = req.query;
  if (type === 'user') {
    const rows = getDb().prepare(
      'SELECT id, original_name, file_path, sha256, file_size, created_at FROM user_images ORDER BY created_at DESC'
    ).all();
    res.json(rows);
  } else {
    const rows = getDb().prepare(
      'SELECT id, prompt, file_path, sha256, task_id, status, resolution, size, ref_image_ids, created_at FROM generated_images ORDER BY created_at DESC'
    ).all();
    res.json(rows);
  }
});

imagesRouter.post('/upload', (req, res) => {
  const { data, original_name } = req.body;
  const db = getDb();

  // 解析 base64 data URI
  const matches = data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Invalid image data' });
  }

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // 计算 SHA256
  const sha256 = computeSha256(buffer);

  // 检查是否已存在相同文件
  const existing = db.prepare('SELECT id FROM user_images WHERE sha256 = ?').get(sha256);
  if (existing) {
    return res.status(200).json({ id: existing.id, message: 'File already exists', duplicate: true });
  }

  // 生成文件名和路径
  const filename = `${sha256}.${ext}`;
  const filePath = path.join(getUploadsDir(), filename);

  // 保存文件
  fs.writeFileSync(filePath, buffer);

  // 保存到数据库
  const info = db.prepare(
    'INSERT INTO user_images (filename, original_name, file_path, sha256, file_size) VALUES (?, ?, ?, ?, ?)'
  ).run(filename, original_name, filePath, sha256, buffer.length);

  const row = db.prepare('SELECT id, original_name, file_path, sha256, created_at FROM user_images WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

imagesRouter.delete('/:id', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  const db = getDb();

  // 获取文件路径
  const row = db.prepare(`SELECT file_path FROM ${table} WHERE id = ?`).get(req.params.id);
  if (row?.file_path && fs.existsSync(row.file_path)) {
    fs.unlinkSync(row.file_path);  // 删除文件
  }

  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// 保留旧接口兼容性，但不再使用
imagesRouter.get('/:id/data', (req, res) => {
  res.status(410).json({ error: 'This endpoint is deprecated. Use file_path instead.' });
});
