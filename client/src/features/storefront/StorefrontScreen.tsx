import ProductGallery from './components/ProductGallery';
import * as Crypto from 'expo-crypto';
import { checkoutConfig, placeCashOnDeliveryOrder, startCheckout, cancelCheckout } from '@/services/checkout';
import { preparePaymentWindow } from '@/services/paymentWindow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import WebStoreHeader from './components/WebStoreHeader';
import CustomerNotifications, { NotificationBell, type CustomerNotification } from './components/CustomerNotifications';
import OrderStatusCard from './components/OrderStatusCard';
import OrderDetails from './components/OrderDetails';
import NotificationToast from './components/NotificationToast';
import { createWebStyles } from './styles/webStyles';
import Text from './components/AppText';
import HomeShops from './components/HomeShops';
import HomeProducts from './components/HomeProducts';
import InterfaceIcon from './components/InterfaceIcon';
import AnimatedAd from './components/AnimatedAd';
import ProductReviews, { type ProductReview } from './components/ProductReviews';
import ProductPhoto from './components/ProductPhoto';
import PaymentSection, { type PaymentMethod } from './components/PaymentSection';
import AddressBook, { type DeliveryAddress } from './components/AddressBook';
import SearchSuggestions from './components/SearchSuggestions';
import { useStoreTheme } from './ThemeContext';
import { CategoryPicker, ProductGrid, StorePicker } from './components/ShopComponents';
import { categories, getStore as fallbackStore, money, sortOptions } from './data/catalog';
import { createStyles } from './styles/appStyles';
import type { CategoryFilter, DeliveryLocation, Product, StoreId, Tab } from './data/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import AccountSettings from '../auth/AccountSettings';
import { useCatalogue } from './hooks/useCatalogue';
import { useCustomerCart, type BasketLine } from './hooks/useCustomerCart';
import { useCustomerOrders } from './hooks/useCustomerOrders';

export default function StorefrontScreen() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const { customer, signOut, getToken } = useCustomerAuth();
  const checkoutEnabled = process.env.EXPO_PUBLIC_ENABLE_LIVE_CHECKOUT === 'true';
  const [paymentConfig, setPaymentConfig] = useState({ enabled: false, mode: 'test' });
  const [paying, setPaying] = useState(false);
  const paymentLock = useRef(false);
  const checkoutKey = useRef<string | null>(null);
  useEffect(() => { if (!checkoutEnabled) return; let active = true; void checkoutConfig().then(config => { if (active) setPaymentConfig(config); }).catch(() => { if (active) setPaymentConfig({ enabled: false, mode: 'test' }); }); return () => { active = false; }; }, [checkoutEnabled]);
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const [tab, setTabState] = useState<Tab>('Home');
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [toastQueue, setToastQueue] = useState<CustomerNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const notificationSequence = useRef(0);
  const unreadNotifications = notifications.filter(item => !item.read).length;
  useEffect(() => { const reset = setTimeout(() => { setNotifications([]); setToastQueue([]); setNotificationsOpen(false); setSelectedOrderId(null); }, 0); return () => clearTimeout(reset); }, [customer?.id]);
  const notify = useCallback((title: string, message: string, target: CustomerNotification['target']) => {
    const item: CustomerNotification = { id: `${Date.now()}-${++notificationSequence.current}`, title, message, target, createdAt: Date.now(), read: false };
    setNotifications(current => [item, ...current].slice(0, 50));
    setToastQueue(current => [...current, item].slice(-5));
  }, [setNotifications, setToastQueue]);
  const setTab = useCallback((next: Tab) => {
    if (Platform.OS === 'web' && next === 'Account') {
      router.push('/account' as Href);
      return;
    }
    setTabState(next);
  }, []);
  const pageScroll = useRef<ScrollView>(null);
  useEffect(() => { pageScroll.current?.scrollTo({ y: 0, animated: false }); }, [tab]);
  const scrollToTop = useCallback(() => { pageScroll.current?.scrollTo({ y: 0, animated: false }); }, []);


  function continueToPayment() {
    if (!customer) { router.push({ pathname: '/signup', params: { returnTo: 'payment' } }); return; }
    if (!basket.synced || basket.busy) { setNotice('Wait for your saved cart to load, and resolve any cart errors before checkout.'); setTab('Cart'); return; }
    setTab('Payment'); scrollToTop();
  }

  async function logout() {
    try { await signOut(); } catch { setNotice('Unable to sign out. Please try again.'); return; }
    basket.discardGuest(); setFavorites([]); setAddresses([]);
    setSelectedAddressId(null); setRecentViews([]);
    setAddressReturnTab('Home'); setSelectedProduct(null); setTab('Home');
    setDrawerOpen(false); drawerProgress.setValue(0);
    router.setParams({ checkout: undefined });
    scrollToTop();
    setNotice('You are logged out. You can continue browsing.');
  }
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation>('Thodupuzha, Idukki');
  const catalogue = useCatalogue(checkoutEnabled ? deliveryLocation : undefined);
  const { products, stores } = catalogue;
  const getStore = useCallback((id: StoreId) => stores.find(store => store.id === id) ?? fallbackStore(id), [stores]);
  const basket = useCustomerCart(products);
  const orderFeed = useCustomerOrders(tab === 'Orders');
  const { orders } = orderFeed;
  const refreshing = catalogue.loading || (tab === 'Orders' && orderFeed.loading);
  const [refreshVersion, setRefreshVersion] = useState(0);
  async function refreshPage() { await Promise.all([catalogue.reload(), orderFeed.reload()]); basket.reload(); setRefreshVersion(value => value + 1); }
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [locationOpen, setLocationOpen] = useState(false);
  const [drawerProgress] = useState(() => new Animated.Value(0));
  const { palette, mode, setMode } = useStoreTheme();
  const styles = useMemo(() => {
    const base = createStyles(palette);
    return Platform.OS === 'web' ? createWebStyles(base, width) : base;
  }, [palette, width]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [productReviews, setProductReviews] = useState<Record<string, ProductReview[]>>({});
  const previousOrderStatuses = useRef<{ owner?: string; loaded: boolean; values: Map<string, string> } | null>(null);
  useEffect(() => {
    const previous = previousOrderStatuses.current;
    const values = new Map(orders.filter(order => order.status).map(order => [order.id, order.status!]));
    previousOrderStatuses.current = { owner: customer?.id, loaded: orderFeed.loaded, values };
    if (!orderFeed.loaded || !previous?.loaded || previous.owner !== customer?.id) return;
    for (const order of orders) {
      if (order.status && previous.values.get(order.id) !== order.status) {
        notify(`Order ${order.status.toLowerCase()}`, `Order ${order.orderNumber || order.id}: ${order.status}. Open My orders for details.`, 'Orders');
      }
    }
  }, [orders, orderFeed.loaded, customer?.id, notify]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressReturnTab, setAddressReturnTab] = useState<Tab>('Home');
  function selectAddress(id: string) {
    setSelectedAddressId(id);
    if (addressReturnTab === 'Payment') {
      setTab('Payment');
      scrollToTop();
    }
  }
  const [recentViews, setRecentViews] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<string>('Featured');
  const [storeId, setStoreId] = useState<StoreId>('all');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [storeCategory, setStoreCategory] = useState<'Electronics' | 'Textiles' | 'Home Appliances' | 'Computer Items'>('Electronics');
  const [search, setSearch] = useState('');
  const [supermarketSearch, setSupermarketSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);

  useEffect(() => {
    if (checkout !== 'payment') return;
    const update = setTimeout(() => {
      if (customer) { setSelectedProduct(null); setTab('Payment'); scrollToTop(); }
      router.setParams({ checkout: undefined });
    }, 0);
    return () => clearTimeout(update);
  }, [checkout, customer, setTab, scrollToTop]);
  const locationShops = stores.filter(store => store.location === deliveryLocation && products.some(product => product.store === store.id));
  // Seller and service area are not present in the product API response.
  const locationProducts = checkoutEnabled ? products.filter(product => getStore(product.store).location === deliveryLocation) : products;
  const deliveryAddress = addresses.find((address) => address.id === selectedAddressId && address.location === deliveryLocation);

  function openDrawer(): void {
    setDrawerOpen(true);
    Animated.timing(drawerProgress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  function closeDrawer(): void {
    Animated.timing(drawerProgress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  }

  function chooseTab(nextTab: Tab): void {
    if (nextTab === 'Addresses') setAddressReturnTab(tab === 'Addresses' ? 'Home' : tab);
    setSelectedProduct(null);
    setTab(nextTab);
    closeDrawer();
  }

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (getStore(product.store).location && getStore(product.store).location !== deliveryLocation) return false;
      const matchesStore = storeId === 'all' || product.store === storeId;
      const matchesCategory = category === 'All' || product.category === category;
      const matchesSearch = (product.name + ' ' + product.category).toLowerCase().includes(search.trim().toLowerCase());
      return matchesStore && matchesCategory && matchesSearch;
    });
    if (sortBy === 'Price: low to high') return filtered.sort((a, b) => a.price - b.price);
    if (sortBy === 'Price: high to low') return filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, storeId, category, search, sortBy, deliveryLocation, getStore]);

  const cartItems = basket.lines;
  const cartCount = basket.count;
  const subtotal = basket.subtotal;
  async function addToCart(product: Product, quantity = 1) {
    if (product.sizes?.length && (selectedProduct?.id !== product.id || !selectedSize)) {
      if (selectedProduct?.id !== product.id) void openProduct(product);
      setNotice('Choose a size before adding this item.'); return;
    }
    try {
      await basket.add(product, product.sizes?.length ? selectedSize : undefined, quantity);
      notify('Added to your cart', `${quantity} × ${product.name} is ready in your ${customer ? 'saved' : 'guest'} cart.`, 'Cart');
      setNotice(customer ? `${quantity} added to your cart.` : '');
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Unable to add this item.'); }
  }
  async function changeQuantity(line: BasketLine, difference: number) {
    try { await basket.change(line, difference); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Unable to update your cart.'); }
  }

  const goToShop = () => { setSelectedProduct(null); setTab('Shop'); };

  const openShop = useCallback((id: StoreId): void => {
    setSelectedProduct(null);
    setStoreId(id);
    setCategory('All');
    setSearch('');
    setSortBy('Price: low to high');
    setTab('Shop');
  }, [setTab]);

  async function openProduct(product: Product): Promise<void> {
    const request = ++detailRequest.current;
    setSelectedProduct(product); setSelectedSize(''); setSelectedQuantity(1); setDetailLoading(true); setDetailError('');
    scrollToTop();
    try {
      const current = await catalogue.details(product.id);
      if (request !== detailRequest.current) return;
      setSelectedProduct(item => item?.id === current.id ? current : item);
      setRecentViews(items => [current, ...items.filter(item => item.id !== current.id)].slice(0, 8));
    } catch (cause) {
      if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : 'Unable to load product details.');
    } finally { if (request === detailRequest.current) setDetailLoading(false); }
  }
  function toggleFavorite(id: string): void { const saved = favorites.includes(id); setFavorites((items) => items.includes(id) ? items.filter((savedId) => savedId !== id) : [...items, id]); if (!saved) { const product = products.find(item => item.id === id); if (product) notify('Saved to your wishlist', `${product.name} is now in your wishlist.`, 'Favorites'); } setNotice(saved ? 'Removed from wishlist.' : 'Added to wishlist.'); setTimeout(() => setNotice(''), 1800); }
  const pay = useCallback(async (orderId?: string) => {
    if (paymentLock.current) return;
    const cash = !orderId && paymentMethod === 'Cash on Delivery';
    if (!cash && (!checkoutEnabled || !paymentConfig.enabled)) { setNotice('Online checkout is not enabled on this server yet.'); return; }
    if (!orderId && (!deliveryAddress || !basket.synced)) { setNotice('Select an address and wait for your cart to sync.'); return; }
    let paymentWindow: ReturnType<typeof preparePaymentWindow> | undefined;
    paymentLock.current = true; setPaying(true);
    try {
      checkoutKey.current ??= Crypto.randomUUID();
      if (cash) {
        await placeCashOnDeliveryOrder(getToken, checkoutKey.current, deliveryAddress!);
        setSelectedProduct(null); setTab('Orders');
        setNotice('Your Cash on Delivery order has been placed. Pay when it arrives.');
        await orderFeed.reload(); basket.reload(); await catalogue.reload();
        return;
      }
      paymentWindow = preparePaymentWindow();
      const checkout = await startCheckout(getToken, checkoutKey.current, deliveryAddress, orderId);
      setSelectedProduct(null); setTab('Orders');
      if (checkout.url) await paymentWindow.open(checkout.url); else paymentWindow.close();
      setNotice(checkout.paid ? 'Payment has been confirmed.' : 'Check the payment status below. A payment is complete only when the server marks it paid.');
      await orderFeed.reload(); basket.reload(); await catalogue.reload();
    } catch (e) {
      paymentWindow?.close();
      setNotice(e instanceof Error ? e.message : 'Could not confirm checkout. Check My orders before retrying.');
      void orderFeed.reload();
    } finally { paymentLock.current = false; setPaying(false); }
  }, [checkoutEnabled, paymentConfig.enabled, paymentMethod, deliveryAddress, basket, catalogue, orderFeed, getToken, setTab]);
  const checkoutFingerprint = JSON.stringify({ items: cartItems.map(line => [line.product.id, line.quantity, line.size]), address: deliveryAddress, method: paymentMethod });
  useEffect(() => { checkoutKey.current = null; }, [checkoutFingerprint, customer?.id]);

  const cancelOrder = useCallback(async (id: string) => { await cancelCheckout(id, getToken); checkoutKey.current = null; await orderFeed.reload(); basket.reload(); await catalogue.reload(); }, [getToken, orderFeed, basket, catalogue]);
  function renderHome() {
    const ads = [
      { title: 'Power your\neveryday.', copy: 'Explore electronics from shops in your neighbourhood.', label: 'Explore electronics', search: 'Electronics' },
      { title: 'Style for\nevery day.', copy: 'Discover clothing, everyday essentials and soft cotton from local shops.', label: 'Discover textiles', search: 'Textiles' },
      { title: 'Your town.\nYour favourites.', copy: 'Shop local finds with delivery within 12 hours.', label: 'Explore local finds', search: '' },
    ];
    return <>
      <AnimatedAd key={refreshVersion}>
      {(adIndex) => <>
      <LinearGradient colors={palette.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, styles.featuredShopAd]}>
        <View style={styles.adContent}>
          <Text style={[styles.eyebrow, styles.adEyebrow]}>DEMO AD · {adIndex + 1} / 3</Text>
          <Text style={styles.adTitle}>{ads[adIndex].title}</Text>
          <Text style={styles.adDescription}>{ads[adIndex].copy}</Text>
          <TouchableOpacity style={[styles.heroButton, styles.adAction]} onPress={() => { setSupermarketSearch(ads[adIndex].search); setTab('Supermarket'); scrollToTop(); }} accessibilityRole="button"><Text style={styles.heroButtonText}>{ads[adIndex].label} →</Text></TouchableOpacity>
        </View>
        <View style={styles.adBadge} pointerEvents="none"><BrandLogo size={desktop ? 100 : 30} /><Text style={styles.adBadgeText}>LOCAL</Text></View>
        <View style={styles.adGlow} />
      </LinearGradient>
      </>}
      </AnimatedAd>
      {desktop ? <>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Find your next favourite</Text><Text style={styles.pageIntro}>Explore the latest products in the NearBy catalogue.</Text></View></View>
        <ProductGrid items={locationProducts.slice(0, 4)} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
      </> : <HomeProducts key={`products-${deliveryLocation}-${refreshVersion}`} products={locationProducts} onOpen={openProduct} getStore={getStore} />}
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Start shopping</Text><Text style={styles.sectionHint}>Choose your path</Text></View>
      <View style={styles.homeStoreGrid}>
        <TouchableOpacity style={styles.homeStoreCard} onPress={() => { setSelectedProduct(null); setTab('Supermarket'); }} accessibilityRole="button" accessibilityLabel="Browse supermarket">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <InterfaceIcon name="grid" size={22} color={palette.primaryText} />
            <Text style={[styles.storeBlockName, { marginTop: 0, textAlign: 'center', flexShrink: 1 }]}>Supermarket</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeStoreCard} onPress={() => { setSelectedProduct(null); setStoreId('all'); setCategory('All'); setSearch(''); setTab('Shops'); }} accessibilityRole="button" accessibilityLabel="Browse shops by name">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <InterfaceIcon name="shop" size={24} color={palette.primaryText} />
            <Text style={[styles.storeBlockName, { marginTop: 0, textAlign: 'center', flexShrink: 1 }]}>Shop by name</Text>
          </View>
        </TouchableOpacity>
      </View>
      {locationShops.length ? <HomeShops key={`${deliveryLocation}-${refreshVersion}`} products={locationProducts} shops={locationShops} onSelect={openShop} /> : <Text style={styles.formNote}>Shop-by-name browsing needs seller and location details from the API.</Text>}
    </>;
  }

  function renderShop() {
    if (storeId !== 'all') return <>
      <TouchableOpacity style={styles.backButton} onPress={() => setTab('Shops')} accessibilityRole="button"><Text style={styles.backButtonText}>← Choose another shop</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>{getStore(storeId).name}</Text>
      <Text style={styles.pageIntro}>{getStore(storeId).area}</Text>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder={`Search in ${getStore(storeId).name}`} placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel={`Search products in ${getStore(storeId).name}`} returnKeyType="search" />{search ? <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.clearSearch}>Clear</Text></TouchableOpacity> : null}</View>
      <SearchSuggestions query={search} products={locationProducts.filter((product) => product.store === storeId && (category === 'All' || product.category === category))} onSelect={setSearch} />
      <CategoryPicker styles={styles} value={sortBy} onChange={setSortBy} options={['Price: low to high', 'Price: high to low']} />
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{visibleProducts.length} {search.trim() ? 'results' : 'products'}</Text></View>
      <ProductGrid items={visibleProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
    </>;
    return <>
      <Text style={styles.pageTitle}>{storeId === 'all' ? 'Shop local' : getStore(storeId).name}</Text><Text style={styles.pageIntro}>Electronics and textiles from Thodupuzha shops.</Text>
      <View style={styles.filterPanel}>
        <View style={styles.filterPanelHeading}><Text style={styles.filterPanelTitle}>Search & filters</Text><Text style={styles.sectionHint}>Choose any combination</Text></View>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel="Search products" returnKeyType="search" /><TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.clearSearch}>{search ? 'Clear' : ''}</Text></TouchableOpacity></View>
      <SearchSuggestions query={search} products={locationProducts.filter((product) => (storeId === 'all' || product.store === storeId) && (category === 'All' || product.category === category))} onSelect={setSearch} />
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>STORE</Text><StorePicker styles={styles} stores={[stores[0], ...locationShops]} value={storeId} onChange={setStoreId} /></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>CATEGORY</Text><CategoryPicker styles={styles} value={category} onChange={setCategory} options={categories} /></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>SORT BY</Text><CategoryPicker styles={styles} value={sortBy} onChange={setSortBy} options={sortOptions} /></View>
      </View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{visibleProducts.length} products</Text><Text style={styles.sectionHint}>{storeId === 'all' ? 'All stores' : getStore(storeId).name}</Text></View>
      <ProductGrid items={visibleProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
    </>;
  }

  function renderSupermarket() {
    const query = supermarketSearch.trim().toLowerCase();
    const results = locationProducts.filter((product) => `${product.name} ${product.category} ${getStore(product.store).name}`.toLowerCase().includes(query));
    return <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedProduct(null); setTab('Home'); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>Supermarket</Text><Text style={styles.pageIntro}>Browse the products returned by the NearBy catalogue.</Text>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={supermarketSearch} onChangeText={setSupermarketSearch} placeholder="Search products, categories or shops" placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel="Search supermarket products" returnKeyType="search" autoCapitalize="none" />
        {supermarketSearch ? <TouchableOpacity onPress={() => setSupermarketSearch('')} accessibilityRole="button" accessibilityLabel="Clear supermarket search"><Text style={styles.clearSearch}>Clear</Text></TouchableOpacity> : null}
      </View>
      <SearchSuggestions query={supermarketSearch} products={locationProducts} onSelect={setSupermarketSearch} />
      <CategoryPicker styles={styles} value={supermarketSearch} onChange={setSupermarketSearch} options={categories} />
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{results.length} {query ? 'results' : 'shop items'}</Text><Text style={styles.sectionHint}>{deliveryLocation.split(',')[0].toUpperCase()}</Text></View>
      {results.length ? <ProductGrid items={results} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} /> : <View style={styles.emptyState}><Text style={styles.emptyTitle}>No matching products</Text><Text style={styles.muted}>Try a different product, category or shop name.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setSupermarketSearch('')} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Clear search</Text></TouchableOpacity></View>}
    </>;
  }

  function renderStores() {
    return <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedProduct(null); setTab('Home'); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>Shop by name</Text><Text style={styles.pageIntro}>Choose the local shop you prefer before you add items to your cart.</Text>
      <View style={styles.storeTypePanel}>
        <Text style={styles.storeTypeLabel}>STORE TYPE</Text>
        <View style={styles.storeTypeRow}>
          {(['Electronics', 'Textiles', 'Home Appliances', 'Computer Items'] as const).map((type) => <TouchableOpacity key={type} onPress={() => setStoreCategory(type)} style={[styles.storeTypeButton, { minWidth: 130 }, storeCategory === type && styles.storeTypeSelected]} accessibilityRole="button" accessibilityState={{ selected: storeCategory === type }}>
            <Text style={[styles.storeTypeIcon, storeCategory === type && styles.storeTypeActiveText]}>{type === 'Electronics' ? 'ϟ' : type === 'Computer Items' ? '▣' : type === 'Home Appliances' ? '⌂' : '▤'}</Text>
            <Text style={[styles.storeTypeText, storeCategory === type && styles.storeTypeActiveText]}>{type}</Text>
          </TouchableOpacity>)}
        </View>
      </View>
      {locationShops.filter((store) => products.some((product) => product.store === store.id && product.category === storeCategory)).map((store) => {
        const count = products.filter((product) => product.store === store.id).length;
        return <TouchableOpacity key={store.id} style={[styles.storeCard, storeId === store.id && styles.storeCardSelected]} onPress={() => openShop(store.id)} accessibilityRole="button">
          <Text style={styles.storeIcon}>{store.icon}</Text><View style={styles.storeCopy}><Text style={styles.storeName}>{store.name}</Text><Text style={styles.muted}>{store.area}</Text><Text style={styles.storeCount}>{count} products available  ·  Select store →</Text></View>
        </TouchableOpacity>;
      })}
      {!locationShops.some((store) => products.some((product) => product.store === store.id && product.category === storeCategory)) ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No {storeCategory.toLowerCase()} shops here yet</Text><Text style={styles.muted}>Try another store type or change your location.</Text></View> : null}
    </>;
  }

  function renderCart() {
    return <>
      <Text style={styles.pageTitle}>Your cart</Text>
      {basket.busy ? <Text style={styles.formNote}>Updating your saved cart…</Text> : null}
      {basket.error ? <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.noticeText}>{basket.error}</Text><TouchableOpacity disabled={basket.busy} onPress={basket.reload}><Text style={styles.backButtonText}>Reload saved cart</Text></TouchableOpacity></View> : null}
      <Text style={styles.pageIntro}>{cartCount} {cartCount === 1 ? 'item' : 'items'} in your bag</Text>
      {cartItems.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>🛒</Text><Text style={styles.emptyTitle}>Your cart is waiting</Text><Text style={styles.muted}>Add something you love from the shop.</Text><TouchableOpacity style={styles.heroButton} onPress={goToShop}><Text style={styles.heroButtonText}>Browse products</Text></TouchableOpacity></View> : <>
        {cartItems.map((line) => <View key={line.key} style={styles.cartRow}>
          <View style={styles.cartArt}><ProductPhoto product={line.product} /></View>
          <View style={styles.cartDetails}><Text style={styles.productName}>{line.product.name}</Text><Text style={styles.muted}>{money(line.price)} each{line.size ? ` · ${line.size}` : ''}</Text>
            {line.pending ? <><Text style={styles.formNote}>Not saved — check your saved cart before adding again.</Text><TouchableOpacity onPress={() => basket.removePending(line)}><Text style={styles.backButtonText}>Remove guest copy</Text></TouchableOpacity></> : null}
          </View>
          <View style={styles.qtyBox}><TouchableOpacity disabled={basket.busy || line.pending} onPress={() => changeQuantity(line, -1)} style={styles.qtyButton} accessibilityLabel={`Remove one ${line.product.name}`}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity><Text style={styles.qtyText}>{line.quantity}</Text><TouchableOpacity disabled={basket.busy || line.pending} onPress={() => changeQuantity(line, 1)} style={styles.qtyButton} accessibilityLabel={`Add one ${line.product.name}`}><Text style={styles.qtyButtonText}>+</Text></TouchableOpacity></View>
          <Text style={styles.lineTotal}>{money(line.price * line.quantity)}</Text>
        </View>)}
        <View style={styles.summaryCard}><View style={styles.summaryLine}><Text style={styles.muted}>Subtotal</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View><View style={styles.summaryLine}><Text style={styles.muted}>Delivery</Text><Text style={styles.freeText}>{subtotal >= 999 ? 'FREE' : money(99)}</Text></View><View style={styles.divider} /><View style={styles.summaryLine}><Text style={styles.summaryTotalLabel}>Total</Text><Text style={styles.summaryTotal}>{money(subtotal + (subtotal >= 999 ? 0 : 99))}</Text></View><TouchableOpacity style={styles.primaryButton} onPress={continueToPayment}><Text style={styles.primaryButtonText}>Continue to payment</Text></TouchableOpacity><Text style={styles.checkoutNote}>{'Choose Cash on Delivery at checkout. Online payment is available when enabled.'}</Text></View>
      </>}
    </>;
  }

  function renderFavorites() {
    const items = locationProducts.filter((product) => favorites.includes(product.id));
    return <>
      <Text style={styles.pageTitle}>Wishlist</Text>
      <Text style={styles.pageIntro}>{items.length} saved {items.length === 1 ? 'item' : 'items'} · Your local favourites, ready when you are.</Text>
      {items.length ? <ProductGrid items={items} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} /> :
        <View style={styles.emptyState}><Text style={styles.emptyEmoji}>♡</Text><Text style={styles.emptyTitle}>Save something you love</Text><Text style={styles.muted}>Tap the heart on any product to add it here.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setTab('Supermarket')}><Text style={styles.secondaryButtonText}>Explore all products</Text></TouchableOpacity></View>}
    </>;
  }

  function renderOrders() { return <>
    <TouchableOpacity style={styles.backButton} onPress={() => { setTab('Home'); scrollToTop(); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
    <Text style={styles.pageTitle}>My orders</Text><Text style={styles.pageIntro}>View your orders and their latest status.</Text>
    {!customer ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>Sign in to view orders</Text><TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/login')} accessibilityRole="button"><Text style={styles.primaryButtonText}>Sign in</Text></TouchableOpacity></View> : <>
      {orderFeed.loading ? <Text style={styles.muted} accessibilityRole="text">Updating your orders…</Text> : null}
      {orderFeed.error ? <View style={styles.notice}><Text style={styles.noticeText}>Unable to load orders: {orderFeed.error}</Text><TouchableOpacity disabled={orderFeed.loading} onPress={() => void orderFeed.reload()} accessibilityRole="button"><Text style={styles.backButtonText}>Retry orders</Text></TouchableOpacity></View> : null}
      {!orderFeed.error && orderFeed.loaded && orders.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Your order status will appear here when orders are available.</Text></View> : null}
      <View style={{ gap: 16 }}>{orders.map(order => <OrderStatusCard key={order.id} order={order} onPay={checkoutEnabled && order.paymentMethod !== 'Cash on Delivery' && order.paymentStatus === 'pending' ? () => void pay(order.id) : undefined} paying={paying} onCancel={checkoutEnabled && order.paymentMethod !== 'Cash on Delivery' ? () => cancelOrder(order.id) : undefined} onOpen={() => setSelectedOrderId(order.id)} />)}</View>
    </>}
  </>; }

  function renderHistory() { return <><Text style={styles.pageTitle}>History</Text><Text style={styles.pageIntro}>Purchases and recently viewed products.</Text>{orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id}</Text><Text style={styles.muted}>{order.date}</Text></View></View>)}<View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recently viewed</Text></View><ProductGrid items={recentViews} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} /></>; }

  function renderAccount() { return Platform.OS === 'web' ? <Redirect href={'/account' as Href} /> : <><Text style={styles.pageTitle}>Account settings</Text><Text style={styles.pageIntro}>Your profile and sign-in preferences.</Text><AccountSettings /></>; }

  function renderCustomerCare() {
    const phone = process.env.EXPO_PUBLIC_SUPPORT_PHONE;
    const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
    return <><Text style={styles.pageTitle}>Customer care</Text><Text style={styles.pageIntro}>Contact support with your NearBy order number.</Text><View style={styles.menuCard}><View><Text style={styles.storeName}>Where is my order?</Text><Text style={styles.muted}>Open My orders for payment and fulfilment updates.</Text></View></View><View style={styles.menuCard}><View><Text style={styles.storeName}>Payments and refunds</Text><Text style={styles.muted}>{checkoutEnabled ? 'Payment is handled by Razorpay. If money was debited and the order is pending, refresh My orders before trying again.' : 'Online checkout is currently a preview.'}</Text></View></View>{phone ? <Text selectable style={styles.formNote}>Support phone: {phone}</Text> : null}{email ? <Text selectable style={styles.formNote}>Support email: {email}</Text> : null}{!phone && !email ? <Text style={styles.formNote}>Support contact is not configured. Contact your trial coordinator before ordering.</Text> : null}</>;
  }

  function renderMore() { const sections: { icon: string; title: string; tab: Tab }[] = [{ icon: 'F', title: 'Favourites', tab: 'Favorites' }, { icon: 'O', title: 'My orders', tab: 'Orders' }, { icon: 'H', title: 'History', tab: 'History' }, { icon: 'A', title: 'Account settings', tab: 'Account' }, { icon: 'C', title: 'Customer care', tab: 'Customer Care' }]; return <><Text style={styles.pageTitle}>More</Text><Text style={styles.pageIntro}>Saved items, orders, account, and help.</Text>{sections.map((section) => <TouchableOpacity key={section.tab} style={styles.menuCard} onPress={() => setTab(section.tab)} accessibilityRole='button'><Text style={styles.menuIcon}>{section.icon}</Text><View style={styles.menuCopy}><Text style={styles.storeName}>{section.title}</Text></View><Text style={styles.menuArrow}>{">"}</Text></TouchableOpacity>)}</>; }
  function renderDetails() {
    const product = selectedProduct;
    if (!product) return null;
    if (getStore(product.store).location && getStore(product.store).location !== deliveryLocation) return <>
      <Text style={styles.pageTitle}>{product.name}</Text>
      <View style={styles.emptyState}><Text style={styles.emptyTitle}>Unavailable in {deliveryLocation.split(',')[0]}</Text><Text style={styles.muted}>This item is sold by a shop in {getStore(product.store).location}. Change location to view it again.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedProduct(null)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Back to browsing</Text></TouchableOpacity></View>
    </>;
    const alreadyInCart = cartItems.filter(line => line.product.id === product.id).reduce((total, line) => total + line.quantity, 0);
    const maximumQuantity = Math.max(0, Math.min(product.stock ?? 100000, 100000) - alreadyInCart);
    const quantity = Math.min(selectedQuantity, Math.max(1, maximumQuantity));
    const addingDisabled = maximumQuantity === 0 || basket.busy || detailLoading || !!detailError;
    const relatedProducts = locationProducts
      .filter((item) => item.id !== product.id && item.category === product.category)
      .sort((a, b) => {
        const sameName = Number(b.name === product.name) - Number(a.name === product.name);
        return sameName || Math.abs(a.price - product.price) - Math.abs(b.price - product.price);
      })
      .slice(0, 6);
    return <>
      <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backButton}><Text style={styles.backButtonText}>←  Back to shop</Text></TouchableOpacity>
      <ProductGallery key={`gallery-${product.id}`} product={product} styles={styles} />
      <Text style={styles.formNote}>Product image supplied by the store.</Text>
      {detailLoading ? <Text style={styles.muted}>Loading latest product details…</Text> : null}
      {detailError ? <View style={styles.notice}><Text style={styles.noticeText}>{detailError}</Text><TouchableOpacity onPress={() => openProduct(product)}><Text style={styles.backButtonText}>Retry details</Text></TouchableOpacity></View> : null}
      <Text style={styles.productCategory}>{product.category.toUpperCase()}  ·  ★ {product.rating || 'New'}</Text><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.detailPrice}>{money(product.price)}</Text>
      <Text style={styles.detailDescription}>{product.description || 'Product details will be added soon.'}</Text>
      <TouchableOpacity style={styles.detailFavorite} onPress={() => toggleFavorite(product.id)} accessibilityRole="button" accessibilityLabel={favorites.includes(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}><Text style={styles.detailFavoriteText}>{favorites.includes(product.id) ? '♥ Saved to wishlist · Remove' : '♡ Add to wishlist'}</Text></TouchableOpacity>
      <View style={styles.storeDetail}><Text style={styles.storeIcon}>{getStore(product.store).icon}</Text><View><Text style={styles.storeName}>{getStore(product.store).name}</Text><Text style={styles.muted}>{getStore(product.store).area}</Text></View></View>
      {product.sizes?.length ? <><Text style={styles.inputLabel}>CHOOSE SIZE</Text><CategoryPicker styles={styles} value={selectedSize} onChange={setSelectedSize} options={product.sizes} /></> : null}
      <View style={{ marginTop: 16, marginBottom: 14, gap: 10 }}>
        <Text style={styles.inputLabel}>QUANTITY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <View style={[styles.qtyBox, { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 4 }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease quantity" accessibilityState={{ disabled: addingDisabled || quantity <= 1 }} disabled={addingDisabled || quantity <= 1} onPress={() => setSelectedQuantity(Math.max(1, quantity - 1))} style={[styles.qtyButton, { width: 44, height: 44 }, (addingDisabled || quantity <= 1) && { opacity: 0.4 }]}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity>
            <Text accessibilityLabel={`Selected quantity: ${quantity}`} accessibilityLiveRegion="polite" style={[styles.qtyText, { fontSize: 17, minWidth: 32, textAlign: 'center' }]}>{quantity}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase quantity" accessibilityState={{ disabled: addingDisabled || quantity >= maximumQuantity }} disabled={addingDisabled || quantity >= maximumQuantity} onPress={() => setSelectedQuantity(Math.min(maximumQuantity, quantity + 1))} style={[styles.qtyButton, { width: 44, height: 44 }, (addingDisabled || quantity >= maximumQuantity) && { opacity: 0.4 }]}><Text style={styles.qtyButtonText}>＋</Text></TouchableOpacity>
          </View>
          <Text style={styles.muted}>{product.stock === 0 ? 'Out of stock' : maximumQuantity === 0 ? 'All available units are already in your cart' : product.stock !== undefined ? `${maximumQuantity} available to add` : 'Choose how many you need'}</Text>
        </View>
      </View>
      <TouchableOpacity disabled={addingDisabled} style={[styles.primaryButton, addingDisabled && { opacity: 0.5 }]} onPress={() => addToCart(product, quantity)} accessibilityRole="button" accessibilityState={{ disabled: addingDisabled }}><Text style={styles.primaryButtonText}>{product.stock === 0 ? 'Sold out' : maximumQuantity === 0 ? 'Already in your cart' : `Add ${quantity} to cart · ${money(product.price * quantity)}`}</Text></TouchableOpacity>
      <ProductReviews key={`reviews-${product.id}`} reviews={productReviews[product.id] ?? []} onSubmit={(review) => setProductReviews((current) => ({ ...current, [product.id]: [review, ...(current[product.id] ?? [])] }))} />
      {relatedProducts.length > 0 ? <>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>You may also like</Text><Text style={styles.sectionHint}>{product.category.toUpperCase()}</Text></View>
        <ProductGrid items={relatedProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
      </> : null}
    </>;
  }

  const pageTitle = selectedProduct ? 'Product details' : tab;
  const primaryDrawerLinks: { icon: string; label: string; tab: Tab }[] = [
    { icon: '⌂', label: 'Home', tab: 'Home' },
    { icon: '▦', label: 'Supermarket', tab: 'Supermarket' },
    { icon: '⌖', label: 'Shop by name', tab: 'Shops' },
    { icon: '▣', label: `Cart${cartCount ? ` (${cartCount})` : ''}`, tab: 'Cart' },
  ];
  const accountDrawerLinks: { icon: string; label: string; tab: Tab }[] = [
    { icon: '⌖', label: 'Addresses', tab: 'Addresses' },
    { icon: '♡', label: `Wishlist (${favorites.length})`, tab: 'Favorites' },
    { icon: '◷', label: 'My orders', tab: 'Orders' },
    { icon: '◌', label: 'Account settings', tab: 'Account' },
    { icon: '?', label: 'Customer care', tab: 'Customer Care' },
  ];
  const drawerTranslateX = drawerProgress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <View style={styles.screen}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {desktop ? <WebStoreHeader unreadNotifications={unreadNotifications} onNotifications={() => setNotificationsOpen(true)} products={locationProducts} onProduct={openProduct} location={deliveryLocation} cartCount={cartCount} favorites={favorites.length} customerName={customer?.name} onNavigate={next => { setSelectedProduct(null); setTab(next); scrollToTop(); }} onSearch={query => { setSelectedProduct(null); setSupermarketSearch(query); setTab('Supermarket'); scrollToTop(); }} onLocation={() => setLocationOpen(true)} onAccount={() => { if (customer) { setSelectedProduct(null); setTab('Account'); } else router.push('/login'); }} onMenu={openDrawer} /> : null}
      <ScrollView ref={pageScroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" alwaysBounceVertical refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPage} tintColor={palette.gold} colors={[palette.primary, palette.gold]} progressBackgroundColor={palette.surface} title="Refreshing your store…" titleColor={palette.primary} />}>
        {!desktop ? <><View style={styles.topBar}>
          <View style={styles.topBarStart}>
            <TouchableOpacity style={styles.brandRow} onPress={() => { setSelectedProduct(null); setTab('Home'); }} accessibilityRole="button" accessibilityLabel="NearBy home">
              <BrandLogo size={39} /><Text style={styles.brand}>Near<Text style={styles.brandAccent}>By</Text></Text>
            </TouchableOpacity>
          </View>
          <View style={styles.topBarEnd}>
            <NotificationBell count={unreadNotifications} onPress={() => setNotificationsOpen(true)} />
            <TouchableOpacity activeOpacity={0.75} style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Favorites'); }} accessibilityRole="button" accessibilityLabel={`Open wishlist, ${favorites.length} saved items`}><InterfaceIcon name="heart" color={palette.primaryText} />{favorites.length > 0 ? <Text style={styles.topCartText}>{favorites.length}</Text> : null}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Cart'); }} accessibilityRole="button" accessibilityLabel={`Open cart, ${cartCount} items`}><InterfaceIcon name="bag" color={palette.primaryText} />{cartCount > 0 ? <Text style={styles.topCartText}>{cartCount}</Text> : null}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.menuToggle} onPress={openDrawer} accessibilityRole="button" accessibilityLabel="Open navigation menu"><InterfaceIcon name="menu" color={palette.primaryText} /></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.locationBar} onPress={() => setLocationOpen(true)} accessibilityRole="button" accessibilityLabel={`Delivery location: ${deliveryLocation}. Change location`}>
          <Text style={styles.locationPin}>⌖</Text><View style={styles.locationCopy}><Text style={styles.localSignatureText}>DELIVER TO</Text><Text numberOfLines={1} style={styles.locationName}>{deliveryLocation}</Text></View><Text style={styles.locationChange}>Change ⌄</Text>
        </TouchableOpacity>
        </> : null}
        {catalogue.loading ? <View style={styles.notice}><Text style={styles.noticeText}>Loading catalogue…</Text></View> : null}
        {catalogue.error ? <View style={styles.notice}><Text accessibilityRole="alert" style={styles.noticeText}>Products could not refresh. Refresh the page or pull down to reload.</Text></View> : null}
        {!catalogue.error && !catalogue.loading && !products.length ? <Text style={styles.formNote}>No products have been published yet.</Text> : null}
        {products.length ? <Text style={styles.formNote}>Shop and delivery coverage have not been supplied for these products.</Text> : null}
        {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
        <Text accessibilityLabel={`${pageTitle} page`} style={styles.srOnly}>{pageTitle}</Text>
        {selectedProduct ? renderDetails() : tab === 'Home' ? renderHome() : tab === 'Shop' ? renderShop() : tab === 'Supermarket' ? renderSupermarket() : tab === 'Shops' ? renderStores() : tab === 'Cart' ? renderCart() : tab === 'Addresses' ? <AddressBook addresses={addresses} selectedId={selectedAddressId} location={deliveryLocation} onSave={(address) => { setAddresses((current) => [...current, address]); selectAddress(address.id); }} onSelect={selectAddress} onRemove={(id) => { setAddresses((current) => current.filter((address) => address.id !== id)); if (selectedAddressId === id) setSelectedAddressId(null); }} onBack={() => setTab(addressReturnTab)} /> : tab === 'Payment' && customer ? <PaymentSection address={deliveryAddress} onManageAddress={() => { setAddressReturnTab('Payment'); setTab('Addresses'); }} subtotal={subtotal} itemCount={cartCount} location={deliveryLocation} method={paymentMethod} onChange={setPaymentMethod} onBack={() => setTab('Cart')} onConfirm={() => void pay()} canOrder={(paymentMethod === 'Cash on Delivery' || (checkoutEnabled && paymentConfig.enabled)) && basket.synced} live={checkoutEnabled || paymentMethod === 'Cash on Delivery'} busy={paying} paymentMode={paymentConfig.mode} /> : tab === 'Favorites' ? renderFavorites() : tab === 'Orders' ? renderOrders() : tab === 'History' ? renderHistory() : tab === 'Account' ? renderAccount() : tab === 'Customer Care' ? renderCustomerCare() : renderMore()}
        {desktop ? <View style={{ marginTop: 56, paddingTop: 30, paddingBottom: 12, borderTopWidth: 1, borderColor: palette.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
          <View style={{ maxWidth: 360 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BrandLogo size={48} /><Text style={styles.brand}>NearBy</Text></View><Text style={[styles.pageIntro, { marginTop: 12 }]}>Your town. Your shops. Your doorstep.</Text><Text style={styles.muted}>Shopping local in {deliveryLocation}.</Text></View>
          <View style={{ gap: 14 }}><Text style={styles.storeName}>Explore</Text>{([{ label: 'Supermarket', target: 'Supermarket' }, { label: 'Shop by name', target: 'Shops' }, { label: 'Wishlist', target: 'Favorites' }] as const).map(link => <TouchableOpacity key={link.target} accessibilityRole="button" onPress={() => { setSelectedProduct(null); setTab(link.target); scrollToTop(); }}><Text style={styles.changeLink}>{link.label}</Text></TouchableOpacity>)}</View>
          <View style={{ gap: 14 }}><Text style={styles.storeName}>Your account</Text>{([{ label: 'My orders', target: 'Orders' }, { label: 'Addresses', target: 'Addresses' }, { label: 'Customer care', target: 'Customer Care' }] as const).map(link => <TouchableOpacity key={link.target} accessibilityRole="button" onPress={() => { setSelectedProduct(null); setTab(link.target); scrollToTop(); }}><Text style={styles.changeLink}>{link.label}</Text></TouchableOpacity>)}</View>
        </View> : null}
      </ScrollView>
      <Modal visible={locationOpen} transparent animationType="fade" onRequestClose={() => setLocationOpen(false)}>
        <KeyboardAvoidingView style={styles.locationOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.drawerTapLayer} onPress={() => setLocationOpen(false)} accessibilityRole="button" accessibilityLabel="Close location selector" />
          <View style={styles.locationDialog} accessibilityViewIsModal>
            <View style={styles.drawerHeader}><Text style={styles.drawerBrand}>Delivery location</Text><TouchableOpacity onPress={() => setLocationOpen(false)} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Close location selector"><Text style={styles.drawerCloseText}>×</Text></TouchableOpacity></View>
            <Text style={styles.muted}>Choose your area to see its shops and available products.</Text>
            {(['Thodupuzha, Idukki', 'Muttom, Idukki'] as const).map((location) => <TouchableOpacity key={location} style={[styles.storeCard, deliveryLocation === location && styles.storeCardSelected]} accessibilityRole="button" accessibilityState={{ selected: deliveryLocation === location }} onPress={() => { setDeliveryLocation(location); setLocationOpen(false); }}><Text style={styles.locationPin}>⌖</Text><Text style={styles.storeName}>{location}</Text>{deliveryLocation === location ? <Text style={styles.changeLink}>✓</Text> : null}</TouchableOpacity>)}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {drawerOpen ? <View style={styles.drawerLayer}>
        <Animated.View pointerEvents="none" style={[styles.drawerBackdrop, { opacity: drawerProgress }]} />
        <Pressable style={styles.drawerTapLayer} onPress={closeDrawer} accessibilityRole="button" accessibilityLabel="Close navigation menu" />
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerTranslateX }] }]}>
          <View style={styles.drawerHeader}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><BrandLogo size={38} /><View><Text style={styles.drawerBrand}>NearBy</Text><Text style={styles.drawerSub}>THODUPUZHA · KERALA</Text></View></View><TouchableOpacity onPress={closeDrawer} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Close navigation menu"><Text style={styles.drawerCloseText}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          <View style={styles.drawerDelivery}><Text style={styles.drawerDeliveryIcon}>◷</Text><Text style={styles.drawerDeliveryText}>Delivery within 12 hours</Text></View>
          <TouchableOpacity style={styles.drawerAuth} onPress={() => { closeDrawer(); if (customer) { setSelectedProduct(null); setTab('Account'); } else router.push('/login' as Href); }} accessibilityRole="button"><Text style={styles.drawerAuthKicker}>NearBy ACCOUNT</Text><Text style={styles.drawerAuthText}>{customer ? customer.name : 'Sign in or create account  →'}</Text></TouchableOpacity>
          {primaryDrawerLinks.map((item) => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          <View style={styles.drawerDivider} /><Text style={styles.drawerSectionLabel}>YOUR NearBy</Text>
          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); setNotificationsOpen(true); }} accessibilityRole="button"><Text style={styles.drawerItemText}>Notifications{unreadNotifications ? ` (${unreadNotifications})` : ''}</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['light', 'dark'] as const).map((option) => <TouchableOpacity key={option} onPress={() => setMode(option)} accessibilityRole="button" accessibilityLabel={`${option} mode`} accessibilityState={{ selected: mode === option }} style={[styles.storeTypeButton, mode === option && styles.storeTypeSelected]}><Text style={[styles.storeTypeText, mode === option && styles.storeTypeActiveText]}>{option === 'light' ? '☀ Light' : '☾ Dark'}</Text></TouchableOpacity>)}
          </View>
          {accountDrawerLinks.map((item) => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          </ScrollView>
          {customer ? <TouchableOpacity accessibilityRole="button" onPress={logout} style={[styles.drawerItem, { flexShrink: 0, marginTop: 8, marginBottom: 12, borderTopWidth: 1, borderTopColor: palette.border, borderRadius: 0 }]}><Text style={[styles.drawerItemText, { color: palette.terracotta }]}>Log out</Text></TouchableOpacity> : null}
        </Animated.View>
      </View> : null}
      <CustomerNotifications open={notificationsOpen} items={notifications} onClose={() => setNotificationsOpen(false)} onRead={id => setNotifications(current => current.map(item => item.id === id ? { ...item, read: true } : item))} onReadAll={() => setNotifications(current => current.map(item => ({ ...item, read: true })))} onClear={() => setNotifications([])} onNavigate={target => { setSelectedProduct(null); setTab(target); scrollToTop(); }} />
      <OrderDetails id={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      {toastQueue[0] ? <NotificationToast key={toastQueue[0].id} item={toastQueue[0]} onDismiss={id => setToastQueue(current => current.filter(item => item.id !== id))} onOpen={item => { setNotifications(current => current.map(notification => notification.id === item.id ? { ...notification, read: true } : notification)); setSelectedProduct(null); setTab(item.target); scrollToTop(); }} /> : null}
    </View>
  );
}

