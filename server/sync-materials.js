import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

export function syncMaterials() {
  const db = getDb();
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
      // Construct image path matching the repo structure
      const imagePath = `materials/images/${category.toLowerCase()}_caseX/output.jpg`;
      insert.run(category, prompt, imagePath, author, url);
    }
  });

  tx(data);
  console.log(`Synced ${data.length} materials`);
}
