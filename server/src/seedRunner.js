import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDb, closeDb, buildConnectionErrorMessage } from './db.js';
import { seedDemoData } from './seed.js';

console.log('Connecting to MongoDB...');

connectDb()
  .then(() => seedDemoData())
  .then(() => {
    console.log('Seeding complete.');
    return closeDb();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(buildConnectionErrorMessage(err));
    process.exit(1);
  });
