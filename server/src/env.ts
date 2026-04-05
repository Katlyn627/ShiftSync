import dotenv from 'dotenv';
import path from 'path';

// Load .env before any other module reads process.env at module initialization
// time.  This file must be the first import in server/src/index.ts so that the
// require() for dotenv runs before every other module is required.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
