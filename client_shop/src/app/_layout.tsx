import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ShopDataProvider } from '../context/ShopDataContext';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const tabs: Array<{ route: string; title: string; icon: IconName }> = [
  { route: 'index', title: 'Home', icon: 'view-dashboard-outline' },
  { route: 'orders', title: 'Orders', icon: 'receipt-text-outline' },
  { route: 'deliveries', title: 'Deliveries', icon: 'truck-delivery-outline' },
  { route: 'products', title: 'Products', icon: 'tag-multiple-outline' },
  { route: 'inventory', title: 'Stock status', icon: 'cube-outline' },
  { route: 'team', title: 'Team', icon: 'account-group-outline' },
  { route: 'store', title: 'Store', icon: 'storefront-outline' },
];

export default function ShopLayout() {
  return <ShopDataProvider><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3677BD', tabBarInactiveTintColor: '#566476', tabBarStyle: { backgroundColor: '#F4F6F8', borderTopColor: '#CFD7E1', height: 60, paddingTop: 5, paddingBottom: 5 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '700' } }}>
    {tabs.map(({ route, title, icon }) => <Tabs.Screen key={route} name={route} options={{ title, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={icon} color={color} size={size} /> }} />)}
  </Tabs></ShopDataProvider>;
}
