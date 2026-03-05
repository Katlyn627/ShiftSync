import mongoose from 'mongoose';

let connected = false;

export async function connectDb() {
  if (connected) return;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shiftsync';
  await mongoose.connect(uri);
  connected = true;
  console.log('Connected to MongoDB:', uri.replace(/\/\/.*@/, '//***@'));
}

export async function closeDb() {
  if (connected) {
    await mongoose.connection.close();
    connected = false;
  }
}
