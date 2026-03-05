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
      '  Your network cannot resolve MongoDB Atlas SRV records (mongodb+srv://).',
      '  Choose one of the options below:',
      '',
      '  Option A – Fix your network:',
      '    Ensure DNS SRV queries are not blocked by a firewall, VPN, or proxy.',
      '',
      '  Option B – Use a Standard (non-SRV) connection string:',
      '    Atlas no longer exposes a "Standard connection string" option in its',
      '    Connect → Drivers dialog.  Build the URI from your cluster hostname:',
      '    1. Your SRV host is something like:',
      '         cluster0.y65eu9h.mongodb.net',
      '    2. The individual shard hosts follow this pattern:',
      '         cluster0-shard-00-00.y65eu9h.mongodb.net:27017',
      '         cluster0-shard-00-01.y65eu9h.mongodb.net:27017',
      '         cluster0-shard-00-02.y65eu9h.mongodb.net:27017',
      '    3. Set the standard URI in server/.env:',
      '       MONGODB_URI=mongodb://<user>:<pass>@<shard0>:27017,<shard1>:27017,<shard2>:27017/<db>?ssl=true&replicaSet=atlas-<cluster-id>-shard-0&authSource=admin',
      '       (replace <cluster-id> with the alphanumeric ID from your hostname, e.g. y65eu9h)',
      '',
      '  Option C – Use a local MongoDB instance for development:',
      '    MONGODB_URI=mongodb://localhost:27017/shiftsync',
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
