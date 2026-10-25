import { useEffect, useMemo, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import WebStoreHeader from './components/WebStoreHeader';
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
import { categories, getStore, money, palettes, sortOptions, starterProducts, stores } from './data/catalog';
import { createStyles } from './styles/appStyles';
import type { CategoryFilter, DeliveryLocation, Order, Product, StoreId, Tab } from './data/types';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

export default function StorefrontScreen() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const { customer, signOut } = useCustomerAuth();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const [tab, setTab] = useState<Tab>('Home');
  const pageScroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (checkout !== 'payment') return;
    if (customer) { setSelectedProduct(null); setTab('Payment'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }
    router.setParams({ checkout: undefined });
  }, [checkout, customer]);

  function continueToPayment() {
    if (!customer) { router.push({ pathname: '/signup', params: { returnTo: 'payment' } }); return; }
    setTab('Payment'); pageScroll.current?.scrollTo({ y: 0, animated: false });
  }

  function logout() {
    signOut();
    setCart({}); setFavorites([]); setOrders([]); setAddresses([]);
    setSelectedAddressId(null); setRecentViews([]); setAccountName(''); setAccountEmail('');
    setAddressReturnTab('Home'); setSelectedProduct(null); setTab('Home');
    setDrawerOpen(false); drawerProgress.setValue(0);
    router.setParams({ checkout: undefined });
    pageScroll.current?.scrollTo({ y: 0, animated: false });
    setNotice('You are logged out. You can continue browsing.');
  }
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  function refreshPage(): void {
    if (refreshTimer.current) return;
    setRefreshing(true);
    // Local demo catalogue: redraw the current view without resetting customer data.
    refreshTimer.current = setTimeout(() => {
      setRefreshVersion((version) => version + 1);
      setRefreshing(false);
      refreshTimer.current = null;
    }, 900);
  }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation>('Thodupuzha, Idukki');
  const [locationOpen, setLocationOpen] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const { palette, mode, setMode } = useStoreTheme();
  const styles = useMemo(() => {
    const base = createStyles(palette);
    return Platform.OS === 'web' ? createWebStyles(base, width) : base;
  }, [palette, width]);
  const [products, setProducts] = useState<Product[]>(starterProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [productReviews, setProductReviews] = useState<Record<string, ProductReview[]>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressReturnTab, setAddressReturnTab] = useState<Tab>('Home');
  function useAddress(id: string) {
    setSelectedAddressId(id);
    if (addressReturnTab === 'Payment') {
      setTab('Payment');
      pageScroll.current?.scrollTo({ y: 0, animated: false });
    }
  }
  const [recentViews, setRecentViews] = useState<Product[]>([]);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [sortBy, setSortBy] = useState<string>('Featured');
  const [storeId, setStoreId] = useState<StoreId>('all');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [storeCategory, setStoreCategory] = useState<'Electronics' | 'Textiles' | 'Home Appliances' | 'Computer Items'>('Electronics');
  const [search, setSearch] = useState('');
  const [supermarketSearch, setSupermarketSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState<CategoryFilter>('Electronics');
  const [itemStore, setItemStore] = useState<Product['store']>('vv');
  const [itemDescription, setItemDescription] = useState('');
  const locationShops = stores.filter((store) => store.location === deliveryLocation);
  const locationProducts = products.filter((product) => getStore(product.store).location === deliveryLocation);
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
      if (getStore(product.store).location !== deliveryLocation) return false;
      const matchesStore = storeId === 'all' || product.store === storeId;
      const matchesCategory = category === 'All' || product.category === category;
      const matchesSearch = (product.name + ' ' + product.category).toLowerCase().includes(search.trim().toLowerCase());
      return matchesStore && matchesCategory && matchesSearch;
    });
    if (sortBy === 'Price: low to high') return filtered.sort((a, b) => a.price - b.price);
    if (sortBy === 'Price: high to low') return filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, storeId, category, search, sortBy, deliveryLocation]);

  const cartItems = products.filter((product) => cart[product.id] > 0);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const subtotal = cartItems.reduce((total, product) => total + product.price * cart[product.id], 0);

  function addToCart(product: Product) {
    if (product.stock === 0) return;
    setCart((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
    setNotice(`${product.name} added to your cart`);
    setTimeout(() => setNotice(''), 2200);
  }

  function changeQuantity(productId: string, difference: number) {
    setCart((current) => {
      const nextQuantity = (current[productId] || 0) + difference;
      const next = { ...current };
      if (nextQuantity <= 0) delete next[productId];
      else next[productId] = nextQuantity;
      return next;
    });
  }

  function saveNewProduct(): void {
    const name = itemName.trim();
    const price = Number(itemPrice);
    if (!name || !Number.isFinite(price) || price <= 0) {
      setNotice('Enter a product name and a price greater than zero.');
      return;
    }
    const newProduct = {
      id: `p${Date.now()}`,
      name,
      category: itemCategory === 'All' ? 'Electronics' : itemCategory,
      price,
      oldPrice: null,
      emoji: itemCategory === 'Textiles' ? '▱' : '◉',
      color: '#FFF0CF',
      rating: 'New',
      tag: 'JUST ADDED',
      store: itemStore,
      description: itemDescription.trim() || 'Product details will be added soon.',
    };
    setProducts((current) => [newProduct, ...current]);
    setItemName('');
    setItemPrice('');
    setItemDescription('');
    setCategory('All');
    setSearch('');
    setStoreId('all');
    setTab('Shop');
    setNotice(`${name} is now listed in the shop.`);
    setTimeout(() => setNotice(''), 2600);
  }

  const goToShop = () => { setSelectedProduct(null); setTab('Shop'); };

  function openShop(id: StoreId): void {
    setSelectedProduct(null);
    setStoreId(id);
    setCategory('All');
    setSearch('');
    setSortBy('Price: low to high');
    setTab('Shop');
    pageScroll.current?.scrollTo({ y: 0, animated: false });
  }

  function openProduct(product: Product): void {
    setSelectedProduct(product);
    setRecentViews((items) => [product, ...items.filter((item) => item.id !== product.id)].slice(0, 8));
    pageScroll.current?.scrollTo({ y: 0, animated: false });
  }
  function toggleFavorite(id: string): void { const saved = favorites.includes(id); setFavorites((items) => items.includes(id) ? items.filter((savedId) => savedId !== id) : [...items, id]); setNotice(saved ? 'Removed from wishlist.' : 'Added to wishlist.'); setTimeout(() => setNotice(''), 1800); }
  function placeDemoOrder(): void { if (!customer) { continueToPayment(); return; } if (!cartItems.length || !deliveryAddress) return; if (cartItems.some((product) => getStore(product.store).location !== deliveryLocation)) { setNotice('Your cart includes items from another location. Remove those items or switch back to that location before ordering.'); return; } const order: Order = { id: 'NB-' + Date.now().toString().slice(-6), date: new Date().toLocaleDateString('en-IN'), deliveryAddress: { ...deliveryAddress }, paymentMethod, paymentStatus: 'Demo — no payment taken', total: subtotal + (subtotal >= 999 ? 0 : 99), items: cartItems.map((product) => ({ id: product.id, name: product.name, quantity: cart[product.id] })) }; setOrders((items) => [order, ...items]); setCart({}); setTab('Orders'); setNotice('Demo order placed. No payment was taken.'); setTimeout(() => setNotice(''), 2600); }

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
          <TouchableOpacity style={[styles.heroButton, styles.adAction]} onPress={() => { setSupermarketSearch(ads[adIndex].search); setTab('Supermarket'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button"><Text style={styles.heroButtonText}>{ads[adIndex].label} →</Text></TouchableOpacity>
        </View>
        <View style={styles.adBadge} pointerEvents="none"><BrandLogo size={desktop ? 100 : 30} /><Text style={styles.adBadgeText}>LOCAL</Text></View>
        <View style={styles.adGlow} />
      </LinearGradient>
      </>}
      </AnimatedAd>
      {desktop ? <>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Find your next favourite</Text><Text style={styles.pageIntro}>From the shops around you, selected for your neighbourhood.</Text></View></View>
        <ProductGrid items={locationProducts.slice(0, 4)} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
      </> : <HomeProducts key={`products-${deliveryLocation}-${refreshVersion}`} products={locationProducts} onOpen={openProduct} />}
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
      <HomeShops key={`${deliveryLocation}-${refreshVersion}`} products={locationProducts} shops={locationShops} onSelect={openShop} />
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
      <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedProduct(null); setTab('Home'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
      <Text style={styles.pageTitle}>Supermarket</Text><Text style={styles.pageIntro}>Every item available from participating local electronics and textile shops.</Text>
      <View style={styles.promise}><Text style={styles.promiseIcon}>◷</Text><View><Text style={styles.promiseTitle}>Everything in one place</Text><Text style={styles.muted}>Browse shops in your selected location, delivered within 12 hours.</Text></View></View>
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
      <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedProduct(null); setTab('Home'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity>
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
      <Text style={styles.pageTitle}>Your cart</Text><Text style={styles.pageIntro}>{cartCount} {cartCount === 1 ? 'item' : 'items'} in your bag</Text>
      {cartItems.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>🛒</Text><Text style={styles.emptyTitle}>Your cart is waiting</Text><Text style={styles.muted}>Add something you love from the shop.</Text><TouchableOpacity style={styles.heroButton} onPress={goToShop}><Text style={styles.heroButtonText}>Browse products</Text></TouchableOpacity></View> : <>
        {cartItems.map((product) => <View key={product.id} style={styles.cartRow}><View style={[styles.cartArt, { backgroundColor: product.color || '#FFF0CF' }]}><ProductPhoto key={product.id} product={product} /></View><View style={styles.cartDetails}><Text style={styles.productName}>{product.name}</Text><Text style={styles.muted}>{money(product.price)} each</Text><Text style={styles.stockLine}>{getStore(product.store).name}</Text></View><View style={styles.qtyBox}><TouchableOpacity onPress={() => changeQuantity(product.id, -1)} style={styles.qtyButton} accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity><Text style={styles.qtyText}>{cart[product.id]}</Text><TouchableOpacity onPress={() => changeQuantity(product.id, 1)} style={styles.qtyButton} accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`}><Text style={styles.qtyButtonText}>+</Text></TouchableOpacity></View><Text style={styles.lineTotal}>{money(product.price * cart[product.id])}</Text></View>)}
        <View style={styles.summaryCard}><View style={styles.summaryLine}><Text style={styles.muted}>Subtotal</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View><View style={styles.summaryLine}><Text style={styles.muted}>Delivery</Text><Text style={styles.freeText}>{subtotal >= 999 ? 'FREE' : money(99)}</Text></View><View style={styles.divider} /><View style={styles.summaryLine}><Text style={styles.summaryTotalLabel}>Total</Text><Text style={styles.summaryTotal}>{money(subtotal + (subtotal >= 999 ? 0 : 99))}</Text></View><TouchableOpacity style={styles.primaryButton} onPress={continueToPayment}><Text style={styles.primaryButtonText}>Continue to payment</Text></TouchableOpacity><Text style={styles.checkoutNote}>Checkout is a demo. No payment will be taken.</Text></View>
      </>}
    </>;
  }

  function renderAddItem() {
    return <>
      <Text style={styles.pageTitle}>Add a product</Text><Text style={styles.pageIntro}>Create a listing for your store. It will appear in the shop on this device.</Text>
      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>PRODUCT NAME *</Text><TextInput value={itemName} onChangeText={setItemName} placeholder="e.g. Nova X Pro" placeholderTextColor="#999AA3" style={styles.formInput} />
        <Text style={styles.inputLabel}>PRICE (₹) *</Text><TextInput value={itemPrice} onChangeText={setItemPrice} placeholder="e.g. 24999" placeholderTextColor="#999AA3" keyboardType="numeric" style={styles.formInput} />
        <Text style={styles.inputLabel}>CATEGORY</Text><View style={styles.formChips}>{categories.filter((name) => name !== 'All').map((name) => <TouchableOpacity key={name} onPress={() => setItemCategory(name)} style={[styles.chip, itemCategory === name && styles.chipActive]}><Text style={[styles.chipText, itemCategory === name && styles.chipTextActive]}>{name}</Text></TouchableOpacity>)}</View>
        <Text style={styles.inputLabel}>STORE</Text><View style={styles.formChips}>{locationShops.map((store) => <TouchableOpacity key={store.id} onPress={() => setItemStore(store.id as Product['store'])} style={[styles.chip, itemStore === store.id && styles.chipActive]}><Text style={[styles.chipText, itemStore === store.id && styles.chipTextActive]}>{store.name}</Text></TouchableOpacity>)}</View>
        <Text style={styles.inputLabel}>DESCRIPTION</Text><TextInput value={itemDescription} onChangeText={setItemDescription} placeholder="A short description for customers" placeholderTextColor="#999AA3" style={[styles.formInput, styles.descriptionInput]} multiline />
        <TouchableOpacity style={styles.primaryButton} onPress={saveNewProduct}><Text style={styles.primaryButtonText}>Add product to shop</Text></TouchableOpacity>
        <Text style={styles.formNote}>This demo stores listings in app memory only. Connect an API and database to save them for every customer.</Text>
      </View>
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

  function renderOrders() { return <><TouchableOpacity style={styles.backButton} onPress={() => { setTab('Home'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} accessibilityRole="button" accessibilityLabel="Back to home"><Text style={styles.backButtonText}>← Back to Home</Text></TouchableOpacity><Text style={styles.pageTitle}>My orders</Text><Text style={styles.pageIntro}>Demo orders placed from this device.</Text>{orders.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>BOX</Text><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Orders appear here after checkout.</Text></View> : orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id}</Text><Text style={styles.muted}>{order.date} | {order.items.length} items | {money(order.total)} · {order.paymentMethod} · {order.paymentStatus}</Text></View></View>)}</>; }

  function renderHistory() { return <><Text style={styles.pageTitle}>History</Text><Text style={styles.pageIntro}>Purchases and recently viewed products.</Text>{orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id}</Text><Text style={styles.muted}>{order.date}</Text></View></View>)}<View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recently viewed</Text></View><ProductGrid items={recentViews.filter((product) => getStore(product.store).location === deliveryLocation)} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} /></>; }

  function renderAccount() { return <><Text style={styles.pageTitle}>Account</Text><Text style={styles.pageIntro}>Your temporary demo profile.</Text><View style={styles.formCard}><Text style={styles.inputLabel}>NAME</Text><TextInput value={accountName} onChangeText={setAccountName} placeholder='Your name' placeholderTextColor={palette.muted} style={styles.formInput} /><Text style={styles.inputLabel}>EMAIL</Text><TextInput value={accountEmail} onChangeText={setAccountEmail} placeholder='you@example.com' placeholderTextColor={palette.muted} keyboardType='email-address' autoCapitalize='none' style={styles.formInput} /><Text style={styles.formNote}>Profile details reset when the app restarts.</Text></View></>; }

  function renderCustomerCare() { return <><Text style={styles.pageTitle}>Customer care</Text><Text style={styles.pageIntro}>Help for this demo store.</Text><View style={styles.menuCard}><View><Text style={styles.storeName}>Where is my order?</Text><Text style={styles.muted}>See My Orders after demo checkout.</Text></View></View><View style={styles.menuCard}><View><Text style={styles.storeName}>Can I pay online?</Text><Text style={styles.muted}>Checkout is a demo and takes no payment.</Text></View></View><Text style={styles.formNote}>Add a real support contact before publishing.</Text></>; }

  function renderMore() { const sections: Array<{ icon: string; title: string; tab: Tab }> = [{ icon: 'F', title: 'Favourites', tab: 'Favorites' }, { icon: 'O', title: 'My orders', tab: 'Orders' }, { icon: 'H', title: 'History', tab: 'History' }, { icon: 'A', title: 'Account', tab: 'Account' }, { icon: 'C', title: 'Customer care', tab: 'Customer Care' }, { icon: '+', title: 'Add a product', tab: 'Add Item' }]; return <><Text style={styles.pageTitle}>More</Text><Text style={styles.pageIntro}>Saved items, orders, account, and help.</Text>{sections.map((section) => <TouchableOpacity key={section.tab} style={styles.menuCard} onPress={() => setTab(section.tab)} accessibilityRole='button'><Text style={styles.menuIcon}>{section.icon}</Text><View style={styles.menuCopy}><Text style={styles.storeName}>{section.title}</Text></View><Text style={styles.menuArrow}>{">"}</Text></TouchableOpacity>)}</>; }
  function renderDetails() {
    const product = selectedProduct;
    if (!product) return null;
    if (getStore(product.store).location !== deliveryLocation) return <>
      <Text style={styles.pageTitle}>{product.name}</Text>
      <View style={styles.emptyState}><Text style={styles.emptyTitle}>Unavailable in {deliveryLocation.split(',')[0]}</Text><Text style={styles.muted}>This item is sold by a shop in {getStore(product.store).location}. Change location to view it again.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedProduct(null)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>Back to browsing</Text></TouchableOpacity></View>
    </>;
    const relatedProducts = locationProducts
      .filter((item) => item.id !== product.id && item.category === product.category)
      .sort((a, b) => {
        const sameName = Number(b.name === product.name) - Number(a.name === product.name);
        return sameName || Math.abs(a.price - product.price) - Math.abs(b.price - product.price);
      })
      .slice(0, 6);
    return <>
      <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backButton}><Text style={styles.backButtonText}>←  Back to shop</Text></TouchableOpacity>
      <View style={styles.detailArt}><ProductPhoto key={product.id} product={product} /></View>
      <Text style={styles.formNote}>Illustrative demo photo. Actual shop item may differ.</Text>
      <Text style={styles.productCategory}>{product.category.toUpperCase()}  ·  ★ {product.rating || 'New'}</Text><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.detailPrice}>{money(product.price)}</Text>
      <Text style={styles.detailDescription}>{product.description || 'Product details will be added soon.'}</Text>
      <TouchableOpacity style={styles.detailFavorite} onPress={() => toggleFavorite(product.id)} accessibilityRole="button" accessibilityLabel={favorites.includes(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}><Text style={styles.detailFavoriteText}>{favorites.includes(product.id) ? '♥ Saved to wishlist · Remove' : '♡ Add to wishlist'}</Text></TouchableOpacity>
      <View style={styles.storeDetail}><Text style={styles.storeIcon}>{getStore(product.store).icon}</Text><View><Text style={styles.storeName}>{getStore(product.store).name}</Text><Text style={styles.muted}>Sold by this local shop</Text></View></View>
      <TouchableOpacity disabled={product.stock === 0} style={[styles.primaryButton, product.stock === 0 && { opacity: 0.5 }]} onPress={() => addToCart(product)} accessibilityRole="button" accessibilityState={{ disabled: product.stock === 0 }}><Text style={styles.primaryButtonText}>{product.stock === 0 ? 'Sold out' : `Add to cart · ${money(product.price)}`}</Text></TouchableOpacity>
      <ProductReviews key={product.id} reviews={productReviews[product.id] ?? []} onSubmit={(review) => setProductReviews((current) => ({ ...current, [product.id]: [review, ...(current[product.id] ?? [])] }))} />
      {relatedProducts.length > 0 ? <>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>You may also like</Text><Text style={styles.sectionHint}>{product.category.toUpperCase()}</Text></View>
        <ProductGrid items={relatedProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
      </> : null}
    </>;
  }

  const pageTitle = selectedProduct ? 'Product details' : tab;
  const primaryDrawerLinks: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: '⌂', label: 'Home', tab: 'Home' },
    { icon: '▦', label: 'Supermarket', tab: 'Supermarket' },
    { icon: '⌖', label: 'Shop by name', tab: 'Shops' },
    { icon: '▣', label: `Cart${cartCount ? ` (${cartCount})` : ''}`, tab: 'Cart' },
  ];
  const accountDrawerLinks: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: '⌖', label: 'Addresses', tab: 'Addresses' },
    { icon: '♡', label: `Wishlist (${favorites.length})`, tab: 'Favorites' },
    { icon: '◷', label: 'My orders', tab: 'Orders' },
    { icon: '◌', label: 'Account', tab: 'Account' },
    { icon: '?', label: 'Customer care', tab: 'Customer Care' },
  ];
  const drawerTranslateX = drawerProgress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <View style={styles.screen}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {desktop ? <WebStoreHeader products={locationProducts} onProduct={openProduct} active={tab} location={deliveryLocation} cartCount={cartCount} favorites={favorites.length} customerName={customer?.name} onLogout={logout} onNavigate={next => { setSelectedProduct(null); setTab(next); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} onSearch={query => { setSelectedProduct(null); setSupermarketSearch(query); setTab('Supermarket'); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} onLocation={() => setLocationOpen(true)} onAccount={() => { if (customer) { setSelectedProduct(null); setTab('Account'); } else router.push('/login'); }} onMenu={openDrawer} /> : null}
      <ScrollView ref={pageScroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" alwaysBounceVertical refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPage} tintColor={palette.gold} colors={[palette.primary, palette.gold]} progressBackgroundColor={palette.surface} title="Refreshing your store…" titleColor={palette.primary} />}>
        {!desktop ? <><View style={styles.topBar}>
          <View style={styles.topBarStart}>
            <TouchableOpacity style={styles.brandRow} onPress={() => { setSelectedProduct(null); setTab('Home'); }} accessibilityRole="button" accessibilityLabel="NearBy home">
              <BrandLogo size={39} /><Text style={styles.brand}>Near<Text style={styles.brandAccent}>By</Text></Text>
            </TouchableOpacity>
          </View>
          <View style={styles.topBarEnd}>
            <TouchableOpacity activeOpacity={0.75} style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Favorites'); }} accessibilityRole="button" accessibilityLabel={`Open wishlist, ${favorites.length} saved items`}><InterfaceIcon name="heart" color={palette.primaryText} />{favorites.length > 0 ? <Text style={styles.topCartText}>{favorites.length}</Text> : null}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Cart'); }} accessibilityRole="button" accessibilityLabel={`Open cart, ${cartCount} items`}><InterfaceIcon name="bag" color={palette.primaryText} />{cartCount > 0 ? <Text style={styles.topCartText}>{cartCount}</Text> : null}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} style={styles.menuToggle} onPress={openDrawer} accessibilityRole="button" accessibilityLabel="Open navigation menu"><InterfaceIcon name="menu" color={palette.primaryText} /></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.locationBar} onPress={() => setLocationOpen(true)} accessibilityRole="button" accessibilityLabel={`Delivery location: ${deliveryLocation}. Change location`}>
          <Text style={styles.locationPin}>⌖</Text><View style={styles.locationCopy}><Text style={styles.localSignatureText}>DELIVER TO</Text><Text numberOfLines={1} style={styles.locationName}>{deliveryLocation}</Text></View><Text style={styles.locationChange}>Change ⌄</Text>
        </TouchableOpacity>
        </> : null}
        {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
        <Text accessibilityLabel={`${pageTitle} page`} style={styles.srOnly}>{pageTitle}</Text>
        {selectedProduct ? renderDetails() : tab === 'Home' ? renderHome() : tab === 'Shop' ? renderShop() : tab === 'Supermarket' ? renderSupermarket() : tab === 'Shops' ? renderStores() : tab === 'Cart' ? renderCart() : tab === 'Addresses' ? <AddressBook addresses={addresses} selectedId={selectedAddressId} location={deliveryLocation} onSave={(address) => { setAddresses((current) => [...current, address]); useAddress(address.id); }} onSelect={useAddress} onRemove={(id) => { setAddresses((current) => current.filter((address) => address.id !== id)); if (selectedAddressId === id) setSelectedAddressId(null); }} onBack={() => setTab(addressReturnTab)} /> : tab === 'Payment' && customer ? <PaymentSection address={deliveryAddress} onManageAddress={() => { setAddressReturnTab('Payment'); setTab('Addresses'); }} subtotal={subtotal} itemCount={cartCount} location={deliveryLocation} method={paymentMethod} onChange={setPaymentMethod} onBack={() => setTab('Cart')} onConfirm={placeDemoOrder} canOrder={cartItems.every((product) => getStore(product.store).location === deliveryLocation)} /> : tab === 'Favorites' ? renderFavorites() : tab === 'Orders' ? renderOrders() : tab === 'History' ? renderHistory() : tab === 'Account' ? renderAccount() : tab === 'Customer Care' ? renderCustomerCare() : tab === 'Add Item' ? renderAddItem() : renderMore()}
        {desktop ? <View style={{ marginTop: 56, paddingTop: 30, paddingBottom: 12, borderTopWidth: 1, borderColor: palette.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
          <View style={{ maxWidth: 360 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BrandLogo size={48} /><Text style={styles.brand}>NearBy</Text></View><Text style={[styles.pageIntro, { marginTop: 12 }]}>Your town. Your shops. Your doorstep.</Text><Text style={styles.muted}>Shopping local in {deliveryLocation}.</Text></View>
          <View style={{ gap: 14 }}><Text style={styles.storeName}>Explore</Text>{([{ label: 'Supermarket', target: 'Supermarket' }, { label: 'Shop by name', target: 'Shops' }, { label: 'Wishlist', target: 'Favorites' }] as const).map(link => <TouchableOpacity key={link.target} accessibilityRole="button" onPress={() => { setSelectedProduct(null); setTab(link.target); pageScroll.current?.scrollTo({ y: 0, animated: false }); }}><Text style={styles.changeLink}>{link.label}</Text></TouchableOpacity>)}</View>
          <View style={{ gap: 14 }}><Text style={styles.storeName}>Your account</Text>{([{ label: 'My orders', target: 'Orders' }, { label: 'Addresses', target: 'Addresses' }, { label: 'Customer care', target: 'Customer Care' }] as const).map(link => <TouchableOpacity key={link.target} accessibilityRole="button" onPress={() => { setSelectedProduct(null); setTab(link.target); pageScroll.current?.scrollTo({ y: 0, animated: false }); }}><Text style={styles.changeLink}>{link.label}</Text></TouchableOpacity>)}</View>
        </View> : null}
      </ScrollView>
      <Modal visible={locationOpen} transparent animationType="fade" onRequestClose={() => setLocationOpen(false)}>
        <KeyboardAvoidingView style={styles.locationOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.drawerTapLayer} onPress={() => setLocationOpen(false)} accessibilityRole="button" accessibilityLabel="Close location selector" />
          <View style={styles.locationDialog} accessibilityViewIsModal>
            <View style={styles.drawerHeader}><Text style={styles.drawerBrand}>Delivery location</Text><TouchableOpacity onPress={() => setLocationOpen(false)} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Close location selector"><Text style={styles.drawerCloseText}>×</Text></TouchableOpacity></View>
            <Text style={styles.muted}>Choose your area to see its shops and available products.</Text>
            {(['Thodupuzha, Idukki', 'Muttom, Idukki'] as const).map((location) => <TouchableOpacity key={location} style={[styles.storeCard, deliveryLocation === location && styles.storeCardSelected]} accessibilityRole="button" accessibilityState={{ selected: deliveryLocation === location }} onPress={() => { setDeliveryLocation(location); setItemStore(stores.find((store) => store.location === location)!.id as Product['store']); setLocationOpen(false); }}><Text style={styles.locationPin}>⌖</Text><Text style={styles.storeName}>{location}</Text>{deliveryLocation === location ? <Text style={styles.changeLink}>✓</Text> : null}</TouchableOpacity>)}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {drawerOpen ? <View style={styles.drawerLayer}>
        <Animated.View pointerEvents="none" style={[styles.drawerBackdrop, { opacity: drawerProgress }]} />
        <Pressable style={styles.drawerTapLayer} onPress={closeDrawer} accessibilityRole="button" accessibilityLabel="Close navigation menu" />
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerTranslateX }] }]}>
          <View style={styles.drawerHeader}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><BrandLogo size={38} /><View><Text style={styles.drawerBrand}>NearBy</Text><Text style={styles.drawerSub}>THODUPUZHA · KERALA</Text></View></View><TouchableOpacity onPress={closeDrawer} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Close navigation menu"><Text style={styles.drawerCloseText}>×</Text></TouchableOpacity></View>
          <View style={styles.drawerDelivery}><Text style={styles.drawerDeliveryIcon}>◷</Text><Text style={styles.drawerDeliveryText}>Delivery within 12 hours</Text></View>
          <TouchableOpacity style={styles.drawerAuth} onPress={() => { closeDrawer(); if (customer) { setSelectedProduct(null); setTab('Account'); } else router.push('/login' as Href); }} accessibilityRole="button"><Text style={styles.drawerAuthKicker}>NearBy ACCOUNT</Text><Text style={styles.drawerAuthText}>{customer ? customer.name : 'Sign in or create account  →'}</Text></TouchableOpacity>
          {primaryDrawerLinks.map((item) => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          <View style={styles.drawerDivider} /><Text style={styles.drawerSectionLabel}>YOUR NearBy</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['light', 'dark'] as const).map((option) => <TouchableOpacity key={option} onPress={() => setMode(option)} accessibilityRole="button" accessibilityLabel={`${option} mode`} accessibilityState={{ selected: mode === option }} style={[styles.storeTypeButton, mode === option && styles.storeTypeSelected]}><Text style={[styles.storeTypeText, mode === option && styles.storeTypeActiveText]}>{option === 'light' ? '☀ Light' : '☾ Dark'}</Text></TouchableOpacity>)}
          </View>
          {accountDrawerLinks.map((item) => <TouchableOpacity key={item.tab} style={[styles.drawerItem, tab === item.tab && styles.drawerItemActive]} onPress={() => chooseTab(item.tab)} accessibilityRole="button" accessibilityState={{ selected: tab === item.tab }}><Text style={[styles.drawerItemIcon, tab === item.tab && styles.drawerItemTextActive]}>{item.icon}</Text><Text style={[styles.drawerItemText, tab === item.tab && styles.drawerItemTextActive]}>{item.label}</Text></TouchableOpacity>)}
          {customer ? <TouchableOpacity accessibilityRole="button" onPress={logout} style={[styles.drawerItem, { marginTop: 14, borderTopWidth: 1, borderTopColor: palette.border, borderRadius: 0 }]}><Text style={[styles.drawerItemText, { color: palette.terracotta }]}>Log out</Text></TouchableOpacity> : null}
        </Animated.View>
      </View> : null}
    </View>
  );
}

