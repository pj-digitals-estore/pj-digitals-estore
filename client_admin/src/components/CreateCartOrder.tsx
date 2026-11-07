import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../AppearanceContext';
import type { AdminOrdersApi, CartPreview, OrderAddress } from '../services/adminOrders';

export default function CreateCartOrder({ api, onClose, onCreated, onCheckOrders }: { api: AdminOrdersApi; onClose: () => void; onCreated: (id: string) => void; onCheckOrders: () => void }) {
  const { colors: c } = useAppTheme();
  const [cart, setCart] = useState<CartPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [method, setMethod] = useState<'cod' | 'razorpay'>('razorpay');
  const [address, setAddress] = useState<OrderAddress>({ name: '', phone: '', street: '', city: 'Thodupuzha', state: 'Kerala', zipCode: '', country: 'India' });
  const checkoutKey = useRef<string | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const initial = setTimeout(async () => {
      setLoading(true); setError('');
      try { const value = await api.cart(controller.signal); if (!controller.signal.aborted) setCart(value); }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load your cart.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(initial); controller.abort(); mounted.current = false; };
  }, [api, attempt]);
  function change(field: keyof OrderAddress, value: string) { setAddress(current => ({ ...current, [field]: value })); checkoutKey.current = null; }
  function validate() {
    if (!cart?.items.length || cart.items.some(item => !item.available)) { setError('Your signed-in cart must contain available products.'); return; }
    if (!address.name.trim() || address.street.trim().length < 5 || !/^\+?\d{10,15}$/.test(address.phone.trim()) || !/^\d{6}$/.test(address.zipCode.trim())) { setError('Enter a recipient, full street address, valid phone and six-digit pincode.'); return; }
    setError(''); setReview(true);
  }
  async function create() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    checkoutKey.current ??= Crypto.randomUUID();
    try {
      const clean = Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])) as OrderAddress;
      const id = await api.create(clean, checkoutKey.current, method);
      if (mounted.current) onCreated(id);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Creation was not confirmed. Check My account orders before retrying.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const copy = { color: c.muted, lineHeight: 21, fontSize: 13 };
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(10,15,30,0.5)' }}><View accessibilityViewIsModal style={{ maxWidth: 560, width: '100%', maxHeight: '100%', alignSelf: 'center', backgroundColor: c.surface, padding: 22, borderRadius: 20 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
    <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{review ? 'Review order from your cart' : 'Create from my cart'}</Text>
    <Text style={copy}>This route creates an order for the signed-in admin account’s cart. It does not place an order on behalf of another customer or mark any payment as paid.</Text>
    {loading ? <ActivityIndicator color={c.primary} /> : cart ? <>
      <Text style={{ color: c.text, fontWeight: '700' }}>Your cart · {cart.items.length} product lines</Text>
      {cart.items.map((item, index) => <Text key={index} style={copy}>{item.name} × {item.quantity} · ₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>)}
      <Text style={copy}>Cart subtotal: ₹{cart.total.toLocaleString('en-IN')}. The server calculates the final order amount and delivery charges.</Text>
      {!cart.items.length ? <Text style={{ color: c.red }}>Your cart is empty. Add products using the customer app with this same Clerk account first.</Text> : null}
      {review ? <>
        <Text style={{ color: c.text }}>{address.name}{'\n'}{address.phone}{'\n'}{address.street}, {address.city}, {address.state} · {address.zipCode}</Text><Text style={copy}>{method === 'cod' ? 'Cash on Delivery' : 'Online payment · Razorpay'} selected. Any returned payment state remains subject to server confirmation.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void create()} style={{ padding: 16, borderRadius: 12, backgroundColor: c.primary, opacity: busy ? 0.5 : 1 }}><Text style={{ color: c.onPrimary, textAlign: 'center', fontWeight: '700' }}>{busy ? 'Creating order…' : 'Create order from my cart'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setReview(false)} style={{ padding: 12 }}><Text style={{ color: c.primaryText }}>Back to address</Text></Pressable>
      </> : <>
        {(['name', 'phone', 'street', 'zipCode'] as const).map(field => <View key={field} style={{ gap: 6 }}><Text style={copy}>{{ name: 'Recipient name', phone: 'Phone', street: 'Street address', zipCode: 'Pincode' }[field]}</Text><TextInput accessibilityLabel={field} value={address[field]} onChangeText={value => change(field, value)} keyboardType={field === 'phone' ? 'phone-pad' : field === 'zipCode' ? 'number-pad' : 'default'} style={{ minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, backgroundColor: c.bg, color: c.text }} /></View>)}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Thodupuzha', 'Muttom'].map(city => <Pressable key={city} accessibilityRole="radio" accessibilityState={{ checked: city === address.city }} onPress={() => change('city', city)} style={{ padding: 12, borderRadius: 12, backgroundColor: city === address.city ? c.primary : c.soft }}><Text style={{ color: city === address.city ? c.onPrimary : c.text }}>{city}</Text></Pressable>)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['cod', 'razorpay'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: method === value }} onPress={() => { setMethod(value); checkoutKey.current = null; }} style={{ padding: 12, borderRadius: 12, backgroundColor: value === method ? c.primary : c.soft }}><Text style={{ color: value === method ? c.onPrimary : c.text }}>{value === 'cod' ? 'Cash on Delivery' : 'Online payment'}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" disabled={!cart.items.length} onPress={validate} style={{ padding: 16, backgroundColor: c.primary, borderRadius: 12, opacity: cart.items.length ? 1 : 0.5 }}><Text style={{ color: c.onPrimary, textAlign: 'center' }}>Review order</Text></Pressable>
      </>}
    </> : null}
    {error ? <><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text>{!cart ? <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ padding: 12 }}><Text style={{ color: c.primaryText }}>Retry cart</Text></Pressable> : <Pressable accessibilityRole="button" disabled={busy} onPress={onCheckOrders} style={{ padding: 12 }}><Text style={{ color: c.primaryText }}>Check My account orders</Text></Pressable>}</> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ padding: 12 }}><Text style={{ color: c.primaryText, textAlign: 'center' }}>Close</Text></Pressable>
  </ScrollView></View></View></Modal>;
}
