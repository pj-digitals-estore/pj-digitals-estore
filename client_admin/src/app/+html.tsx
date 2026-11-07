import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function RootDocument({ children }: PropsWithChildren) {
  return <html lang="en"><head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>NearBy Admin</title>
    <meta name="application-name" content="NearBy Admin" />
    <meta name="apple-mobile-web-app-title" content="NearBy Admin" />
    <ScrollViewStyleReset />
  </head><body>{children}</body></html>;
}