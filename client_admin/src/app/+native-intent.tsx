// The Clerk SDK verifies and consumes the original callback. Routing never grants access.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'nearby-admin://app');
    const callbackPath = /(?:^|\/)hosted-auth-callback\/?$/.test(url.pathname);
    const callbackHost = !['http:', 'https:'].includes(url.protocol) && (url.hostname === 'hosted-auth-callback'
      || url.hostname === 'callback' || (url.protocol === 'clerk:' && url.hostname.endsWith('.hosted-callback')));
    if (callbackPath || callbackHost) return '/login';
  } catch { /* Let Expo Router handle unrelated links. */ }
  return path;
}
