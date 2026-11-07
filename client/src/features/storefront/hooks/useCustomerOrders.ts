import { useCallback, useEffect, useRef, useState } from 'react';
import { useCustomerAuth } from '../../auth/CustomerAuthContext';
import { getUserOrders } from '@/services/orders';
import type { Order } from '../data/types';

export function useCustomerOrders(watching: boolean) {
  const { customer, ready, getToken } = useCustomerAuth();
  const owner = customer?.id;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const token = useRef(getToken); token.current = getToken;
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ owner: string; orders: Order[]; loaded: boolean; error: string; loading: boolean } | null>(null);
  const reload = useCallback(async () => {
    request.current?.abort();
    if (!owner || !ready) return;
    const controller = new AbortController(); request.current = controller;
    setState(previous => ({ owner, orders: previous?.owner === owner ? previous.orders : [], loaded: previous?.owner === owner && previous.loaded, error: '', loading: true }));
    try {
      const orders = await getUserOrders(() => token.current(), controller.signal);
      if (!controller.signal.aborted && currentOwner.current === owner) setState({ owner, orders, loaded: true, error: '', loading: false });
    } catch (cause) {
      if (!controller.signal.aborted && currentOwner.current === owner) setState(previous => ({ owner, orders: previous?.owner === owner ? previous.orders : [], loaded: previous?.owner === owner && previous.loaded, loading: false, error: cause instanceof Error ? cause.message : 'Unable to load orders.' }));
    }
  }, [owner, ready]);
  useEffect(() => {
    if (!owner) setState(null);
    void reload();
    // Refresh on entry and while the order list is open; no simulated statuses.
    const timer = watching && owner ? setInterval(() => { void reload(); }, 30000) : undefined;
    return () => { if (timer) clearInterval(timer); request.current?.abort(); };
  }, [reload, watching, owner]);
  const current = state?.owner === owner ? state : null;
  return { orders: current?.orders ?? [], loaded: current?.loaded ?? false, loading: current?.loading ?? false, error: current?.error ?? '', reload };
}
