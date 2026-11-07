import { useMemo, useRef, useState } from 'react';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import LinearGradient from '../components/DeliveryGradient';
import { useAppTheme, type ThemePalette } from '../AppearanceContext';
import RightNavigation from '../components/RightNavigation';
import DeliveryAccountSettings from '../auth/DeliveryAccountSettings';
import BrandLogo from '../components/BrandLogo';

type Tab = 'Home' | 'Jobs' | 'Profile';
type JobState = 'Assigned' | 'Picked up' | 'On the way' | 'Delivered';
type DeliveryJob = { id: string; customer: string; phone: string; shop: string; address: string; area: string; items: number; amount: number; state: JobState; eta: string };
const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const initialJobs: DeliveryJob[] = [
  { id: 'TDP-1046', customer: 'Meera Joseph', phone: '+91 ••••• 4821', shop: 'SR Electrics', address: 'Rose Villa, near St. Mary’s Church', area: 'Muttom', items: 2, amount: 2499, state: 'On the way', eta: '12 min' },
  { id: 'TDP-1043', customer: 'Akhil Thomas', phone: '+91 ••••• 9304', shop: 'Thodupuzha Textiles', address: 'Green Park Apartments, Block B', area: 'Thodupuzha', items: 1, amount: 1899, state: 'Assigned', eta: '25 min' },
  { id: 'TDP-1041', customer: 'Nina Paul', phone: '+91 ••••• 1176', shop: 'VV Electricals', address: 'Market Road, opposite bus stand', area: 'Thodupuzha', items: 3, amount: 3248, state: 'Picked up', eta: '18 min' },
];

export default function DeliveryScreen() {
  const { colors: C, mode, setMode } = useAppTheme(); const { s, d } = useMemo(() => createDeliveryStyles(C), [C]);

  const { partner, logout } = useDeliveryAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const pageScroll = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('Home');
  const [jobs, setJobs] = useState(initialJobs);
  const [online, setOnline] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const activeJobs = useMemo(() => jobs.filter((job) => job.state !== 'Delivered'), [jobs]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const pickups = activeJobs.filter(job => job.state === 'Assigned');
  const completed = jobs.filter(job => job.state === 'Delivered');
  const nextJob = activeJobs.find(job => job.state === 'On the way') || activeJobs[0];
  function advanceJob(id: string) {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, state: job.state === 'Assigned' ? 'Picked up' : job.state === 'Picked up' ? 'On the way' : 'Delivered' } : job));
    setNotice('Demo delivery status updated.');
  }
  function openJob(id: string) { setSelectedJobId(id); setTab('Jobs'); }
  async function openGPS(job: DeliveryJob, pickup: boolean) {
    const destination = pickup ? `${job.shop}, ${job.area}, Idukki, Kerala, India` : `${job.address}, ${job.area}, Idukki, Kerala, India`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;
    try { await Linking.openURL(url); }
    catch { setNotice('Could not open maps. Please try again or open your maps app.'); }
  }
  function jobAction(job: DeliveryJob) { return job.state === 'Assigned' ? 'Confirm pickup' : job.state === 'Picked up' ? 'Start delivery' : job.state === 'On the way' ? 'Mark delivered' : 'Delivered'; }

  return <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
    <ScrollView ref={pageScroll} style={{ flex: 1 }} contentContainerStyle={[s.page, { paddingTop: 12 }]}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingRight: 64, marginBottom: 20 }}><BrandLogo size={46} /><View style={{ flex: 1 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>NearBy Delivery</Text><Text style={s.caption}>Thodupuzha & Muttom</Text></View></View>
      {notice ? <TouchableOpacity onPress={() => setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}  ×</Text></TouchableOpacity> : null}
      {tab === 'Home' ? <>
        <View style={d.greeting}><Text style={d.overline}>YOUR DAILY OVERVIEW</Text><Text style={d.greetingTitle}>Hello, {partner?.name.split(' ')[0] || 'there'}.</Text><Text style={s.caption}>Local shops. Familiar roads. Happy doorsteps.</Text></View>
        <LinearGradient colors={C.gradient} style={s.hero}><View style={d.heroRing} /><Text style={s.heroEyebrow}>ROOTED HERE. MOVING FORWARD.</Text><Text style={s.heroTitle}>{activeJobs.length ? 'A little closer to every doorstep.' : 'Every doorstep, delivered.'}</Text><Text style={s.heroCopy}>{activeJobs.length ? `${activeJobs.length} deliveries on your route. Let’s keep things moving.` : 'You’re all caught up with your assigned deliveries.'}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setSelectedJobId(nextJob?.id || null); setTab('Jobs'); }} style={d.heroButton}><Text style={d.heroButtonText}>{nextJob ? 'Continue your route' : 'View deliveries'}  →</Text></TouchableOpacity>
        </LinearGradient>
        <View style={d.metrics}>{[{ value: pickups.length, label: 'To pick up', mark: '↗' }, { value: activeJobs.length - pickups.length, label: 'On the road', mark: '→' }, { value: completed.length, label: 'Delivered', mark: '✓' }].map(metric => <View key={metric.label} style={d.metric}><Text style={d.metricIcon}>{metric.mark}</Text><Text style={d.metricValue}>{String(metric.value).padStart(2, '0')}</Text><Text style={d.metricLabel}>{metric.label}</Text></View>)}</View>
        <View style={[s.card, { marginBottom: 18 }]}>
          <Text style={s.label}>GPS NAVIGATION</Text>
          <Text style={s.cardTitle}>{nextJob ? (nextJob.state === 'Assigned' ? 'Find your pickup shop' : 'Navigate to the next doorstep') : 'Your route is complete'}</Text>
          <Text style={s.caption}>{nextJob ? `${nextJob.state === 'Assigned' ? nextJob.shop : nextJob.address} · ${nextJob.area}` : 'Directions will be available when you have an active delivery.'}</Text>
          {nextJob ? <TouchableOpacity accessibilityRole="button" onPress={() => { void openGPS(nextJob, nextJob.state === 'Assigned'); }} style={s.outlineButton}><Text style={s.outlineText}>⌖  Open GPS navigation</Text></TouchableOpacity> : null}
          <Text style={[s.caption, { marginTop: 10 }]}>Opens maps for directions from your current location. These orders use sample addresses.</Text>
        </View>
        <View style={s.sectionHead}><View style={{ flex: 1 }}><Text style={s.title}>Your route ahead</Text><Text style={s.caption}>Pickup to doorstep, one stop at a time.</Text></View><TouchableOpacity accessibilityRole="button" onPress={() => { setSelectedJobId(null); setTab('Jobs'); }} style={d.seeAll}><Text style={s.link}>View all →</Text></TouchableOpacity></View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
          {activeJobs.slice(0, 2).map((job) => <View key={job.id} style={{ flex: wide ? 1 : undefined, minWidth: 0 }}><JobCard job={job} onOpen={() => openJob(job.id)} onAdvance={() => advanceJob(job.id)} action={jobAction(job)}/></View>)}
        </View>
        {!activeJobs.length ? <Empty title="Your route is complete" copy="All assigned deliveries have been completed." /> : null}
        {!online ? <View style={s.offlineNote}><Text style={s.offlineTitle}>You are offline</Text><Text style={s.caption}>You will not receive new delivery assignments until you go online.</Text></View> : null}
      </> : null}
      {tab === 'Jobs' ? <>
        {selectedJob ? <>
          <TouchableOpacity onPress={() => setSelectedJobId(null)} style={s.back}><Text style={s.link}>← All deliveries</Text></TouchableOpacity>
          <Text style={s.title}>Delivery details</Text><Text style={s.caption}>{selectedJob.id} · {selectedJob.items} {selectedJob.items === 1 ? 'item' : 'items'} · {selectedJob.eta} ETA</Text>
          <View style={s.progress}>{(['Assigned', 'Picked up', 'On the way', 'Delivered'] as JobState[]).map((step, index) => <View key={step} style={s.progressStep}><View style={[s.progressDot, (['Assigned', 'Picked up', 'On the way', 'Delivered'] as JobState[]).indexOf(selectedJob.state) >= index && s.progressDotOn]}><Text style={s.progressDotText}>{index + 1}</Text></View><Text style={[s.progressText, selectedJob.state === step && s.progressTextOn]}>{step}</Text></View>)}</View>
          <View style={s.card}><Text style={s.label}>PICK UP FROM</Text><Text style={s.cardTitle}>{selectedJob.shop}</Text><Text style={s.caption}>Shop pickup point · {selectedJob.area}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { void openGPS(selectedJob, true); }} style={s.outlineButton}><Text style={s.outlineText}>⌖  GPS to pickup shop</Text></TouchableOpacity></View>
          <View style={s.card}><Text style={s.label}>DELIVER TO</Text><Text style={s.cardTitle}>{selectedJob.customer}</Text><Text style={s.caption}>{selectedJob.phone}</Text><Text style={s.address}>{selectedJob.address}</Text><Text style={s.caption}>{selectedJob.area}, Idukki</Text><TouchableOpacity onPress={() => setNotice('Calling is a demo action; connect the masked contact service.')} style={s.outlineButton}><Text style={s.outlineText}>Contact customer</Text></TouchableOpacity></View>
          <TouchableOpacity accessibilityRole="button" onPress={() => { void openGPS(selectedJob, false); }} style={[s.outlineButton, { marginTop: 0, marginBottom: 16 }]}><Text style={s.outlineText}>⌖  GPS to delivery address</Text></TouchableOpacity>
          <View style={s.card}><Text style={s.label}>ORDER SUMMARY</Text><View style={s.rowBetween}><Text style={s.caption}>{selectedJob.items} items · Customer payment</Text><Text style={s.money}>{rupees(selectedJob.amount)}</Text></View><Text style={s.caption}>Payment collection instructions will appear here from the order.</Text></View>
          {selectedJob.state !== 'Delivered' ? <TouchableOpacity onPress={() => advanceJob(selectedJob.id)} style={s.primaryButton}><Text style={s.primaryButtonText}>{jobAction(selectedJob)}</Text></TouchableOpacity> : <View style={s.deliveredBanner}><Text style={s.deliveredText}>✓ Delivery completed</Text></View>}
        </> : <><PageTitle title="My deliveries" subtitle="Assigned jobs and their current status."/>{activeJobs.length ? activeJobs.map((job) => <JobCard key={job.id} job={job} onOpen={() => openJob(job.id)} onAdvance={() => advanceJob(job.id)} action={jobAction(job)}/>) : <Empty title="No active deliveries" copy="New assigned jobs will appear here."/>}<Text style={s.sectionSubhead}>Completed today</Text>{jobs.filter((job) => job.state === 'Delivered').map((job) => <JobCard key={job.id} job={job} onOpen={() => openJob(job.id)} onAdvance={() => {}} action="Delivered"/>)}</>}
      </> : null}
      {tab === 'Profile' ? <><PageTitle title="Delivery profile" subtitle="Your account and working preferences."/><DeliveryAccountSettings /><View style={{ height: 18 }} /><View style={s.card}><Text style={s.label}>WORK SETTINGS</Text><ProfileRow title="Availability" value={online ? 'Online' : 'Offline'} onPress={() => setOnline((value) => !value)}/><ProfileRow title="Service area" value="Thodupuzha, Idukki"/><ProfileRow title="Vehicle" value="Two-wheeler"/><ProfileRow title="Support" value="Help centre" onPress={() => setNotice('Support contact will connect to the backend service.')}/></View><View style={s.note}><Text style={s.cardTitle}>Delivery preview</Text><Text style={s.caption}>Your personal profile is managed by Clerk. Jobs, service area and vehicle details remain samples; delivery access and documents are not verified by a backend yet.</Text></View></> : null}
      <Text style={s.disclaimer}>Frontend demo · Sample jobs only · Status updates are not sent to dispatch.</Text>
    </ScrollView>
    <RightNavigation mode={mode} onModeChange={setMode} brand={<BrandLogo size={48} />} title="Delivery partner" subtitle="NearBy · Thodupuzha & Muttom" active={tab} colors={{ glass: C.glass, text: C.text, muted: C.muted, accent: C.gold, border: C.border, selected: C.primary, selectedText: C.onPrimary, warning: C.red }} items={[{ id: 'Home', label: 'Home', icon: '⌂' }, { id: 'Jobs', label: 'My deliveries', icon: '▤', badge: activeJobs.length }, { id: 'Profile', label: 'Profile', icon: '○' }]} onSelect={id => { setTab(id as Tab); setSelectedJobId(null); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} onLogout={() => { void logout().catch(() => setNotice('Could not sign out. Please try again.')); }}>
      <TouchableOpacity onPress={() => setOnline(value => !value)} accessibilityRole="switch" accessibilityLabel="Delivery availability" accessibilityState={{ checked: online }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.soft, borderRadius: 14, padding: 16, marginBottom: 12, minHeight: 52 }}><View style={[s.dot, !online && s.dotOff]} /><Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: '600' }}>Availability</Text><Text style={{ color: online ? C.success : C.red, fontSize: 12 }}>{online ? 'Online' : 'Offline'}</Text></TouchableOpacity>
    </RightNavigation>
  </SafeAreaView>;
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors: C } = useAppTheme(); const { s } = useMemo(() => createDeliveryStyles(C), [C]);
 return <View style={s.pageTitle}><Text style={s.title}>{title}</Text><Text style={s.caption}>{subtitle}</Text></View>; }
function JobCard({ job, onOpen, onAdvance, action }: { job: DeliveryJob; onOpen: () => void; onAdvance: () => void; action: string }) {
  const { colors: C } = useAppTheme(); const { s, d } = useMemo(() => createDeliveryStyles(C), [C]);

 const done = job.state === 'Delivered';
 return <View style={s.jobCard}>
   <View style={s.rowBetween}><Text style={s.jobId}>{job.id}</Text><Status label={job.state}/></View>
   <View style={d.routeStop}><View style={d.stopMarker}><Text style={d.stopSymbol}>↗</Text></View><View style={{ flex: 1 }}><Text style={d.stopLabel}>PICKUP</Text><Text style={s.cardTitle}>{job.shop}</Text><Text style={s.caption}>{job.area}</Text></View></View>
   <View style={d.routeConnector} />
   <View style={d.routeStop}><View style={[d.stopMarker, { backgroundColor: C.tint }]}><Text style={[d.stopSymbol, { color: C.gold }]}>⌂</Text></View><View style={{ flex: 1 }}><Text style={d.stopLabel}>DELIVER TO</Text><Text style={s.cardTitle}>{job.customer}</Text><Text style={s.caption}>{job.address}</Text></View></View>
   <View style={s.jobFooter}><Text style={s.eta}>◷ {job.eta} · {job.items} {job.items === 1 ? 'item' : 'items'}</Text><View><Text style={d.stopLabel}>ORDER VALUE</Text><Text style={s.money}>{rupees(job.amount)}</Text></View></View>
   <View style={s.actions}><TouchableOpacity accessibilityRole="button" onPress={onOpen} style={s.secondaryButton}><Text style={s.secondaryText}>Details</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={onAdvance} disabled={done} style={[s.primarySmall, done && s.disabled]}><Text style={s.primaryButtonText}>{action}</Text></TouchableOpacity></View>
 </View>;
}
function Status({ label }: { label: string }) {
  const { colors: C } = useAppTheme(); const { s } = useMemo(() => createDeliveryStyles(C), [C]);
 const warm = label === 'Assigned'; return <View style={[s.status, warm ? s.statusWarm : label === 'Delivered' ? s.statusDone : s.statusCool]}><Text style={[s.statusText, warm ? s.warmText : s.coolText]}>{label}</Text></View>; }
function Empty({ title, copy }: { title: string; copy: string }) {
  const { colors: C } = useAppTheme(); const { s } = useMemo(() => createDeliveryStyles(C), [C]);
 return <View style={s.empty}><Text style={s.cardTitle}>{title}</Text><Text style={s.caption}>{copy}</Text></View>; }
function ProfileRow({ title, value, onPress }: { title: string; value: string; onPress?: () => void }) {
  const { colors: C } = useAppTheme(); const { s } = useMemo(() => createDeliveryStyles(C), [C]);
 return <TouchableOpacity disabled={!onPress} onPress={onPress} style={s.profileRow}><Text style={s.profileRowTitle}>{title}</Text><Text style={s.profileRowValue}>{value}{onPress ? '  ›' : ''}</Text></TouchableOpacity>; }

function createDeliveryStyles(C: ThemePalette) {
const base = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, brand: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: 3 }, onlinePill: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.soft }, offlinePill: { backgroundColor: C.warningSurface }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success }, dotOff: { backgroundColor: C.red }, onlineText: { color: C.primaryText, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }, offlineText: { color: C.red }, location: { minHeight: 31, marginHorizontal: 20, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 7 }, pin: { color: C.gold, fontSize: 10 }, locationText: { color: C.muted, fontSize: 10, fontWeight: '600', flex: 1 }, demoPill: { color: C.gold, backgroundColor: C.tint, overflow: 'hidden', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, letterSpacing: 0.6, fontWeight: '900' }, page: { paddingHorizontal: 18, paddingBottom: 26 }, notice: { padding: 11, marginBottom: 8, borderRadius: 10, backgroundColor: C.soft }, noticeText: { color: C.primaryText, fontSize: 11, fontWeight: '700' }, hero: { backgroundColor: C.primary, borderRadius: 16, padding: 18, marginTop: 5, marginBottom: 13 }, heroEyebrow: { color: C.gold, fontSize: 8, letterSpacing: 1, fontWeight: '900' }, heroTitle: { color: C.surface, fontSize: 21, fontWeight: '900', marginTop: 8 }, heroCopy: { color: C.soft, fontSize: 10, lineHeight: 16, marginTop: 5 }, heroStats: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', marginTop: 15, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroStatValue: { color: C.surface, fontSize: 14, fontWeight: '900' }, heroStatLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.6, marginTop: 3 }, heroDivider: { height: 28, width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 9 }, title: { color: C.text, fontSize: 20, fontWeight: '900' }, cardTitle: { color: C.text, fontSize: 12, fontWeight: '900' }, caption: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, link: { color: C.primaryText, fontSize: 10, fontWeight: '900' }, jobCard: { boxShadow: C.glow, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, jobId: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 }, status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 }, statusWarm: { backgroundColor: C.tint }, statusCool: { backgroundColor: C.soft }, statusDone: { backgroundColor: C.successSurface }, statusText: { fontSize: 8, fontWeight: '900' }, warmText: { color: C.gold }, coolText: { color: C.primary }, routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 7 }, routeDot: { color: C.primaryText, fontSize: 10 }, routeLine: { width: 22, height: 1, backgroundColor: C.border }, routePin: { color: C.red, fontSize: 9 }, addressPreview: { color: C.muted, flex: 1, fontSize: 9 }, jobFooter: { borderTopWidth: 1, borderColor: C.border, marginTop: 11, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eta: { color: C.muted, fontSize: 9, fontWeight: '700' }, money: { color: C.primaryText, fontSize: 12, fontWeight: '900' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }, primarySmall: { minHeight: 35, justifyContent: 'center', backgroundColor: C.primary, paddingHorizontal: 12, borderRadius: 9 }, primaryButton: { minHeight: 48, marginVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 11 }, primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, disabled: { backgroundColor: '#515875' }, secondaryButton: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: C.border, borderRadius: 9 }, secondaryText: { color: C.primaryText, fontSize: 10, fontWeight: '800' }, back: { paddingVertical: 10, alignSelf: 'flex-start' }, pageTitle: { marginTop: 12, marginBottom: 12 }, progress: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 }, progressStep: { alignItems: 'center', flex: 1 }, progressDot: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: C.border }, progressDotOn: { backgroundColor: C.primary }, progressDotText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' }, progressText: { color: C.muted, fontSize: 7, marginTop: 5, textAlign: 'center' }, progressTextOn: { color: C.primaryText, fontWeight: '900' }, card: { boxShadow: C.glow, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 13, padding: 14, marginBottom: 10 }, label: { color: C.gold, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }, outlineButton: { borderWidth: 1, borderColor: C.border, borderRadius: 9, alignItems: 'center', justifyContent: 'center', minHeight: 38, marginTop: 12 }, outlineText: { color: C.primaryText, fontSize: 10, fontWeight: '800' }, address: { color: C.text, fontSize: 12, fontWeight: '700', marginTop: 9 }, otpCard: { backgroundColor: C.tint, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 15, marginBottom: 10, alignItems: 'center' }, otp: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: 7, marginVertical: 4 }, deliveredBanner: { backgroundColor: C.soft, borderRadius: 10, alignItems: 'center', padding: 13, marginVertical: 10 }, deliveredText: { color: C.primaryText, fontWeight: '900', fontSize: 11 }, sectionSubhead: { color: C.text, fontSize: 13, fontWeight: '900', marginTop: 8, marginBottom: 9 }, pageTitleText: { color: C.text }, empty: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 24 }, offlineNote: { backgroundColor: C.warningSurface, borderRadius: 12, padding: 13, marginTop: 4 }, offlineTitle: { color: C.red, fontSize: 11, fontWeight: '900' }, profileCard: { boxShadow: C.glow, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 15, alignItems: 'center', padding: 20, marginBottom: 11 }, profileAvatar: { width: 59, height: 59, borderRadius: 30, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }, profileAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, profileName: { color: C.text, fontSize: 16, fontWeight: '900', marginTop: 9 }, rating: { flexDirection: 'row', alignItems: 'center', marginTop: 4 }, ratingText: { color: C.gold, fontSize: 10, fontWeight: '900' }, profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border }, profileRowTitle: { color: C.text, fontSize: 10, fontWeight: '700' }, profileRowValue: { color: C.primaryText, fontSize: 10, fontWeight: '800' }, note: { padding: 13, borderRadius: 12, backgroundColor: C.soft, marginTop: 2 }, earningRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border }, disclaimer: { color: C.muted, textAlign: 'center', fontSize: 8, marginTop: 16, marginBottom: 6 }, tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 4, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.surface }, tab: { minWidth: 62, alignItems: 'center', paddingVertical: 4, position: 'relative' }, tabIcon: { color: C.muted, fontSize: 17, lineHeight: 21 }, tabIconOn: { color: C.primary }, tabText: { color: C.muted, fontSize: 9, marginTop: 2 }, tabTextOn: { color: C.primaryText, fontWeight: '900' }, badge: { position: 'absolute', right: 4, top: 0, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
});

const d = StyleSheet.create({
  logo: { width: 40, height: 40, borderRadius: 11, backgroundColor: C.primary, borderBottomWidth: 3, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: C.text, fontFamily: 'serif', fontSize: 28 },
  greeting: { marginTop: 0, marginBottom: 15 },
  overline: { color: C.gold, letterSpacing: 2, fontSize: 10, fontWeight: '700' },
  greetingTitle: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.5, marginTop: 6, marginBottom: 3 },
  heroRing: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: 'rgba(169,194,255,0.28)', right: -85, top: -40 },
  heroButton: { alignSelf: 'flex-start', backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, marginTop: 15 },
  heroButtonText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginBottom: 18 },
  metric: { flex: 1, minWidth: 82, minHeight: 92, backgroundColor: C.surface, padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 10 },
  metricIcon: { color: C.gold, fontSize: 18, marginBottom: 8 },
  metricValue: { fontSize: 22, fontWeight: '800', color: C.text },
  metricLabel: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  seeAll: { paddingVertical: 12, paddingLeft: 10 },
  routeStop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 12 },
  stopMarker: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.soft, justifyContent: 'center', alignItems: 'center' },
  stopSymbol: { color: C.primaryText, fontSize: 22 },
  stopLabel: { color: C.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700', marginBottom: 5 },
  routeConnector: { height: 16, borderLeftWidth: 1, borderColor: C.border, marginLeft: 17, marginTop: 6, marginBottom: -6 },
});

const s = { ...base, ...StyleSheet.create({
  header: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  kicker: { color: C.gold, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  brand: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  onlinePill: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 24, backgroundColor: C.soft },
  onlineText: { color: C.primaryText, fontSize: 12, fontWeight: '700' },
  location: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 6, minHeight: 40, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  locationText: { color: C.muted, fontSize: 11, flex: 1 },
  page: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 16, paddingBottom: 24 },
  hero: { backgroundColor: C.primary, borderRadius: 14, padding: 16, marginBottom: 13, overflow: 'hidden', borderWidth: 1, borderColor: C.border, boxShadow: C.glow },
  heroEyebrow: { color: C.gold, fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  heroTitle: { color: C.heroText, fontWeight: '800', fontSize: 22, lineHeight: 29, marginTop: 8 },
  heroCopy: { color: C.heroMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  title: { color: C.text, fontSize: 23, fontWeight: '800' },
  caption: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 4 },
  cardTitle: { color: C.text, fontSize: 12, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  link: { color: C.primaryText, fontSize: 12, fontWeight: '700' },
  jobCard: { boxShadow: C.glow, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginBottom: 12 },
  jobId: { color: C.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  jobFooter: { borderTopWidth: 1, borderColor: C.border, marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eta: { color: C.muted, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  money: { color: C.primaryText, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  primarySmall: { flexGrow: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, paddingHorizontal: 12, borderRadius: 8 },
  primaryButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  secondaryButton: { minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  secondaryText: { color: C.primaryText, fontSize: 12, fontWeight: '700' },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tab: { flex: 1, maxWidth: 200, minHeight: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { color: C.muted, fontSize: 11, marginTop: 4 },
  tabIcon: { color: C.muted, fontSize: 22, lineHeight: 26 },
  disclaimer: { color: C.muted, textAlign: 'center', fontSize: 10, lineHeight: 17, marginTop: 20, marginBottom: 6 },
  card: { boxShadow: C.glow, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  label: { color: C.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  outlineButton: { borderWidth: 1, borderColor: C.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 9, minHeight: 40, marginTop: 12 },
  outlineText: { color: C.primaryText, fontSize: 12, fontWeight: '700' },
  address: { color: C.text, fontSize: 12, lineHeight: 18, fontWeight: '600', marginTop: 10 },
  pageTitle: { marginTop: 12, marginBottom: 15 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 8 },
  progress: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginVertical: 24 },
  progressDot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: C.border },
  progressDotText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  progressText: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 8, textAlign: 'center' },
  sectionSubhead: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 16 },
  profileCard: { boxShadow: C.glow, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 10, alignItems: 'center', padding: 18, marginBottom: 12 },
  profileName: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 14 },
  profileAvatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  profileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  profileRowTitle: { color: C.text, fontSize: 12, fontWeight: '600' },
  profileRowValue: { color: C.primaryText, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  ratingText: { color: C.gold, fontSize: 13, fontWeight: '700' },
  note: { padding: 18, borderRadius: 14, backgroundColor: C.soft, marginTop: 2 },
  empty: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 20 },
  notice: { padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: C.soft },
  noticeText: { color: C.primaryText, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  offlineTitle: { color: C.red, fontSize: 14, fontWeight: '700' },
  deliveredText: { color: C.primaryText, fontWeight: '700', fontSize: 14 },
  badge: { position: 'absolute', right: '25%', top: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
}) };


return { s, d };
}
