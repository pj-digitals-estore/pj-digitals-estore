import { createContext, useContext, type PropsWithChildren } from 'react';
import { useAuth, useClerk, useUser } from '../auth/clerkHooks';

type Partner = { id: string; name: string; email: string };
const Context = createContext<{ partner: Partner | null; ready: boolean; logout: () => Promise<void>; getToken: () => Promise<string | null> } | null>(null);
export function DeliveryAuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const clerk = useClerk();
  const ready = isLoaded && userLoaded;
  const partner: Partner | null = ready && isSignedIn && userId
    ? { id: userId, name: user?.fullName || user?.username || 'Delivery partner', email: user?.primaryEmailAddress?.emailAddress || '' } : null;
  return <Context.Provider value={{ partner, ready, getToken, logout: () => clerk.signOut() }}>{children}</Context.Provider>;
}
export function useDeliveryAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('DeliveryAuthProvider is required');
  return value;
}
