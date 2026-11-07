import { useCallback, useEffect, useRef, useState } from 'react';
import { getProduct, getProducts, type ServerProduct } from '@/services/products';
import type { Product, Store, Category, DeliveryLocation } from '../data/types';

export function toStoreProduct(item: ServerProduct): Product {
  return {
    id: item._id, name: item.name, description: item.description, price: item.price,
    stock: item.stock, images: item.images, sizes: item.sizes, serverCategory: item.category,
    category: (['Textiles', 'Home Appliances', 'Computer Items', 'Other'].includes(item.category) ? item.category : item.category === 'Laptop' ? 'Computer Items' : 'Electronics') as Category,
    store: item.shop?._id || 'catalogue', tag: item.isFeatured ? 'Featured' : undefined,
  };
}

export function useCatalogue(location?: DeliveryLocation) {
  const city = location?.split(',')[0];
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([{ id: 'all', name: 'All local shops', area: 'Browse participating stores', icon: '⌂' }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError('');
    try {
      const first = await getProducts(1, 100, controller.signal, city);
      const all = [...first.products];
      for (let page = 2; page <= first.pages; page++) {
        all.push(...(await getProducts(page, 100, controller.signal, city)).products);
      }
      if (!controller.signal.aborted) {
        setProducts([...new Map(all.map(item => [item._id, toStoreProduct(item)])).values()]);
        const shops = new Map<string, Store>();
        for (const item of all) if (item.shop && ['Thodupuzha','Muttom'].includes(item.shop.city)) shops.set(item.shop._id, { id: item.shop._id, name: item.shop.name, area: item.shop.address, icon: '▣', category: item.shop.category as Category, location: (item.shop.city + ', Idukki') as DeliveryLocation });
        setStores([{ id: 'all', name: 'All local shops', area: 'Browse participating stores', icon: '⌂' }, ...shops.values()]);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load products.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [city]);
  useEffect(() => { const first = setTimeout(() => void reload(), 0); return () => { clearTimeout(first); active.current?.abort(); }; }, [reload]);
  const details = useCallback(async (id: string) => {
    const item = toStoreProduct(await getProduct(id));
    setProducts(current => current.map(product => product.id === id ? item : product));
    return item;
  }, []);
  return { products, stores, loading, error, reload, details };
}
