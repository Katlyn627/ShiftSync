import { resolveAuthRuntimeConfig } from '../authConfig';

describe('auth runtime configuration', () => {
  test('accepts easy local development configuration without explicit secrets', () => {
    const config = resolveAuthRuntimeConfig({
      NODE_ENV: 'development',
      JWT_SECRET: '',
      SESSION_SECRET: '   ',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    });

    expect(config.jwtSecret).toBe('shiftsync-secret-key-change-in-production');
    expect(config.sessionSecret).toBe('shiftsync-session-secret-change-in-production');
    expect(config.googleOAuthEnabled).toBe(false);
  });

  test('rejects missing production secrets', () => {
    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: 'production',
        JWT_SECRET: '',
        SESSION_SECRET: '',
      })
    ).toThrow(/JWT_SECRET/i);

    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'strong-random-jwt-secret',
        SESSION_SECRET: '',
      })
    ).toThrow(/SESSION_SECRET/i);
  });

  test('rejects insecure default production secrets', () => {
    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'shiftsync-secret-key-change-in-production',
        SESSION_SECRET: 'strong-random-session-secret',
      })
    ).toThrow(/JWT_SECRET/i);

    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'strong-random-jwt-secret',
        SESSION_SECRET: 'replace-with-a-strong-random-session-secret',
      })
    ).toThrow(/SESSION_SECRET/i);
  });

  test('rejects partial Google OAuth configuration', () => {
    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: 'development',
        GOOGLE_CLIENT_ID: 'client-id-only',
        GOOGLE_CLIENT_SECRET: '',
      })
    ).toThrow(/provided together|both omitted/i);

    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: 'development',
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: 'client-secret-only',
      })
    ).toThrow(/provided together|both omitted/i);
  });

  test('keeps Google OAuth optional when both credentials are absent', () => {
    const config = resolveAuthRuntimeConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'strong-random-jwt-secret',
      SESSION_SECRET: 'strong-random-session-secret',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      CLIENT_URL: '',
      GOOGLE_CALLBACK_URL: '',
    });

    expect(config.googleOAuthEnabled).toBe(false);
    expect(config.clientUrl).toBe('http://localhost:3000');
    expect(config.googleCallbackUrl).toBe('/api/auth/google/callback');
  });
});
