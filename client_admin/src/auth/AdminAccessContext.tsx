import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth, useClerk, useUser } from './clerkHooks';
import { verifyAdmin } from './verifyAdmin';
import { ApiError } from '../lib/api';

type Verification = { principal: string; status: 'checking' | 'allowed' | 'denied' | 'error'; message?: string };
type Access = { getToken?: () => Promise<string | null>; ready: boolean; signedIn: boolean; allowed: boolean; status: Verification['status']; message: string; email: string; retry: () => void; signOut: () => Promise<void>; preview: false };
const Context = createContext<Access | null>(null);

export function AdminAccessProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const principal = isSignedIn && userId && sessionId ? `${userId}:${sessionId}` : '';
  const [verification, setVerification] = useState<Verification | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [signingOutPrincipal, setSigningOutPrincipal] = useState('');
  const retry = useCallback(() => { setSigningOutPrincipal(''); setAttempt(value => value + 1); }, []);
  useEffect(() => {
    if (!isLoaded || !principal || signingOutPrincipal === principal) return;
    let active = true;
    let request: AbortController | null = null;
    async function check(quiet = false) {
      if (request) return;
      const controller = new AbortController(); request = controller;
      setVerification(previous => quiet && previous?.principal === principal && previous.status === 'allowed' ? previous : { principal, status: 'checking' });
      const timer = setTimeout(() => {
        controller.abort();
        if (active) setVerification({ principal, status: 'error', message: 'Access verification timed out. Check your connection and retry.' });
      }, 16000);
      try {
        const token = await getToken({ skipCache: true });
        if (!active || controller.signal.aborted) return;
        if (!token) throw new ApiError(401);
        await verifyAdmin(token, controller.signal);
        if (active && !controller.signal.aborted) setVerification({ principal, status: 'allowed' });
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        const denied = cause instanceof ApiError && (cause.status === 401 || cause.status === 403);
        setVerification({ principal, status: denied ? 'denied' : 'error', message: denied
          ? 'This account does not currently have verified admin access. Sign in with an approved admin account, or ask the platform owner to grant access.'
          : 'Unable to verify admin access with the server. The dashboard remains locked. Check your connection and retry.' });
      } finally { clearTimeout(timer); if (request === controller) request = null; }
    }
    void check();
    const timer = setInterval(() => { if (!AppState.currentState || AppState.currentState === 'active') void check(true); }, 60000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void check(true); });
    return () => { active = false; request?.abort(); clearInterval(timer); listener.remove(); };
  }, [isLoaded, principal, getToken, attempt, signingOutPrincipal]);
  const signOut = useCallback(async () => {
    setSigningOutPrincipal(principal);
    setVerification({ principal, status: 'checking' });
    try { await clerk.signOut(); }
    catch { setVerification({ principal, status: 'error', message: 'Sign-out could not finish. The dashboard is locked. Please try signing out again.' }); }
  }, [clerk, principal]);
  const current = verification?.principal === principal ? verification : null;
  const allowed = !!isLoaded && !!principal && signingOutPrincipal !== principal && current?.status === 'allowed';
  return <Context.Provider value={{ preview: false, getToken, ready: !!isLoaded, signedIn: !!isSignedIn, allowed, status: current?.status || 'checking', message: current?.message || '', email: user?.primaryEmailAddress?.emailAddress || '', retry, signOut }}>{children}</Context.Provider>;
}
export function useAdminAccess() { const access = useContext(Context); if (!access) throw new Error('AdminAccessProvider is required.'); return access; }
