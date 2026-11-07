import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';

export const isExpoGo = () => Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

export function hostedAuthOptions(mode: 'sign-in' | 'sign-up' = 'sign-in') {
  // Expo Go owns exp://; installed builds retain Clerk's native callback defaults.
  return { mode, ...(isExpoGo() ? { redirectUrl: makeRedirectUri({ path: 'hosted-auth-callback', isTripleSlashed: false }) } : {}) };
}

export function hostedAuthResultMessage(result: { createdSessionId: string | null; authSessionResult: { type: string } | null }) {
  if (result.createdSessionId) return '';
  if (!result.authSessionResult) return 'Clerk is still connecting. Wait a moment, then try again.';
  if (['cancel', 'dismiss'].includes(result.authSessionResult.type)) return 'Sign-in was cancelled before it completed. You can try again.';
  return `Clerk could not finish sign-in (${result.authSessionResult.type}). Please try again.`;
}

export function hostedAuthErrorMessage(cause: unknown) {
  const error = cause as { errors?: { longMessage?: string; message?: string }[]; message?: string } | null;
  return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || 'Unable to open secure sign-in. Check your connection and try again.';
}
