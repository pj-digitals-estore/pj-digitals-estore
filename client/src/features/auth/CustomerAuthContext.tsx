import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react';

type Customer = { name: string; email: string };
type PreviewAccount = Customer & { password: string };
const demo: PreviewAccount = { name: 'Anu Mathew', email: 'customer@nearby.demo', password: 'NearByDemo123!' };
const Context = createContext<{ customer: Customer | null; signIn: (email: string, password: string) => void; signUp: (name: string, email: string, password: string) => void; signOut: () => void } | null>(null);

export function CustomerAuthProvider({ children }: PropsWithChildren) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  // Preview accounts exist only in memory; no backend or persistent passwords.
  const accounts = useRef<PreviewAccount[]>([demo]);
  function signIn(email: string, password: string) {
    const account = accounts.current.find(item => item.email === email.trim().toLowerCase() && item.password === password);
    if (!account) throw new Error('Email or password does not match. Create a preview account or use customer@nearby.demo / NearByDemo123!');
    setCustomer({ name: account.name, email: account.email });
  }
  function signUp(name: string, email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const existing = accounts.current.find(item => item.email === normalized);
    if (existing) {
      if (normalized === demo.email && password === demo.password) { signIn(normalized, password); return; }
      throw new Error('This email already has a preview account. Please sign in instead.');
    }
    const account = { name: name.trim(), email: normalized, password };
    accounts.current.push(account);
    setCustomer({ name: account.name, email: account.email });
  }
  return <Context.Provider value={{ customer, signIn, signUp, signOut: () => setCustomer(null) }}>{children}</Context.Provider>;
}
export function useCustomerAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('CustomerAuthProvider is required');
  return value;
}
