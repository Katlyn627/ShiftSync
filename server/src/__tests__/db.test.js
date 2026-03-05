/**
 * Tests for server/src/db.js
 *
 * Uses the Node.js built-in test runner (node:test) — no extra dependencies
 * required.  The in-memory-fallback tests rely on mongodb-memory-server which
 * is already listed in devDependencies.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConnectionErrorMessage,
  connectDb,
  closeDb,
  isConnected,
} from '../db.js';

// ── buildConnectionErrorMessage ───────────────────────────────────────────────

describe('buildConnectionErrorMessage', () => {
  it('includes the original error message', () => {
    const err = new Error('connection refused');
    const msg = buildConnectionErrorMessage(err);
    assert.ok(msg.includes('connection refused'), 'should echo the error message');
  });

  it('shows SRV-specific options (A, B, C) for querySrv errors', () => {
    const err = new Error('querySrv ECONNREFUSED _mongodb._tcp.cluster0.example.mongodb.net');
    const msg = buildConnectionErrorMessage(err);
    assert.ok(msg.includes('Option A'), 'should include Option A');
    assert.ok(msg.includes('Option B'), 'should include Option B');
    assert.ok(msg.includes('Option C'), 'should include Option C');
    assert.ok(msg.includes('mongodb://'), 'Option B should show a standard URI example');
  });

  it('does NOT show SRV options for non-SRV errors', () => {
    const err = new Error('authentication failed');
    const msg = buildConnectionErrorMessage(err);
    assert.ok(!msg.includes('Option A'), 'should not show Option A for non-SRV errors');
    assert.ok(msg.includes('MONGODB_URI'), 'should still mention MONGODB_URI');
  });

  it('always wraps the message with separator lines', () => {
    const err = new Error('any error');
    const msg = buildConnectionErrorMessage(err);
    assert.ok(msg.includes('──────────────────────────────────────────────────────'));
  });
});

// ── connectDb / closeDb with automatic in-memory fallback ─────────────────────

describe('connectDb (in-memory fallback)', () => {
  before(async () => {
    // Ensure MONGODB_URI is not set so the auto in-memory fallback activates.
    delete process.env.MONGODB_URI;
    // retries:1 + retryDelayMs:0 so we skip straight to the fallback without
    // waiting for the 5 × 5 s default retry cycle.
    await connectDb({ retries: 1, retryDelayMs: 0 });
  });

  it('connects successfully via the in-memory fallback', () => {
    assert.ok(isConnected(), 'isConnected() should be true after connectDb()');
  });

  it('isConnected() returns false after closeDb()', async () => {
    await closeDb();
    assert.strictEqual(isConnected(), false);
  });
});
