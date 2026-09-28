const PRODUCTION_API_URL = 'https://www.orynoafrica.com';
/** Documented mobile surface on oryno-website (Bearer JWT + rewrite). */
const PRODUCTION_API_PREFIX = '/api/external/v1';

function normalizeBaseUrl(url: string | undefined) {
  return (url || PRODUCTION_API_URL).replace(/\/$/, '');
}

/**
 * Apex host 308s → www and React Native drops Authorization on redirect.
 * Always prefer the canonical www host in release / when apex is configured.
 */
function canonicalizeApiUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === 'orynoafrica.com') {
      u.hostname = 'www.orynoafrica.com';
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    // keep as-is
  }
  return url;
}

/** LAN / loopback hosts — fine for local `expo start`, never for store/APK builds. */
function isLocalDevApi(url: string) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?/i.test(
    url,
  );
}

const configuredApiUrl = canonicalizeApiUrl(
  normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL),
);
const configuredPrefix =
  process.env.EXPO_PUBLIC_API_PREFIX?.replace(/\/$/, '') || '';

/**
 * Release/preview builds always hit the live website API.
 * Local `expo start` (`__DEV__`) may still use a LAN URL from `.env`.
 */
export const API_BASE_URL =
  !__DEV__ && isLocalDevApi(configuredApiUrl)
    ? PRODUCTION_API_URL
    : configuredApiUrl;

/**
 * Production builds use `/api/external/v1` (Clerk Bearer → website handlers).
 * Local dev can keep `/api` against a LAN Next server.
 */
export const API_PREFIX =
  !__DEV__
    ? configuredPrefix.startsWith('/api/external')
      ? configuredPrefix
      : PRODUCTION_API_PREFIX
    : configuredPrefix || '/api';

export const PREFER_EXTERNAL_API =
  process.env.EXPO_PUBLIC_PREFER_EXTERNAL_API === '1' ||
  API_PREFIX.startsWith('/api/external');

export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  '';
