# NearBy Admin

Expo 57 / React Native frontend preview with the customer and delivery apps' purple-to-blue theme, a responsive dashboard and a translucent right-side menu.

## Start

From `client_admin`, run `pnpm start` (or `pnpm web`, `pnpm android`, `pnpm ios`). These scripts collect the sibling apps' current initial sample records before starting Expo.

If using `pnpm expo start` directly, first run `pnpm sync-preview` after changing another app's sample data. Source samples are collected at startup, not continuously from running devices. Metro reloads cannot read another app's in-memory edits.

## Data sources

- Customer directory: `client/src/features/storefront/data/catalog.ts`, `stores`.
- Shop inventory, orders and deliveries: `client_shop/src/context/ShopDataContext.tsx`, initial arrays.
- Delivery jobs: `client_delivery/src/screens/DeliveryScreen.tsx`, `initialJobs`.
- Generated snapshot: `src/data/app-preview.json`.
- Calculations and comparisons: `src/data/preview.ts`.

The collector parses literals with TypeScript. It does not execute app code or read credentials. The three sibling apps must remain beside `client_admin` in this repository.

Order value is the sum of shop order totals, not collected revenue. Product counts, units, low-stock counts and category bars are calculated from inventory. Low stock excludes sold-out products and follows each product's reorder level. Customer counts represent distinct sample names, not registered users. Delivery counts come from delivery jobs rather than shop order stages.

Comparison matches shop deliveries and delivery-app jobs by order ID, then checks customer name, value, item count and normalized delivery status. Missing records are coverage gaps, not confirmed dispatch failures. Mismatches are displayed rather than silently overwritten.

At the time of the redesign, `TDP-1046` and `TDP-1043` contain differences. The source snapshot has 4 shop orders worth ₹13,493, 6 products, 43 stock units, 2 low-stock products, 1 sold-out product and 3 active delivery jobs. These numbers are derived, not dashboard constants.

## Preview boundaries

Clerk sign-in and a successful server-authorized request to `/api/admin/stats` are required before the dashboard opens. With `EXPO_PUBLIC_ADMIN_DATA_MODE=live`, statistics and order screens use the server. Sample-data mode remains available only after the same verified admin sign-in. Account access management is read-only until its backend routes exist.

The sample dashboard remains separate from live order operations. No backend roles or order controllers were changed by this frontend integration.

## Admin access

The temporary local login has been removed. Clerk sign-in and server-verified admin access are required in development and production. No environment flag can enable a login bypass.

See `FEATURES_AND_BACKEND.md` for the current admin features and remaining backend work.

### Verified access

Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` in `.env.local`, then restart Expo. Use the Clerk instance recognized by the server. These are public configuration values; never put Clerk secret keys in the app.

The existing server must recognize the signed-in Clerk user and have that user's database role set to `admin`. The platform owner can use the existing server provisioning process (`server/scripts/makeAdmin.ts`, configured with `ADMIN_EMAIL`) to approve the intended account. Signing up alone does not grant access. The frontend does not promote accounts or trust email addresses or editable client state as proof of admin access.

Web uses Clerk's embedded sign-in. Native uses Clerk hosted sign-in, including Expo Go; enable Native API in the Clerk dashboard. No native Clerk UI plugin is required. New sessions and app restarts require server verification. Access is rechecked every minute while active and on returning to the app. Rejected requests, invalid responses and verification failures lock the dashboard. The right-side menu provides sign-out.

The server must continue enforcing `protect` and `authorize('admin')` on every protected endpoint. The navigation gate protects the app flow; bundled preview samples are not private server data. Put future private screens inside the protected route group in `src/app/_layout.tsx`.

## Branding

The original NearBy logo is saved as `assets/images/nearby-logo-original.png` and is used by the header, menu, app icon and favicon. It is an unchanged copy of the customer app's original logo. Keep the original logo unchanged; do not redesign or recolor it.

## Appearance

The right-side menu includes Light and Dark controls. Both appearances use the same purple-and-blue brand, and changing appearance updates the screens, forms, modal panels and status bar without resetting the current section.

## Live shop trial

The existing preview remains available. Server-backed trial mode and deployment instructions are in `../TRIAL_HANDOFF.md`. Enable live mode only after the deployment and device acceptance checks. Do not import sample records into the real database.

## Connected live order routes

- `GET /api/orders/admin/all`: All orders, with page/limit and status filters. Search is explicitly limited to the loaded page.
- `GET /api/orders`: My account orders for the signed-in admin account.
- `GET /api/orders/:id`: detail popup showing confirmed order/payment statuses, items, amount and address; retry and close are available.
- `POST /api/orders`: Create from my cart, using only the signed-in account’s existing cart. The form first reads `GET /api/cart`, collects a delivery address, and shows a review step. The body includes shippingAddress, checkoutKey and paymentMethod. It does not create orders for another selected user.
- `PUT /api/orders/:id/status`: confirmation dialog for the next fulfilment state, sending only orderStatus. It does not mark a payment paid, collect cash or assign a driver. The server can reject an unsupported transition.

All requests use the verified Clerk session token. After creation the detail route checks the saved payment method, and after a status update the response must confirm both the order ID and requested status. A network failure is not treated as proof that a write did not happen; use My account orders before retrying creation. No Razorpay payment popup opens automatically in the admin.

COD is offered only as the existing orders API paymentMethod value cod; its acceptance still depends on the deployed controller. Admin creation defaults to online/razorpay. No payment is marked as collected by the frontend.

Pull-to-refresh, foreground refresh and 15-second polling read server records. Statistics errors do not block successful order loading. Logout or leaving the workspace cancels pending read requests. The original NearBy logo, theme switch, right-side menu and login loading screen remain unchanged.

## Connected live product routes

Open Products in the right-side menu (live data mode).

- `GET /api/products?page=1&limit=20`: catalogue pages, confirmed record total and page search.
- `GET /api/products/:id`: fresh details before viewing, editing or confirming deletion. Details include all returned photos, name, description, category, price, stock, sizes and shop association.
- `POST /api/products`: create a product with multipart fields and one to five photos.
- `PUT /api/products/:id`: edit product fields and images using multipart data. Unchanged fields, especially stock, are omitted. Photo changes send retained existingImages plus new images and imageOrder. The server remains responsible for atomic inventory/concurrency checks.
- `DELETE /api/products/:id`: explicit confirmation showing the product to delete. The current server deletes the record and stored photos; there is no frontend undo.

Clerk bearer tokens are included on all requests, and the backend must enforce the admin role for writes. Multipart Content-Type is left to fetch so the file boundary is correct. Images can be added, replaced, removed, reordered or made the cover; selection is limited to five photos and 3 MB of new uploads, with JPEG/PNG/WebP validation.

Optional shop references are preserved when editing. A new product without a valid shop link may be excluded from shop-specific checkout, depending on the backend. No unsupported shop-management endpoint is called automatically.

List requests refresh on pull-down, foreground return and every 30 seconds. A confirmed mutation reloads products and overview statistics. Errors are shown explicitly; product creation, editing and deletion are never retried automatically. If a save response is lost, check the catalogue before retrying.

Restart Expo with `pnpm expo start --clear` after installing the added expo-image-picker dependency. Web and Expo Go use the matching SDK 57 picker. Actual API uploads and deletions still require testing against the deployed backend with an approved admin account.

## Insights and analysis

In live data mode, open **Insights** in the right-side menu, or **Open insights** from Overview. Select the last 7, 30 or 90 days for paid order value, average paid order, order counts, cancellation rate, outstanding COD, daily trends, payment methods, status breakdown and top products by paid units. Dates use India time and include today. Paid value excludes cancelled and refunded orders and includes order charges; it is grouped by order creation date, not payment capture date. COD still due is separate from collected value.

Current catalogue analysis shows stock units, retail stock value, category counts, sold-out items and low-stock items (1–5 units). Stock is independent of the selected order period. Retail stock value uses selling prices and is not profit or cost.

Insights reads the existing all-orders and product APIs with the verified Clerk token; no new backend routes or mock analytics are added. Each source loads at most 100 pages. Missing pagination metadata, mismatched totals, incomplete coverage and invalid order dates are disclosed; growth comparisons are hidden for incomplete order history. Product rankings use IDs and disclose excluded items without references. The screen is a snapshot refreshed on entry, pull-down or **Refresh analysis**, rather than a real-time reporting service. Deployed API access still needs approved-account acceptance testing.

## Clerk login checks (Expo Go and web)

Native login uses Clerk hosted authentication in Expo Go with the current project callback (`exp://host/--/hosted-auth-callback`). Installed builds retain Clerk's native callback defaults. The SDK verifies the callback and activates the session; routing alone never signs in a user. Cancellation and Clerk API errors are displayed, and repeated taps cannot open concurrent login sessions. Web uses the matching browser provider and Clerk embedded UI. Admin server approval remains required.

All four apps limit Metro to two workers so they can run together with lower memory usage. If an old server returns a Metro dependency-graph 500, stop that app's old server and restart from its folder with `pnpm expo start --go --clear`; scan its current QR code.
