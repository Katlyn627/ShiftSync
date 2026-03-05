import mongoose from 'mongoose';

let connected = false;

export function isConnected() {
  return connected;
}

/**
 * Returns true when the error is a DNS SRV lookup failure.
 * This happens when the network blocks SRV records, which are required by
 * mongodb+srv:// URIs.  Retrying will never help, so we surface a targeted
 * fix right away.
 */
function isSrvError(err) {
  // 'querySrv' is Node.js's DNS SRV lookup function — its presence in the
  // error message unambiguously identifies an SRV record resolution failure.
  return err.message.includes('querySrv');
}

export function buildConnectionErrorMessage(err) {
  const lines = [
    `\n❌  MongoDB connection failed: ${err.message}`,
    '──────────────────────────────────────────────────────',
  ];

  if (isSrvError(err)) {
    lines.push(
      '  Your network cannot resolve MongoDB Atlas SRV records.',
      '  Use the Standard (non-SRV) connection string instead:',
      '',
      '  1. In Atlas, click Connect → Drivers.',
      '  2. Change "Connection method" to "Standard connection string".',
      '  3. Copy the URI (starts with mongodb://, not mongodb+srv://).',
      '  4. Set it in server/.env:',
      '     MONGODB_URI=mongodb://<user>:<password>@<host1>:27017,<host2>:27017/<dbname>?ssl=true&replicaSet=<rs>&authSource=admin',
    );
  } else {
    lines.push(
      '  Fix: set MONGODB_URI in server/.env, for example:',
      '  MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shiftsync',
      '  or use a Standard connection string if SRV is blocked by your network:',
      '  MONGODB_URI=mongodb://<user>:<password>@<host>:27017/shiftsync?ssl=true&authSource=admin',
    );
  }

  lines.push('──────────────────────────────────────────────────────\n');
  return lines.join('\n');
}

export async function connectDb({ retries = 5, retryDelayMs = 5000 } = {}) {
  if (connected) return;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shiftsync';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri);
      connected = true;
      console.log('Connected to MongoDB:', uri.replace(/\/\/.*@/, '//***@'));
      return;
    } catch (err) {
      // SRV DNS failures will never resolve with more retries — fail fast.
      if (isSrvError(err)) throw err;

      if (attempt === retries) throw err;
      console.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`
      );
      console.warn(`Retrying in ${retryDelayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function closeDb() {
  if (connected) {
    await mongoose.connection.close();
    connected = false;
  }
}
