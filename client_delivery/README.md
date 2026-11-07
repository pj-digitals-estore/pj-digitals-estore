# NearBy Delivery (`client_delivery`)

Expo Router / React Native TypeScript app for delivery partners, using the original NearBy logo, purple-and-blue theme, light/dark modes and a translucent right-side menu.

## Sign-in

- Clerk login replaces the local demo email/password form.
- Web uses the themed Clerk SignIn component. Expo Go uses Clerk hosted sign-in in the browser and restores the session on return.
- Native sessions use Clerk secure token storage. Browser sessions are managed by Clerk; no local demo password or remembered-email form is used.
- ClerkProvider wraps the authentication context and navigation so all hooks share the same session.
- The dashboard greeting uses the signed-in Clerk user. The Profile section uses Clerk UserProfile on web and Clerk’s Account Portal in Expo Go for name, photo, email, password and security.
- Logout signs out of Clerk. A new account/session mounts a fresh workspace and reloads its own orders.
- No shop-profile request, driver approval request or fake server profile is added.

## Run

Create `.env.local` with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for the same Clerk instance as the other apps. `EXPO_PUBLIC_API_URL` configures the existing server health indicator. The local settings use the public key and server URL supplied for NearBy; no Clerk secret is included.

From this folder:

```powershell
pnpm install
pnpm expo start --clear
```

Enable the Native API in the Clerk Dashboard for hosted mobile authentication. Clerk hosted authentication works in Expo Go without adding native Clerk UI components. Future standalone builds need Clerk native application/callback configuration before release.

## Connected order screens

- `GET /api/orders` loads orders for the signed-in Clerk account with its bearer token.
- `GET /api/orders/:id` loads the View order details popup. Details validate the returned order ID, show real order/payment statuses, items, totals and shipping address, and provide retry/close actions.
- Dashboard counters derive from returned records. No demo jobs are displayed in the connected screen.
- Pull-to-refresh, foreground refresh and 30-second polling reload the list. Failed reads have explicit errors instead of fabricated order data.
- GPS directions open maps for the address returned with the order.
- Clerk profile settings, the original logo, loading screen, light/dark switch and right-side menu remain available.
- The root navigation stack stays mounted while Clerk loads or signs in; authentication is checked inside the index route.

These are user-order endpoints, not driver-assignment endpoints. They do not reveal every customer order or establish driver approval. Pickup, delivery completion and assignment writes have not been connected or simulated. The original sample screen remains in source but is no longer the authenticated index screen.

The server health indicator checks reachability only. No real delivery records, accounts or permissions were created by this change. Backend deployment and real-account acceptance testing are still needed.

## Clerk login checks (Expo Go and web)

Native login uses Clerk hosted authentication in Expo Go with the current project callback (`exp://host/--/hosted-auth-callback`). Installed builds retain Clerk's native callback defaults. The SDK verifies the callback and activates the session; routing alone never signs in a user. Cancellation and Clerk API errors are displayed, and repeated taps cannot open concurrent login sessions. Web uses the matching browser provider and Clerk embedded UI. Admin server approval remains required.

All four apps limit Metro to two workers so they can run together with lower memory usage. If an old server returns a Metro dependency-graph 500, stop that app's old server and restart from its folder with `pnpm expo start --go --clear`; scan its current QR code.
