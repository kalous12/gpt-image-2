import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getUploadsDir } from './db.js';
import { syncMaterials } from './sync-materials.js';
import { settingsRouter } from './routes/settings.js';
import { imagesRouter } from './routes/images.js';
import { materialsRouter } from './routes/materials.js';
import { generateRouter, startPoller } from './routes/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

initDb();

// Serve uploads images as static files
app.use('/uploads', express.static(getUploadsDir(), {
  maxAge: '1d',
  etag: true
}));

// Serve materials images as static files
app.use('/materials/images', express.static(path.join(__dirname, '..', 'materials', 'images'), {
  maxAge: '7d',
  etag: true
}));

syncMaterials();

app.use('/api/settings', settingsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api', generateRouter);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
  // 启动后端轮询
  startPoller();
});
server.on('error', (err) => console.error('Server error:', err));
