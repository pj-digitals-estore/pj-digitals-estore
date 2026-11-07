import { SignIn } from '@clerk/react';
import { useAppTheme } from '../AppearanceContext';

export default function AdminSignIn() {
  const { colors: c } = useAppTheme();
  return <SignIn routing="hash" forceRedirectUrl="/" signUpUrl="/login" appearance={{ variables: {
    colorPrimary: c.primary, colorBackground: c.surface, colorForeground: c.text, colorMutedForeground: c.muted,
    borderRadius: '0.75rem',
  }, elements: { rootBox: { width: '100%', minWidth: 0 }, cardBox: { width: '100%', minWidth: 0, boxShadow: 'none' }, card: { padding: 0, border: 0, boxShadow: 'none' }, formFieldInput: { backgroundColor: c.bg, color: c.text }, footerAction: { display: 'none' } } }} />;
}
