import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import Text from './components/AppText';
import { CategoryPicker, ProductGrid, StorePicker } from './components/ShopComponents';
import { categories, getStore, money, palettes, sortOptions, starterProducts, stores } from './data/catalog';
import { createStyles } from './styles/appStyles';
import type { CategoryFilter, Order, Product, StoreId, Tab } from './data/types';

export default function StorefrontScreen() {
  const [tab, setTab] = useState<Tab>('Home');
  const palette = palettes.light;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [products, setProducts] = useState<Product[]>(starterProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentViews, setRecentViews] = useState<Product[]>([]);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [sortBy, setSortBy] = useState<string>('Featured');
  const [storeId, setStoreId] = useState<StoreId>('all');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState<CategoryFilter>('Phones');
  const [itemStore, setItemStore] = useState<Product['store']>('central');
  const [itemDescription, setItemDescription] = useState('');

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesStore = storeId === 'all' || product.store === storeId;
      const matchesCategory = category === 'All' || product.category === category;
      const matchesSearch = (product.name + ' ' + product.category).toLowerCase().includes(search.trim().toLowerCase());
      return matchesStore && matchesCategory && matchesSearch;
    });
    if (sortBy === 'Price: low to high') return filtered.sort((a, b) => a.price - b.price);
    if (sortBy === 'Price: high to low') return filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, storeId, category, search, sortBy]);

  const cartItems = products.filter((product) => cart[product.id] > 0);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const subtotal = cartItems.reduce((total, product) => total + product.price * cart[product.id], 0);

  function addToCart(product: Product) {
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
      category: itemCategory === 'All' ? 'Phones' : itemCategory,
      price,
      oldPrice: null,
      emoji: itemCategory === 'Phones' ? '📱' : itemCategory === 'Laptops' ? '💻' : itemCategory === 'Audio' ? '🎧' : '⌚',
      color: '#EAE8FF',
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

  function openProduct(product: Product): void { setSelectedProduct(product); setRecentViews((items) => [product, ...items.filter((item) => item.id !== product.id)].slice(0, 8)); }
  function toggleFavorite(id: string): void { const saved = favorites.includes(id); setFavorites((items) => saved ? items.filter((savedId) => savedId !== id) : [...items, id]); setNotice(saved ? 'Removed from favourites.' : 'Saved to favourites.'); setTimeout(() => setNotice(''), 1800); }
  function placeDemoOrder(): void { const order: Order = { id: 'TDP-' + Date.now().toString().slice(-6), date: new Date().toLocaleDateString('en-IN'), status: 'Processing', total: subtotal + (subtotal >= 999 ? 0 : 99), items: cartItems.map((product) => ({ id: product.id, name: product.name, quantity: cart[product.id] })) }; setOrders((items) => [order, ...items]); setCart({}); setTab('Orders'); setNotice('Demo order placed. No payment was taken.'); setTimeout(() => setNotice(''), 2600); }

  function renderHome() {
    const shopStores = stores.filter((store) => store.id !== 'all');
    return <>
      <View style={styles.delivery}><Text style={styles.deliveryText}>📍  Shopping at <Text style={styles.deliveryStrong}>{storeId === 'all' ? 'All stores' : getStore(storeId).name}</Text></Text><TouchableOpacity onPress={() => setTab('Stores')}><Text style={styles.changeLink}>Change</Text></TouchableOpacity></View>
      <LinearGradient colors={palette.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, styles.featuredShopAd]}>
        <Text style={styles.eyebrow}>THIS WEEK'S FEATURED SHOP</Text>
        <Text style={styles.heroTitle}>TDP Central</Text>
        <Text style={styles.heroSubtitle}>Explore trusted local tech and helpful in-store service.</Text>
        <TouchableOpacity style={styles.heroButton} onPress={() => { setStoreId('central'); setCategory('All'); setSearch(''); setTab('Shop'); }} accessibilityRole="button"><Text style={styles.heroButtonText}>Visit featured shop  →</Text></TouchableOpacity>
        <View style={styles.adGlow} />
      </LinearGradient>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Explore our shops</Text><Text style={styles.sectionHint}>{shopStores.length} local locations</Text></View>
      <View style={styles.homeStoreGrid}>
        {shopStores.map((store) => {
          const count = products.filter((product) => product.store === store.id).length;
          return <TouchableOpacity key={store.id} style={styles.homeStoreCard} onPress={() => { setStoreId(store.id); setCategory('All'); setSearch(''); setTab('Shop'); }} accessibilityRole="button" accessibilityLabel={"Browse " + store.name}>
            <View style={styles.homeStoreCardTop}><View style={styles.homeStoreIcon}><Text style={styles.homeStoreEmoji}>{store.icon}</Text></View><Text style={styles.storeBlockArrow}>›</Text></View>
            <Text style={styles.storeBlockName}>{store.name}</Text>
            <Text numberOfLines={2} style={styles.muted}>{store.area}</Text>
            <Text style={styles.storeCount}>{count} products available</Text>
          </TouchableOpacity>;
        })}
      </View>
    </>;
  }

  function renderShop() {
    return <>
      <Text style={styles.pageTitle}>Shop tech</Text><Text style={styles.pageIntro}>Search and refine products in one place.</Text>
      <View style={styles.filterPanel}>
        <View style={styles.filterPanelHeading}><Text style={styles.filterPanelTitle}>Search & filters</Text><Text style={styles.sectionHint}>Choose any combination</Text></View>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={palette.muted} style={styles.searchInput} accessibilityLabel="Search products" returnKeyType="search" /><TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.clearSearch}>{search ? 'Clear' : ''}</Text></TouchableOpacity></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>STORE</Text><StorePicker styles={styles} stores={stores} value={storeId} onChange={setStoreId} /></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>CATEGORY</Text><CategoryPicker styles={styles} value={category} onChange={setCategory} options={categories} /></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>SORT BY</Text><CategoryPicker styles={styles} value={sortBy} onChange={setSortBy} options={sortOptions} /></View>
      </View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{visibleProducts.length} products</Text><Text style={styles.sectionHint}>{storeId === 'all' ? 'All stores' : getStore(storeId).name}</Text></View>
      <ProductGrid items={visibleProducts} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />
    </>;
  }

  function renderStores() {
    return <>
      <Text style={styles.pageTitle}>Choose a store</Text><Text style={styles.pageIntro}>Pick a location to see what is available nearby.</Text>
      {stores.filter((store) => store.id !== 'all').map((store) => {
        const count = products.filter((product) => product.store === store.id).length;
        return <TouchableOpacity key={store.id} style={[styles.storeCard, storeId === store.id && styles.storeCardSelected]} onPress={() => { setStoreId(store.id); setTab('Shop'); }} accessibilityRole="button">
          <Text style={styles.storeIcon}>{store.icon}</Text><View style={styles.storeCopy}><Text style={styles.storeName}>{store.name}</Text><Text style={styles.muted}>{store.area}</Text><Text style={styles.storeCount}>{count} products available  ·  Select store →</Text></View>
        </TouchableOpacity>;
      })}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => { setStoreId('all'); setTab('Shop'); }}><Text style={styles.secondaryButtonText}>Browse all stores</Text></TouchableOpacity>
    </>;
  }

  function renderCart() {
    return <>
      <Text style={styles.pageTitle}>Your cart</Text><Text style={styles.pageIntro}>{cartCount} {cartCount === 1 ? 'item' : 'items'} in your bag</Text>
      {cartItems.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>🛒</Text><Text style={styles.emptyTitle}>Your cart is waiting</Text><Text style={styles.muted}>Add something you love from the shop.</Text><TouchableOpacity style={styles.heroButton} onPress={goToShop}><Text style={styles.heroButtonText}>Browse products</Text></TouchableOpacity></View> : <>
        {cartItems.map((product) => <View key={product.id} style={styles.cartRow}><View style={[styles.cartArt, { backgroundColor: product.color || '#EAE8FF' }]}><Text style={styles.cartEmoji}>{product.emoji || '📦'}</Text></View><View style={styles.cartDetails}><Text style={styles.productName}>{product.name}</Text><Text style={styles.muted}>{money(product.price)} each</Text><Text style={styles.stockLine}>{getStore(product.store).name}</Text></View><View style={styles.qtyBox}><TouchableOpacity onPress={() => changeQuantity(product.id, -1)} style={styles.qtyButton} accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity><Text style={styles.qtyText}>{cart[product.id]}</Text><TouchableOpacity onPress={() => changeQuantity(product.id, 1)} style={styles.qtyButton} accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`}><Text style={styles.qtyButtonText}>+</Text></TouchableOpacity></View><Text style={styles.lineTotal}>{money(product.price * cart[product.id])}</Text></View>)}
        <View style={styles.summaryCard}><View style={styles.summaryLine}><Text style={styles.muted}>Subtotal</Text><Text style={styles.summaryValue}>{money(subtotal)}</Text></View><View style={styles.summaryLine}><Text style={styles.muted}>Delivery</Text><Text style={styles.freeText}>{subtotal >= 999 ? 'FREE' : money(99)}</Text></View><View style={styles.divider} /><View style={styles.summaryLine}><Text style={styles.summaryTotalLabel}>Total</Text><Text style={styles.summaryTotal}>{money(subtotal + (subtotal >= 999 ? 0 : 99))}</Text></View><TouchableOpacity style={styles.primaryButton} onPress={placeDemoOrder}><Text style={styles.primaryButtonText}>Place demo order</Text></TouchableOpacity><Text style={styles.checkoutNote}>Checkout is a demo. No payment will be taken.</Text></View>
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
        <Text style={styles.inputLabel}>STORE</Text><View style={styles.formChips}>{stores.filter((store) => store.id !== 'all').map((store) => <TouchableOpacity key={store.id} onPress={() => setItemStore(store.id as Product['store'])} style={[styles.chip, itemStore === store.id && styles.chipActive]}><Text style={[styles.chipText, itemStore === store.id && styles.chipTextActive]}>{store.name}</Text></TouchableOpacity>)}</View>
        <Text style={styles.inputLabel}>DESCRIPTION</Text><TextInput value={itemDescription} onChangeText={setItemDescription} placeholder="A short description for customers" placeholderTextColor="#999AA3" style={[styles.formInput, styles.descriptionInput]} multiline />
        <TouchableOpacity style={styles.primaryButton} onPress={saveNewProduct}><Text style={styles.primaryButtonText}>Add product to shop</Text></TouchableOpacity>
        <Text style={styles.formNote}>This demo stores listings in app memory only. Connect an API and database to save them for every customer.</Text>
      </View>
    </>;
  }

  function renderFavorites() { const items = products.filter((product) => favorites.includes(product.id)); return <><Text style={styles.pageTitle}>Favourites</Text><Text style={styles.pageIntro}>Your bookmarked products.</Text><ProductGrid items={items} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} />{items.length === 0 ? <TouchableOpacity style={styles.secondaryButton} onPress={goToShop}><Text style={styles.secondaryButtonText}>Browse products</Text></TouchableOpacity> : null}</>; }

  function renderOrders() { return <><Text style={styles.pageTitle}>My orders</Text><Text style={styles.pageIntro}>Demo orders placed from this device.</Text>{orders.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyEmoji}>BOX</Text><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Orders appear here after checkout.</Text></View> : orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id} | {order.status}</Text><Text style={styles.muted}>{order.date} | {order.items.length} items | {money(order.total)}</Text></View></View>)}</>; }

  function renderHistory() { return <><Text style={styles.pageTitle}>History</Text><Text style={styles.pageIntro}>Purchases and recently viewed products.</Text>{orders.map((order) => <View key={order.id} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{order.id}</Text><Text style={styles.muted}>{order.date} | {order.status}</Text></View></View>)}<View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recently viewed</Text></View><ProductGrid items={recentViews} styles={styles} favorites={favorites} onOpen={openProduct} onToggleFavorite={toggleFavorite} onAdd={addToCart} getStore={getStore} money={money} /></>; }

  function renderAccount() { return <><Text style={styles.pageTitle}>Account</Text><Text style={styles.pageIntro}>Your temporary demo profile.</Text><View style={styles.formCard}><Text style={styles.inputLabel}>NAME</Text><TextInput value={accountName} onChangeText={setAccountName} placeholder='Your name' placeholderTextColor={palette.muted} style={styles.formInput} /><Text style={styles.inputLabel}>EMAIL</Text><TextInput value={accountEmail} onChangeText={setAccountEmail} placeholder='you@example.com' placeholderTextColor={palette.muted} keyboardType='email-address' autoCapitalize='none' style={styles.formInput} /><Text style={styles.formNote}>Profile details reset when the app restarts.</Text></View></>; }

  function renderCustomerCare() { return <><Text style={styles.pageTitle}>Customer care</Text><Text style={styles.pageIntro}>Help for this demo store.</Text><View style={styles.menuCard}><View><Text style={styles.storeName}>Where is my order?</Text><Text style={styles.muted}>See My Orders after demo checkout.</Text></View></View><View style={styles.menuCard}><View><Text style={styles.storeName}>Can I pay online?</Text><Text style={styles.muted}>Checkout is a demo and takes no payment.</Text></View></View><Text style={styles.formNote}>Add a real support contact before publishing.</Text></>; }

  function renderMore() { const sections: Array<{ icon: string; title: string; tab: Tab }> = [{ icon: 'F', title: 'Favourites', tab: 'Favorites' }, { icon: 'O', title: 'My orders', tab: 'Orders' }, { icon: 'H', title: 'History', tab: 'History' }, { icon: 'A', title: 'Account', tab: 'Account' }, { icon: 'C', title: 'Customer care', tab: 'Customer Care' }, { icon: '+', title: 'Add a product', tab: 'Add Item' }]; return <><Text style={styles.pageTitle}>More</Text><Text style={styles.pageIntro}>Saved items, orders, account, and help.</Text>{sections.map((section) => <TouchableOpacity key={section.tab} style={styles.menuCard} onPress={() => setTab(section.tab)} accessibilityRole='button'><Text style={styles.menuIcon}>{section.icon}</Text><View style={styles.menuCopy}><Text style={styles.storeName}>{section.title}</Text></View><Text style={styles.menuArrow}>{">"}</Text></TouchableOpacity>)}</>; }
  function renderDetails() {
    const product = selectedProduct;
    if (!product) return null;
    return <>
      <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backButton}><Text style={styles.backButtonText}>←  Back to shop</Text></TouchableOpacity>
      <View style={[styles.detailArt, { backgroundColor: product.color || '#EAE8FF' }]}><Text style={styles.detailEmoji}>{product.emoji || '📦'}</Text></View>
      <Text style={styles.productCategory}>{product.category.toUpperCase()}  ·  ★ {product.rating || 'New'}</Text><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.detailPrice}>{money(product.price)}</Text>
      <Text style={styles.detailDescription}>{product.description || 'Product details will be added soon.'}</Text>
      <View style={styles.storeDetail}><Text style={styles.storeIcon}>{getStore(product.store).icon}</Text><View><Text style={styles.storeName}>{getStore(product.store).name}</Text><Text style={styles.muted}>Available for local store pickup</Text></View></View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => addToCart(product)}><Text style={styles.primaryButtonText}>Add to cart · {money(product.price)}</Text></TouchableOpacity>
    </>;
  }

  const tabItems = [
    { name: 'Home', icon: '⌂' }, { name: 'Shop', icon: '▦' }, { name: 'Stores', icon: '⌖' }, { name: 'Cart', icon: '🛒' }, { name: 'More', icon: '•••' },
  ];
  const pageTitle = selectedProduct ? 'Product details' : tab;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.brandRow} onPress={() => { setSelectedProduct(null); setTab('Home'); }} accessibilityRole="button" accessibilityLabel="TDP Store home">
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View><Text style={styles.brand}>tdp<Text style={styles.brandAccent}>store</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topCart} onPress={() => { setSelectedProduct(null); setTab('Cart'); }} accessibilityRole="button" accessibilityLabel={`Open cart, ${cartCount} items`}><Text style={styles.topCartText}>🛒  Cart{cartCount > 0 ? ` (${cartCount})` : ''}</Text></TouchableOpacity>
        </View>
        {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
        <Text accessibilityLabel={`${pageTitle} page`} style={styles.srOnly}>{pageTitle}</Text>
        {selectedProduct ? renderDetails() : tab === 'Home' ? renderHome() : tab === 'Shop' ? renderShop() : tab === 'Stores' ? renderStores() : tab === 'Cart' ? renderCart() : tab === 'Favorites' ? renderFavorites() : tab === 'Orders' ? renderOrders() : tab === 'History' ? renderHistory() : tab === 'Account' ? renderAccount() : tab === 'Customer Care' ? renderCustomerCare() : tab === 'Add Item' ? renderAddItem() : renderMore()}
      </ScrollView>
      <View style={styles.bottomNav}>
        {tabItems.map((item) => {
          const active = item.name === tab || (item.name === 'More' && ['Add Item', 'Favorites', 'Orders', 'History', 'Account', 'Customer Care'].includes(tab));
          return <TouchableOpacity key={item.name} onPress={() => { setSelectedProduct(null); setTab(item.name as Tab); }} style={styles.navItem} accessibilityRole="button" accessibilityState={{ selected: active }}>
            <View style={styles.navIconWrap}><Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>{item.name === 'Cart' && cartCount > 0 ? <View style={styles.navBadge}><Text style={styles.navBadgeText}>{cartCount}</Text></View> : null}</View>
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.name}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>
  );
}

