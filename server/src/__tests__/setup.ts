import crypto from 'crypto';

// Generate a cryptographically random JWT secret for the test environment.
// This ensures tests use a proper signed secret and suppresses the
// "JWT_SECRET not set" warning that appears when auth.ts is imported.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

// Use a low bcrypt cost factor in tests so that seeding 200+ employees
// completes well within the beforeAll timeout (cost 4 ≈ 6 ms per hash vs
// ~100 ms at the production default of 10).
if (!process.env.BCRYPT_ROUNDS) {
  process.env.BCRYPT_ROUNDS = '4';
}
