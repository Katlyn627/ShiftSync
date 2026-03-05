import crypto from 'crypto';

// Generate a cryptographically random JWT secret for the test environment.
// This ensures tests use a proper signed secret and suppresses the
// "JWT_SECRET not set" warning that appears when auth.ts is imported.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}
