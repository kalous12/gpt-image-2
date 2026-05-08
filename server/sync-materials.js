import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

export function syncMaterials() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM materials').get();
  if (count.c > 0) return;

  const imagesDir = path.join(import.meta.dirname, '..', 'materials', 'images');
  const casesDir = path.join(import.meta.dirname, '..', 'materials', 'cases');
  const ingestedPath = path.join(import.meta.dirname, '..', 'materials', 'data', 'ingested_tweets.json');

  if (!fs.existsSync(imagesDir)) {
    console.log('Materials submodule not found, skipping sync');
    return;
  }

  // Load ingested tweets for URL and author mapping
  const ingested = fs.existsSync(ingestedPath)
    ? JSON.parse(fs.readFileSync(ingestedPath, 'utf-8')).records
    : [];

  // Build image_dir -> tweet_url mapping
  const urlByDir = {};
  const authorByDir = {};
  const categoryByDir = {};
  for (const item of ingested) {
    const dir = item.image_dir?.replace('images/', '') || '';
    if (dir) {
      urlByDir[dir] = item.tweet_url || '';
      authorByDir[dir] = item.author_handle || '';
      categoryByDir[dir] = item.category || '';
    }
  }

  // Parse markdown files to extract prompts
  const promptsByDir = {};
  const categoryFiles = {
    'portrait': 'portrait.md',
    'poster': 'poster.md',
    'ui': 'ui.md',
    'ecommerce': 'ecommerce.md',
    'ad-creative': 'ad-creative.md',
    'character': 'character.md',
    'comparison': 'comparison.md',
  };

  for (const [catKey, fileName] of Object.entries(categoryFiles)) {
    const filePath = path.join(casesDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Get case numbers from content
    const caseNumMatches = [...content.matchAll(/### Case (\d+):/g)];

    // Split by case headers
    const caseBlocks = content.split(/### Case \d+:/);

    for (let i = 0; i < caseNumMatches.length && i < caseBlocks.length - 1; i++) {
      const caseNum = caseNumMatches[i][1];
      const block = caseBlocks[i + 1];

      // Extract prompt from code block
      const promptMatch = block.match(/\*\*Prompt:\*\*\s*\n\n```\s*\n([\s\S]*?)\n```/);
      if (!promptMatch) continue;
      const prompt = promptMatch[1].trim();

      // Build directory name pattern
      const dirName = `${catKey}_case${caseNum}`;
      promptsByDir[dirName] = prompt;

      // Also try alternate naming patterns (e.g., ad-creative -> adcreative)
      const altDirName = `${catKey.replace(/-/g, '')}_case${caseNum}`;
      promptsByDir[altDirName] = prompt;
    }
  }

  // Scan actual image directories
  const entries = fs.readdirSync(imagesDir);
  const imageDirs = entries.filter(e => {
    const fullPath = path.join(imagesDir, e);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'output.jpg'));
  });

  const insert = db.prepare(
    'INSERT INTO materials (category, prompt_text, image_path, author, source_url) VALUES (?, ?, ?, ?, ?)'
  );

  const tx = db.transaction((items) => {
    for (const item of items) {
      insert.run(item.category, item.prompt, item.imagePath, item.author, item.url);
    }
  });

  const toInsert = imageDirs.map(dir => {
    // Extract category from directory name as fallback
    const match = dir.match(/^(.+?)_case\d+$/);
    const catKey = match ? match[1] : dir;

    // Map category key to display name
    const categoryMap = {
      'portrait': 'Portrait',
      'poster': 'Poster',
      'ui': 'UI',
      'ecommerce': 'E-commerce',
      'ad': 'Ad',
      'adcreative': 'Ad',
      'character': 'Character',
      'comparison': 'Comparison',
      'case': 'Case',
    };
    const displayCategory = categoryByDir[dir] || categoryMap[catKey.toLowerCase()] || catKey.charAt(0).toUpperCase() + catKey.slice(1);

    return {
      category: displayCategory,
      prompt: promptsByDir[dir] || '',
      imagePath: `materials/images/${dir}/output.jpg`,
      author: authorByDir[dir] || '',
      url: urlByDir[dir] || '',
    };
  });

  tx(toInsert);
  console.log(`Synced ${toInsert.length} materials from images directory`);
}