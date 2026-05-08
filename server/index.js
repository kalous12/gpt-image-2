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
