export type Category = 'Phones' | 'Laptops' | 'Audio' | 'Accessories' | 'Gaming';
export type CategoryFilter = 'All' | Category;
export type StoreId = 'all' | 'central' | 'north' | 'campus' | 'east' | 'west';
export type Store = { id: StoreId; name: string; area: string; icon: string };
export type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  oldPrice?: number | null;
  emoji?: string;
  color?: string;
  rating?: string;
  tag?: string;
  store: Exclude<StoreId, 'all'>;
  description?: string;
};
export type Order = {
  id: string;
  date: string;
  status: string;
  total: number;
  items: Array<{ id: string; name: string; quantity: number }>;
};
export type Tab = 'Home' | 'Shop' | 'Stores' | 'Cart' | 'More' | 'Favorites' | 'Orders' | 'History' | 'Account' | 'Customer Care' | 'Add Item';
