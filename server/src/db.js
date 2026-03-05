import { MongoClient, ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';

let connected = false;
let mongoClient = null;
// Holds the MongoMemoryServer instance when the automatic in-memory fallback is active.
let memoryServer = null;

export function isConnected() {
  return connected;
}

/**
 * Returns the native MongoClient instance once connectDb() has succeeded,
 * or null if called before a successful connection.
 * Useful for operations that require the low-level driver (e.g. aggregations
 * that use Atlas-specific commands or the Stable API).
 */
export function getMongoClient() {
  return mongoClient;
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

/**
 * Attempts to start an in-memory MongoDB instance using mongodb-memory-server.
 * Only activates outside of production so that the optional devDependency is
 * never required in a production build.
 *
 * Returns { uri, mongod } on success, or null if unavailable.
 */
async function startInMemoryFallback() {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    // getUri() returns something like mongodb://127.0.0.1:PORT/ — append the db name.
    const uri = `${mongod.getUri()}shiftsync`;
    console.warn(
      '\n⚠️  WARNING: Cannot reach a real MongoDB instance.\n' +
      '   Falling back to an IN-MEMORY database — data will NOT persist between restarts.\n' +
      '   To use a real database, set MONGODB_URI in server/.env\n'
    );
    return { uri, mongod };
  } catch {
    // mongodb-memory-server not available (e.g. a production install without devDeps).
    return null;
  }
}

export async function connectDb({ retries = 5, retryDelayMs = 5000 } = {}) {
  if (connected) return;

  // If MONGODB_URI is explicitly set, use it; otherwise default to localhost
  // and allow an automatic in-memory fallback on failure.
  const explicitUri = process.env.MONGODB_URI;
  const uri = explicitUri || 'mongodb://localhost:27017/shiftsync';

  // Use the MongoDB Stable API (ServerApiVersion.v1) so that Atlas commands
  // behave consistently across server upgrades.  The native MongoClient is
  // created first; Mongoose then reuses the same URI and options.
  const clientOptions = {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  };

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Connect the native driver client.
      const client = new MongoClient(uri, clientOptions);
      await client.connect();

      // Connect Mongoose using the same URI and serverApi options so that
      // model-level operations also run under the Stable API.
      // If Mongoose fails, close the native client to avoid a resource leak.
      try {
        await mongoose.connect(uri, clientOptions);
      } catch (mongooseErr) {
        await client.close();
        throw mongooseErr;
      }

      mongoClient = client;
      connected = true;
      console.log('Connected to MongoDB:', uri.replace(/\/\/.*@/, '//***@'));
      return;
    } catch (err) {
      lastError = err;
      // SRV DNS failures will never resolve with more retries — stop immediately.
      if (isSrvError(err)) break;

      if (attempt === retries) break;
      console.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`
      );
      console.warn(`Retrying in ${retryDelayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  // When the caller did not configure an explicit MONGODB_URI, automatically
  // fall back to an in-memory MongoDB instance so the app stays functional
  // regardless of network access or Atlas availability.
  if (!explicitUri) {
    const fallback = await startInMemoryFallback();
    if (fallback) {
      try {
        // Reset any partial Mongoose state from the failed attempts above.
        await mongoose.disconnect();
        // The in-memory server is a plain MongoDB binary — no Stable API needed.
        const client = new MongoClient(fallback.uri);
        await client.connect();
        await mongoose.connect(fallback.uri);
        mongoClient = client;
        memoryServer = fallback.mongod;
        connected = true;
        return;
      } catch (fallbackErr) {
        // Fallback also failed; stop the memory server and fall through to throw.
        await fallback.mongod.stop().catch(() => {});
      }
    }
  }

  throw lastError;
}

export async function closeDb() {
  if (connected) {
    await mongoose.connection.close();
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
    }
    if (memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
    connected = false;
  }
}
