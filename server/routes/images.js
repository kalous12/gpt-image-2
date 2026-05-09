import { Router } from 'express';
import { getDb, computeSha256, getUploadsDir } from '../db.js';
import path from 'path';
import fs from 'fs';

export const imagesRouter = Router();

// 通过魔数验证图片实际内容
function validateImageBuffer(buffer, declaredExt) {
  if (buffer.length < 8) return { valid: false, reason: 'File too small' };

  const magic = {
    jpg: buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF,
    png: buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47,
    gif: buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38,
    bmp: buffer[0] === 0x42 && buffer[1] === 0x4D,
    webp: buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46,
  };

  const extMap = {
    jpg: 'jpg', jpeg: 'jpg',
    png: 'png',
    gif: 'gif',
    bmp: 'bmp',
    webp: 'webp',
  };

  const expected = extMap[declaredExt];
  if (!expected) return { valid: false, reason: 'Unsupported image type' };

  if (!magic[expected]) {
    return { valid: false, reason: `Content does not match declared ${declaredExt}` };
  }

  return { valid: true };
}

imagesRouter.get('/', (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  if (type === 'user') {
    const countRow = getDb().prepare('SELECT COUNT(*) as total FROM user_images').get();
    const rows = getDb().prepare(
      'SELECT id, original_name, file_path, sha256, file_size, created_at FROM user_images ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(parseInt(limit), offset);
    res.json({ items: rows, total: countRow.total, page: parseInt(page), limit: parseInt(limit) });
  } else {
    const countRow = getDb().prepare('SELECT COUNT(*) as total FROM generated_images').get();
    const rows = getDb().prepare(
      'SELECT id, prompt, file_path, sha256, task_id, status, resolution, size, ref_image_ids, created_at FROM generated_images ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(parseInt(limit), offset);
    res.json({ items: rows, total: countRow.total, page: parseInt(page), limit: parseInt(limit) });
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

  // 验证魔数
  const validation = validateImageBuffer(buffer, ext);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  // 计算 SHA256
  const sha256 = computeSha256(buffer);

  // 检查是否已存在相同文件
  const existing = db.prepare('SELECT id FROM user_images WHERE sha256 = ?').get(sha256);
  if (existing) {
    return res.status(200).json({ id: existing.id, message: 'File already exists', duplicate: true });
  }

  // 生成文件名和路径（数据库存相对路径，实际写文件用绝对路径）
  const filename = `${sha256}.${ext}`;
  const filePath = `/uploads/${filename}`;
  const absolutePath = path.join(getUploadsDir(), filename);

  // 保存文件
  fs.writeFileSync(absolutePath, buffer);

  // 保存到数据库
  const info = db.prepare(
    'INSERT INTO user_images (filename, original_name, file_path, sha256, file_size) VALUES (?, ?, ?, ?, ?)'
  ).run(filename, original_name, filePath, sha256, buffer.length);

  const row = db.prepare('SELECT id, original_name, file_path, sha256, created_at FROM user_images WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

const VALID_IMAGE_TABLES = ['user_images', 'generated_images'];

imagesRouter.delete('/:id', (req, res) => {
  const { type } = req.query;
  const table = type === 'user' ? 'user_images' : 'generated_images';
  const otherTable = type === 'user' ? 'generated_images' : 'user_images';

  if (!VALID_IMAGE_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const db = getDb();

  // 获取要删除记录的 sha256 和文件路径
  const row = db.prepare(`SELECT sha256, file_path FROM ${table} WHERE id = ?`).get(req.params.id);
  if (row?.file_path) {
    // 检查另一张表是否还有相同 sha256 的引用，避免误删共享文件
    const otherRef = db.prepare(`SELECT COUNT(*) as c FROM ${otherTable} WHERE sha256 = ?`).get(row.sha256);
    if (otherRef.c === 0) {
      const filename = row.file_path.split('/').pop();
      const absolutePath = path.join(getUploadsDir(), filename);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  }

  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// 保留旧接口兼容性，但不再使用
imagesRouter.get('/:id/data', (req, res) => {
  res.status(410).json({ error: 'This endpoint is deprecated. Use file_path instead.' });
});
