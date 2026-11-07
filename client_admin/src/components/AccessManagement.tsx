import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAdminAccess } from '../auth/AdminAccessContext';
import { useAppTheme } from '../AppearanceContext';
import { Card, Heading, Info, Pill, useAdminStyles } from './AdminUI';

const appPermissions = {
  Customer: ['Browse catalogue and shops', 'Cart and checkout', 'Orders and payments', 'Wishlist and reviews', 'Addresses and profile', 'Notifications'],
  Shop: ['Shop dashboard and insights', 'Add and edit own products', 'Product images (up to 5)', 'Update own stock', 'View own orders and delivery status', 'Advertisements', 'Shop profile'],
  Delivery: ['Delivery dashboard', 'Assigned orders only', 'Pickup status', 'Delivery status', 'GPS directions', 'Delivery history', 'Profile'],
  Admin: ['Overview and reports', 'Orders and status', 'Shops and approvals', 'Products and inventory', 'Customer accounts', 'Delivery accounts and assignments', 'Advertisements', 'Access and permissions'],
} as const;
type App = keyof typeof appPermissions;
type Status = 'Pending' | 'Active' | 'Suspended' | 'Revoked';
type Account = { id: string; name: string; email: string; app: App; status: Status; scope: string; permissions: string[] };
type Event = { id: number; detail: string; time: string };
const apps = Object.keys(appPermissions) as App[];
const initialAccounts: Account[] = apps.map(app => ({
  id: `sample-${app}`, name: `${app} preview account`, email: `${app.toLowerCase()}@example.invalid`,
  app, status: 'Pending', scope: app === 'Shop' ? 'One assigned shop' : app === 'Delivery' ? 'Assigned orders only' : app === 'Customer' ? 'Own account and orders' : 'Marketplace administration',
  permissions: [...appPermissions[app]],
}));
const Context = createContext<{ accounts: Account[]; events: Event[]; save: (account: Account) => void } | null>(null);

export function AccessManagementProvider({ children }: PropsWithChildren) {
  const { preview } = useAdminAccess();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [events, setEvents] = useState<Event[]>([]);
  function save(account: Account) {
    // Local preview only. Never treat these records as server authorization.
    if (!preview) return;
    setAccounts(current => current.some(item => item.id === account.id)
      ? current.map(item => item.id === account.id ? account : item) : [...current, account]);
    setEvents(current => [{ id: (current[0]?.id ?? 0) + 1, detail: `${account.name} · ${account.app} · ${account.status} · ${account.permissions.length} permissions`, time: new Date().toLocaleTimeString() }, ...current].slice(0, 30));
  }
  return <Context.Provider value={{ accounts, events, save }}>{children}</Context.Provider>;
}

export default function AccessManagement() {
  const state = useContext(Context);
  const { preview } = useAdminAccess();
  const { colors: c } = useAppTheme();
  const s = useAdminStyles();
  const [app, setApp] = useState<App>('Customer');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status | 'All'>('All');
  const [draft, setDraft] = useState<Account | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!state) throw Error('AccessManagementProvider is required.');
  const { accounts, events, save } = state;
  const visible = accounts.filter(item => item.app === app && (status === 'All' || item.status === status)
    && `${item.name} ${item.email} ${item.scope}`.toLowerCase().includes(query.trim().toLowerCase()));
  function button(label: string, action: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[s.filter, { minHeight: 44, opacity: disabled ? 0.45 : 1 }]}><Text style={s.link}>{label}</Text></Pressable>;
  }
  function edit(account: Account) { setError(''); setConfirm(false); setDraft({ ...account, permissions: [...account.permissions] }); }
  function review() {
    if (!draft || !preview) return;
    if (!draft.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) || !draft.scope.trim()) {
      setError('Enter a name, valid email, and access scope.'); return;
    }
    if (accounts.some(item => item.id !== draft.id && item.app === draft.app && item.email.toLowerCase() === draft.email.trim().toLowerCase())) {
      setError('This email already has a preview record for this app.'); return;
    }
    if (draft.status === 'Active' && !draft.permissions.length) { setError('Select at least one permission for active access.'); return; }
    setError(''); setConfirm(true);
  }
  return <View style={s.stack}>
    <Info title={preview ? 'Access controls · Frontend preview' : 'Live access management is not connected'} copy={preview
      ? 'Try approvals, suspension, revocation and individual permissions below. Changes affect these sample records only, reset after logout or reload, and never change another app’s access.'
      : 'Permission options are shown for planning. Your server has no account listing, approval or permission-update APIs yet, so real account controls are disabled.'} />
    <View style={s.grid}>{apps.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: app === item }} onPress={() => { setApp(item); setQuery(''); setStatus('All'); }} style={[s.card, s.gridCard, { borderColor: app === item ? c.accent : c.border }]}>
      <Text style={s.cardTitle}>{item === 'Customer' ? 'Customer app' : `${item} app`}</Text>
      <Text style={s.copy}>{appPermissions[item].length} access options</Text>
      <Pill>{item === app ? 'Selected' : 'View permissions →'}</Pill>
    </Pressable>)}</View>
    <Heading title={`${app} access options`} />
    <Card>{appPermissions[app].map(permission => <View key={permission} style={s.rowBetween}><Text style={s.copy}>{permission}</Text><Pill>Permission option</Pill></View>)}</Card>
    <Heading title={preview ? 'Preview accounts' : 'Account controls'} />
    {preview ? <>
      <View style={s.rowBetween}><Text style={s.copy}>Grant, restrict or revoke access per account and app.</Text>{button('Add preview account', () => edit({ id: `preview-${app}-${accounts.length + 1}`, name: '', email: '', app, status: 'Pending', scope: initialAccounts.find(item => item.app === app)!.scope, permissions: [...appPermissions[app]] }))}</View>
      <TextInput accessibilityLabel="Search preview accounts" placeholder="Search name, email or scope" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={s.search} />
      <View style={s.filters}>{(['All', 'Pending', 'Active', 'Suspended', 'Revoked'] as const).map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: status === item }} onPress={() => setStatus(item)} style={[s.filter, status === item && s.filterActive]}><Text style={{ color: status === item ? c.onPrimary : c.text }}>{item}</Text></Pressable>)}</View>
      {visible.map(account => <Card key={account.id}><View style={s.rowBetween}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{account.name}</Text><Text style={s.copy}>{account.email}</Text></View><Pill warning={account.status === 'Suspended' || account.status === 'Revoked'}>{account.status}</Pill></View><Text style={s.small}>{account.scope} · {account.status === 'Active' ? account.permissions.length : 0} effective preview permissions</Text>{button(`Manage ${account.app.toLowerCase()} access`, () => edit(account))}</Card>)}
      {!visible.length ? <Info title="No matching preview accounts" copy="Change your search or status filter, or add a preview account." /> : null}
    </> : <Info title="Server connection required" copy="Account search, role grants, shop approval, driver approval, suspension and revocation must use protected server endpoints. The signed-in admin’s existing access remains verified by the server." />}
    <Heading title="Access activity" />
    {events.length ? events.map(event => <Card key={event.id}><Text style={s.copy}>{event.detail}</Text><Text style={s.small}>{event.time} · Local preview change</Text></Card>) : <Text style={s.copy}>No preview access changes this session.</Text>}
    {notice ? <Text accessibilityLiveRegion="polite" style={s.link}>{notice}</Text> : null}
    <Modal visible={!!draft} transparent animationType="fade" onRequestClose={() => { setDraft(null); setConfirm(false); }}>
      <View style={s.modalShade}><View accessibilityViewIsModal style={s.modal}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.stack}>
        <View style={s.rowBetween}><Text style={s.cardTitle}>{confirm ? 'Confirm preview access' : `Manage ${draft?.app} access`}</Text>{button('Close', () => { setDraft(null); setConfirm(false); })}</View>
        <Pill>Preview only · No account will be invited</Pill>
        {draft && !confirm ? <>
          <Text style={s.copy}>Name</Text><TextInput accessibilityLabel="Account name" value={draft.name} onChangeText={name => setDraft({ ...draft, name })} style={s.search} />
          <Text style={s.copy}>Email</Text><TextInput accessibilityLabel="Account email" autoCapitalize="none" keyboardType="email-address" value={draft.email} onChangeText={email => setDraft({ ...draft, email })} style={s.search} />
          <Text style={s.copy}>Access scope (shop, service area or own records)</Text><TextInput accessibilityLabel="Access scope" value={draft.scope} onChangeText={scope => setDraft({ ...draft, scope })} style={s.search} />
          <Text style={s.cardTitle}>Account status</Text><View style={s.filters}>{(['Pending', 'Active', 'Suspended', 'Revoked'] as const).map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: draft.status === item }} onPress={() => setDraft({ ...draft, status: item })} style={[s.filter, draft.status === item && s.filterActive]}><Text style={{ color: draft.status === item ? c.onPrimary : c.text }}>{item}</Text></Pressable>)}</View>
          <Text style={s.small}>Active grants the selected preview permissions. Pending, Suspended and Revoked grant none.</Text>
          <View style={s.row}>{button('Select all', () => setDraft({ ...draft, permissions: [...appPermissions[draft.app]] }))}{button('Clear all', () => setDraft({ ...draft, permissions: [] }))}</View>
          {appPermissions[draft.app].map(permission => <Pressable key={permission} accessibilityRole="checkbox" accessibilityLabel={permission} accessibilityState={{ checked: draft.permissions.includes(permission) }} onPress={() => setDraft({ ...draft, permissions: draft.permissions.includes(permission) ? draft.permissions.filter(item => item !== permission) : [...draft.permissions, permission] })} style={[s.filter, { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }]}><Text style={s.link}>{draft.permissions.includes(permission) ? '☑' : '☐'}</Text><Text style={[s.copy, { flex: 1 }]}>{permission}</Text></Pressable>)}
          {error ? <Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text> : null}
          {button('Review preview changes', review, !preview)}
        </> : draft ? <>
          <Text style={s.cardTitle}>{draft.name} · {draft.app}</Text><Text style={s.copy}>{draft.email}</Text><Text style={s.copy}>{draft.scope}</Text><Pill>{draft.status}</Pill>
          <Text style={s.copy}>{draft.status === 'Active' ? draft.permissions.join(' · ') : 'No effective permissions while this account is inactive.'}</Text>
          <Text style={s.small}>This saves a local sample only. It does not create a Clerk account or grant real app access.</Text>
          <View style={s.row}>{button('Back', () => setConfirm(false))}{button('Save preview changes', () => { save({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase(), scope: draft.scope.trim() }); setNotice('Preview access updated. Real account access was not changed.'); setDraft(null); setConfirm(false); }, !preview)}</View>
        </> : null}
      </ScrollView></View></View>
    </Modal>
  </View>;
}
