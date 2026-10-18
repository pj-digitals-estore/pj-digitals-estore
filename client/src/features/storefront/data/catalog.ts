import type { CategoryFilter, Product, Store, StoreId } from './types';

export type Palette = {
  background: string; surface: string; text: string; muted: string; primary: string;
  primaryText: string; soft: string; tint: string; heroAccent: string; border: string;
  strong: string; glass: string; gradient: [string, string, string];
};

const palettes: { light: Palette } = {
  light: { background: '#E9EDF2', surface: '#F4F6F8', text: '#1E2938', muted: '#566476', primary: '#3677BD', primaryText: '#285B91', soft: '#DCE6F1', tint: '#D3E0EE', heroAccent: 'rgba(255,255,255,0.16)', border: '#CFD7E1', strong: '#203A57', glass: 'rgba(244,246,248,0.96)', gradient: ['#376FA7', '#2D5F91', '#233E5E'] },
};

const categories: CategoryFilter[] = ['All', 'Phones', 'Laptops', 'Audio', 'Accessories', 'Gaming'];
const sortOptions = ['Featured', 'Price: low to high', 'Price: high to low'];
const stores: Store[] = [
  { id: 'all', name: 'All stores', area: 'Browse every location', icon: '🛍️' },
  { id: 'central', name: 'TDP Central', area: 'MG Road · 10:00 AM – 9:00 PM', icon: '🏬' },
  { id: 'north', name: 'TDP North', area: 'North Avenue · 10:00 AM – 8:00 PM', icon: '🏪' },
  { id: 'campus', name: 'TDP Campus', area: 'University Road · 9:00 AM – 7:00 PM', icon: '🏢' },
  { id: 'east', name: 'TDP East Market', area: 'Lake View Road - 10:00 AM to 8:00 PM', icon: 'E' },
  { id: 'west', name: 'TDP West End', area: 'Park Street - 10:00 AM to 9:00 PM', icon: 'W' }
];
const starterProducts: Product[] = [
  { id: 'p1', name: 'Nova X Pro', category: 'Phones', price: 54999, oldPrice: 62999, emoji: '📱', color: '#E8E9FF', rating: '4.8', tag: 'BESTSELLER', store: 'central', description: 'A bright display, a capable camera, and all-day battery life in one everyday phone.' },
  { id: 'p2', name: 'AeroBook 14', category: 'Laptops', price: 74999, oldPrice: 84999, emoji: '💻', color: '#E1F1EE', rating: '4.7', tag: 'NEW', store: 'north', description: 'A lightweight laptop for study, work, and everything in between.' },
  { id: 'p3', name: 'Studio Buds+', category: 'Audio', price: 8999, oldPrice: 11999, emoji: '🎧', color: '#FCE9DE', rating: '4.9', tag: 'SAVE 25%', store: 'campus', description: 'Comfortable wireless sound for your commute, calls, and playlists.' },
  { id: 'p4', name: 'Pulse Watch 3', category: 'Accessories', price: 12999, oldPrice: 15999, emoji: '⌚', color: '#F5E8F4', rating: '4.6', tag: 'POPULAR', store: 'central', description: 'A simple everyday smartwatch with activity and notification features.' },
  { id: 'p5', name: 'Zen Phone 12', category: 'Phones', price: 32999, emoji: 'PH', color: '#E1ECF7', rating: '4.5', tag: 'VALUE PICK', store: 'north', description: 'An everyday phone with a vivid display and long battery life.' },
  { id: 'p6', name: 'PixelPro Max', category: 'Phones', price: 67999, emoji: 'PH', color: '#F4E6D8', rating: '4.8', tag: 'CAMERA PICK', store: 'east', description: 'A smooth screen and capable camera for everyday photography.' },
  { id: 'p7', name: 'Mini One 5G', category: 'Phones', price: 19999, emoji: 'PH', color: '#E2F0E2', rating: '4.4', tag: 'BUDGET PICK', store: 'west', description: 'A compact 5G phone for calls, apps, and streaming.' },
  { id: 'p8', name: 'TitanBook 15', category: 'Laptops', price: 99999, emoji: 'NB', color: '#E8E5F6', rating: '4.7', tag: 'CREATOR PICK', store: 'central', description: 'A powerful laptop for creative projects, study, and work.' },
  { id: 'p9', name: 'ThinkBook Air', category: 'Laptops', price: 65999, emoji: 'NB', color: '#DDECEB', rating: '4.6', tag: 'LIGHTWEIGHT', store: 'campus', description: 'A slim everyday laptop that is easy to carry.' },
  { id: 'p10', name: 'SoundMax Wireless', category: 'Audio', price: 4999, emoji: 'HD', color: '#E9E2F3', rating: '4.4', tag: 'WIRELESS', store: 'north', description: 'Wireless headphones with comfortable cushions.' },
  { id: 'p11', name: 'BoomBox Go', category: 'Audio', price: 6999, emoji: 'SP', color: '#F6E7D9', rating: '4.6', tag: 'PORTABLE', store: 'east', description: 'A portable speaker for taking your playlists along.' },
  { id: 'p12', name: 'Arc Wireless Controller', category: 'Gaming', price: 3999, emoji: 'GM', color: '#E8E6F8', rating: '4.5', tag: 'GAMING', store: 'central', description: 'A wireless controller with a comfortable grip.' },
  { id: 'p13', name: 'ViewPoint 27 Monitor', category: 'Gaming', price: 18999, emoji: 'MN', color: '#E2ECE9', rating: '4.6', tag: '27 INCH', store: 'west', description: 'A 27-inch monitor for gaming or a home office.' },
  { id: 'p14', name: 'FastCharge 45W', category: 'Accessories', price: 1299, emoji: 'CH', color: '#F3E9D8', rating: '4.5', tag: 'FAST CHARGE', store: 'east', description: 'A compact fast charger for compatible devices.' },
];
const money = (amount: number): string => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const getStore = (id: StoreId): Store => stores.find((store) => store.id === id) ?? stores[1];

export { palettes, categories, sortOptions, stores, starterProducts, money, getStore };
