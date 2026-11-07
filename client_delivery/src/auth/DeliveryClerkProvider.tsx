import type { PropsWithChildren } from 'react';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { isExpoGo } from '../lib/hostedAuth';

export default function DeliveryClerkProvider({ children, publishableKey }: PropsWithChildren<{ publishableKey: string }>) {
  return <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} __experimental_disableNativeClientSync={isExpoGo()}>{children}</ClerkProvider>;
}
