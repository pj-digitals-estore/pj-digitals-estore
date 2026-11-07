import { ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '../AppearanceContext';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import DeliveryLoginScreen from '../screens/DeliveryLoginScreen';
import DeliveryScreen from '../screens/DeliveryOrdersScreen';

export default function DeliveryRoute() {
  const { partner, ready } = useDeliveryAuth();
  const { colors: c } = useAppTheme();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator color={c.primary} /></View>;
  return partner ? <DeliveryScreen key={partner.id} /> : <DeliveryLoginScreen />;
}
