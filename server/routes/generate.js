import { Router } from 'express';
import { getDb } from '../db.js';

export const generateRouter = Router();

generateRouter.post('/generate', async (req, res) => {
  const { prompt, resolution, size, n, image_urls } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const db = getDb();
  const apikeyRow = db.prepare("SELECT value FROM settings WHERE key = 'apikey'").get();
  if (!apikeyRow?.value) return res.status(400).json({ error: '请先设置 API Key' });

  const info = db.prepare(
    `INSERT INTO generated_images (prompt, status, resolution, size, ref_image_ids)
     VALUES (?, 'generating', ?, ?, ?)`
  ).run(prompt, resolution || '1k', size || '1:1', JSON.stringify(image_urls || []));

  const genId = info.lastInsertRowid;

  try {
    const body = {
      model: 'gpt-image-2',
      prompt,
      n: n || 1,
      size: size || '1:1',
      resolution: resolution || '1k',
    };
    if (image_urls?.length) body.image_urls = image_urls;

    const resp = await fetch('https://api.apimart.ai/v1/images/generations', {
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
      headers: { Authorization: `Bearer ${apikeyRow?.value || ''}` },
    });
    const json = await resp.json();

    const genRow = db.prepare('SELECT id FROM generated_images WHERE task_id = ?').get(id);

    if (json.code === 200 && json.data?.status === 'completed') {
      const imageUrl = json.data.result?.images?.[0]?.url?.[0];
      if (genRow && imageUrl) {
        db.prepare(
          "UPDATE generated_images SET status = 'completed', filename = ? WHERE task_id = ?"
        ).run(imageUrl, id);
      }
    } else if (json.data?.status === 'failed') {
      if (genRow) {
        db.prepare("UPDATE generated_images SET status = 'failed' WHERE task_id = ?").run(id);
      }
    }

    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
