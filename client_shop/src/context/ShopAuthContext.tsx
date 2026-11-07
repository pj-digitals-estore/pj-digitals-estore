import { createContext, useContext, type PropsWithChildren } from 'react';
import { useAuth, useClerk } from '../live/clerkHooks';

type Account = { id: string; shopName: string; email: string };
const Context = createContext<{ account: Account | null; logout: () => void } | null>(null);

// Explicit preview mode uses a real Clerk session but sample business records.
// Live mode separately requires server-confirmed shop ownership and approval.
export function ShopAuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const clerk = useClerk();
  const account: Account | null = isLoaded && isSignedIn && userId
    ? { id: userId, shopName: 'Preview shop', email: clerk.user?.primaryEmailAddress?.emailAddress ?? '' } : null;
  return <Context.Provider value={{ account, logout: () => { void clerk.signOut(); } }}>{children}</Context.Provider>;
}

export function useShopAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('ShopAuthProvider is required');
  return value;
}
