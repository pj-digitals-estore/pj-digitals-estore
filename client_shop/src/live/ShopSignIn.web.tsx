import { SignIn } from '@clerk/react';
import { useAppTheme } from '../AppearanceContext';

export default function ShopSignIn() {
  const { colors: c } = useAppTheme();
  return <SignIn routing="hash" forceRedirectUrl="/" appearance={{
    variables: { colorPrimary: c.primary, colorBackground: c.surface, colorForeground: c.text, colorMutedForeground: c.muted, borderRadius: '14px' },
    elements: { formFieldInput: { backgroundColor: c.bg, color: c.text, fontSize: 16 }, rootBox: { width: '100%' }, cardBox: { width: '100%', maxWidth: '100%' }, card: { boxShadow: c.glow, border: `1px solid ${c.border}` }, footerAction: { display: 'none' } },
  }} />;
}
