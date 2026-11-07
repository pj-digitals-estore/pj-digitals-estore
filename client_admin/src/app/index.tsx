import LiveAdminScreen from '../screens/LiveAdminScreen';
import AdminScreen from '../screens/AdminScreen';
import { useAdminAccess } from '../auth/AdminAccessContext';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AdminLoadingScreen } from '../components/AdminLoadingScreen';
import { useAppTheme } from '../AppearanceContext';
import { AccessManagementProvider } from '../components/AccessManagement';

export default function AdminIndex() {
  const { allowed } = useAdminAccess();
  return allowed ? <AuthorizedWorkspace /> : null;
}

// Mount after access is granted, so every successful login gets its own intro.
// Normal navigation, polling and appearance changes keep this component mounted.
function AuthorizedWorkspace() {
  const { preview } = useAdminAccess();
  const { colors } = useAppTheme();
  const [opening, setOpening] = useState(true);
  const finishOpening = useCallback(() => setOpening(false), []);
  return <AccessManagementProvider><View style={{ flex: 1, backgroundColor: colors.bg }}>
    {opening ? <AdminLoadingScreen onFinish={finishOpening} /> : !preview && process.env.EXPO_PUBLIC_ADMIN_DATA_MODE === 'live' ? <LiveAdminScreen /> : <AdminScreen />}
  </View></AccessManagementProvider>;
}
