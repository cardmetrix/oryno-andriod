import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';

/**
 * Native OAuth return URL for Clerk Google / Apple SSO.
 * Must be allowlisted in Clerk Dashboard → Native applications.
 *
 * Examples:
 * - Dev build / production: oryno://sso-callback
 * - Expo Go: exp://192.168.x.x:8081/--/sso-callback
 */
export function getOAuthRedirectUrl() {
  return AuthSession.makeRedirectUri({
    scheme: 'oryno',
    path: 'sso-callback',
  });
}

/** Human-readable redirect for setup docs / debug. */
export function getOAuthRedirectUrlPreview() {
  return getOAuthRedirectUrl() || Linking.createURL('sso-callback', { scheme: 'oryno' });
}
