import mongoose from 'mongoose';

let connected = false;

export function isConnected() {
  return connected;
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
