import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { settingsRouter } from './routes/settings.js';
import { imagesRouter } from './routes/images.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

initDb();

app.use('/api/settings', settingsRouter);
app.use('/api/images', imagesRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
