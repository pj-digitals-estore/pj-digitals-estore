import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { hostedAuthErrorMessage, hostedAuthOptions, hostedAuthResultMessage } from './hostedAuth';

export function useHostedSignIn() {
  const { isLoaded } = useAuth();
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function signIn() {
    if (!isLoaded || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await startHostedAuth(hostedAuthOptions());
      if (mounted.current) setError(hostedAuthResultMessage(result));
    } catch (cause) {
      if (mounted.current) setError(hostedAuthErrorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, signIn, ready: !!isLoaded };
}
