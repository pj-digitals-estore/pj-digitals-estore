import { Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import type { Product, Store } from '../data/types';
import type { createStyles } from '../styles/appStyles';
import Text from './AppText';

type Styles = ReturnType<typeof createStyles>;
type ProductCardProps = {
  product: Product;
  styles: Styles;
  favorites: string[];
  onOpen: (product: Product) => void;
  onToggleFavorite: (id: string) => void;
  onAdd: (product: Product) => void;
  getStore: (id: Product['store']) => Store;
  money: (amount: number) => string;
};

export function ProductCard({ product, styles, favorites, onOpen, onToggleFavorite, onAdd, getStore, money }: ProductCardProps) {
  const isFavorite = favorites.includes(product.id);
  return (
    <View style={styles.productCard}>
      <View>
        <Pressable onPress={() => onOpen(product)} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
          <View style={[styles.productArt, { backgroundColor: product.color ?? '#EAE8FF' }]}>
            <Text style={styles.productEmoji}>{product.emoji ?? '📦'}</Text>
            <View style={styles.productTag}><Text style={styles.productTagText}>{product.tag ?? 'IN STORE'}</Text></View>
          </View>
        </Pressable>
        <TouchableOpacity onPress={() => onToggleFavorite(product.id)} style={styles.favoriteButton} accessibilityRole="button" accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}>
          <Text style={styles.favoriteButtonText}>{isFavorite ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productCategory}>{product.category.toUpperCase()}  ·  ★ {product.rating ?? 'New'}</Text>
        <TouchableOpacity onPress={() => onOpen(product)}><Text numberOfLines={1} style={styles.productName}>{product.name}</Text></TouchableOpacity>
        <Text style={styles.productPrice}>{money(product.price)}</Text>
        <Text style={styles.stockLine}>Available at {getStore(product.store).name}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => onAdd(product)} accessibilityRole="button"><Text style={styles.addButtonText}>+  Add to cart</Text></TouchableOpacity>
      </View>
    </View>
  );
}

type ProductGridProps = Omit<ProductCardProps, 'product'> & { items: Product[] };
export function ProductGrid({ items, ...cardProps }: ProductGridProps) {
  if (items.length === 0) return <View style={cardProps.styles.emptyState}><Text style={cardProps.styles.emptyEmoji}>🔎</Text><Text style={cardProps.styles.emptyTitle}>No gadgets found</Text><Text style={cardProps.styles.muted}>Try a different search or filter.</Text></View>;
  return <View style={cardProps.styles.productGrid}>{items.map((product) => <ProductCard key={product.id} product={product} {...cardProps} />)}</View>;
}

type PickerProps<T extends string> = { styles: Styles; value: T; onChange: (value: T) => void; options: readonly T[] };
export function StorePicker({ styles, stores, value, onChange }: { styles: Styles; stores: Store[]; value: Store['id']; onChange: (value: Store['id']) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{stores.map((store) => <TouchableOpacity key={store.id} onPress={() => onChange(store.id)} style={[styles.chip, value === store.id && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: value === store.id }}><Text style={[styles.chipText, value === store.id && styles.chipTextActive]}>{store.name}</Text></TouchableOpacity>)}</ScrollView>;
}

export function CategoryPicker<T extends string>({ styles, value, onChange, options }: PickerProps<T>) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{options.map((name) => <TouchableOpacity key={name} onPress={() => onChange(name)} style={[styles.chip, value === name && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: value === name }}><Text style={[styles.chipText, value === name && styles.chipTextActive]}>{name}</Text></TouchableOpacity>)}</ScrollView>;
}
