# NearBy Shop (`client_shop`)

Standalone Expo Router / React Native TypeScript frontend preview for shop owners. It uses the NearBy purple-and-blue theme, light/dark appearances, the original logo and a translucent right-side menu. NearBy Shop branding appears on every shop page and in browser titles.

## Add to PJ

Copy this complete `client_shop` folder beside `client`, `client_admin`, `client_delivery`, and `server` in the PJ repository. It is a separate Expo app, not a route inside `client/src/app`.

## Run locally

From this folder, install dependencies with the package manager the team has chosen, then run the web or native Expo start script. For npm on Windows: `npm.cmd install` and `npm.cmd run web`.

## Included screens

- Shop dashboard with sample sales, active orders, product counts and low-stock items.
- Read-only orders and delivery progress views.
- Product search and add-product form.
- Stock status, quantity controls, edit, and delete.
- Advertisements with preview, editing, enable/disable and deletion.
- Read-only shop profile.

Demo content is scoped to a sample Thodupuzha shop and shown in rupees. Business data is held in memory. Product, stock and advertisement changes are not sent to a server or persisted after restart. The health indicator only checks server availability.

See [FEATURES_AND_BACKEND.md](FEATURES_AND_BACKEND.md) for the complete current feature list, limitations and backend requirements.

## Appearance and branding

Open the right-side menu and choose Light or Dark under Appearance. The original NearBy logo is used unchanged. Display names use NearBy; existing account credentials and record identifiers are retained.

## Live shop trial

Clerk is now the login method in both modes. Web displays Clerk’s sign-in component; Expo Go uses Clerk hosted sign-in. The email-to-admin instruction and local demo password login have been removed.

The default mode is `live`: Clerk sign-in opens the workspace directly. The frontend does not request `/api/shops/profile`. Product and order requests still use Clerk bearer tokens and remain subject to server permissions; login does not grant a shop role or create an approved shop.

Configure `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` in `.env.local`, then restart with `pnpm expo start`. For an explicit sample-data preview, set `EXPO_PUBLIC_SHOP_MODE=demo`; it still requires Clerk sign-in, but never publishes sample records.

Server-backed trial deployment instructions remain in `../TRIAL_HANDOFF.md`. Complete deployment and device acceptance checks before taking real orders.

### Account settings and business data

Personal account settings are managed entirely by Clerk. `/account` and the Profile screen use Clerk UserProfile on web and the Clerk Account Portal in Expo Go. The owner name in the workspace comes from Clerk. No personal-profile read/write or shop-profile request is sent to the shop server.

The shop profile preflight and approval gate have been removed from the frontend. The server still enforces approval and ownership on its protected business routes. If those routes are unavailable or access is denied, the workspace displays the load error without treating it as a login failure.

### Product API connection

Under Products, choose **Edit product images**. Add or replace photos, use the arrows to reorder them, choose a cover or remove a photo, then save. Replacement works even when all five slots are occupied. Changes stay in the draft until saved; at least one photo is required. Live saves use `PUT /api/products/:id` and retain the server's admin-role requirement. Preview saves affect only local sample products.

- `GET /api/products?page=1&limit=100`: paginated shared catalogue; de-duplicates IDs across pages.
- `GET /api/products/:id`: latest details before opening the product, stock or image editor.
- `POST /api/products`: create a product with multipart fields and up to five images.
- `PUT /api/products/:id`: update details, stock or images. Photo updates use multipart `images`, `existingImages` and `imageOrder`; stock-only updates use JSON.
- `DELETE /api/products/:id`: delete after confirmation. The supplied route deletes the record; it is not described as a reversible hide action.

Clerk tokens are sent with requests. The supplied write routes require `authorize("admin")`. A shop-role account alone cannot write through those routes; the app surfaces the denial and does not change server permissions. This API returns a shared catalogue, not a verified own-shop inventory. No account roles were changed.

Orders now use the supplied user-order endpoints: `GET /api/orders` for the list and `GET /api/orders/:id` for the View order details popup. Both send the signed-in Clerk bearer token. Details show items, sizes, quantities, available prices, order total, actual payment/order statuses and the supplied delivery address. Failed detail requests have retry and close actions. Reads are cancelled when details close or the account workspace unmounts.

These routes return the signed-in user's orders; they do not provide every customer order placed with a shop. The dashboard labels this as account order data, calculates paid account order value only from records explicitly marked paid, and does not claim these are shop fulfilment jobs. Statuses are read-only; no order creation, status update or delivery assignment was added. Failed order loading does not block the catalogue. Product edits refresh the catalogue after server confirmation. Neither `/api/shops/orders` nor a shop-profile API is requested by this live screen.

## Clerk login checks (Expo Go and web)

Native login uses Clerk hosted authentication in Expo Go with the current project callback (`exp://host/--/hosted-auth-callback`). Installed builds retain Clerk's native callback defaults. The SDK verifies the callback and activates the session; routing alone never signs in a user. Cancellation and Clerk API errors are displayed, and repeated taps cannot open concurrent login sessions. Web uses the matching browser provider and Clerk embedded UI. Admin server approval remains required.

All four apps limit Metro to two workers so they can run together with lower memory usage. If an old server returns a Metro dependency-graph 500, stop that app's old server and restart from its folder with `pnpm expo start --go --clear`; scan its current QR code.
