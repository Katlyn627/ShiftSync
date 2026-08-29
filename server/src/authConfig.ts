export interface AuthRuntimeConfig {
  nodeEnv: string;
  jwtSecret: string;
  sessionSecret: string;
  clientUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  googleOAuthEnabled: boolean;
}

const DEV_JWT_FALLBACK = 'shiftsync-secret-key-change-in-production';
const DEV_SESSION_FALLBACK = 'shiftsync-session-secret-change-in-production';

const INSECURE_JWT_VALUES = new Set([
  '',
  DEV_JWT_FALLBACK,
  'replace-with-a-strong-random-secret',
]);

const INSECURE_SESSION_VALUES = new Set([
  '',
  DEV_SESSION_FALLBACK,
  'replace-with-a-strong-random-session-secret',
]);

function readTrimmed(value: string | undefined): string {
  return (value ?? '').trim();
}

function failConfig(message: string): never {
  throw new Error(`[Auth Config] ${message}`);
}

export function resolveAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const rawJwtSecret = readTrimmed(env.JWT_SECRET);
  const rawSessionSecret = readTrimmed(env.SESSION_SECRET);

  if (isProduction) {
    if (INSECURE_JWT_VALUES.has(rawJwtSecret)) {
      failConfig('Invalid JWT_SECRET for production. Set a strong non-default value.');
    }
    if (INSECURE_SESSION_VALUES.has(rawSessionSecret)) {
      failConfig('Invalid SESSION_SECRET for production. Set a strong non-default value.');
    }
  }

  const googleClientId = readTrimmed(env.GOOGLE_CLIENT_ID);
  const googleClientSecret = readTrimmed(env.GOOGLE_CLIENT_SECRET);

  if ((googleClientId && !googleClientSecret) || (!googleClientId && googleClientSecret)) {
    failConfig('Google OAuth misconfigured: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be provided together or both omitted.');
  }

  const googleCallbackUrl = readTrimmed(env.GOOGLE_CALLBACK_URL) || '/api/auth/google/callback';
  const clientUrl = readTrimmed(env.CLIENT_URL) || 'http://localhost:3000';

  const jwtSecret = rawJwtSecret || DEV_JWT_FALLBACK;
  const sessionSecret = rawSessionSecret || DEV_SESSION_FALLBACK;

  return {
    nodeEnv,
    jwtSecret,
    sessionSecret,
    clientUrl,
    googleClientId,
    googleClientSecret,
    googleCallbackUrl,
    googleOAuthEnabled: Boolean(googleClientId && googleClientSecret),
  };
}
