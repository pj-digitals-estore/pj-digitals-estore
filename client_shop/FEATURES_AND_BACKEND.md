# NearBy Shop: current features and backend work

## Current frontend features

### Access and branding

- Clerk sign-in on web and Clerk hosted sign-in in Expo Go, with logout.
- Live mode is the default. Clerk sign-in opens the workspace; no shop-profile preflight is requested. Business APIs still enforce ownership and approval server-side.
- Removed the old demo password form and the instruction to provide an email to the admin. No public shop signup screen is added.
- Explicit demo mode also uses Clerk sign-in; business data remains a clearly labelled preview and is not approved live access.
- NearBy Shop name in page headers, right menu, app metadata and browser titles.
- Original NearBy logo in page headers, menu, sign-in, opening screen, app icon and favicon. The image has not been redesigned.
- Animated opening screen with loading progress and reduced-motion handling.
- Responsive phone and desktop layouts with safe-area spacing.
- Purple-and-blue styling, Light/Dark controls and matching status-bar colours.

### Navigation and refresh

- Hidden translucent menu opening from the right with animated open/close, scrollable destinations and current-page highlighting.
- Home, Orders, Deliveries, Products, Advertisements, Stock status and Profile.
- Close button, outside-tap dismissal, Android back handling and web Escape dismissal.
- Appearance controls and logout in the menu; no full top/bottom navigation bar.
- Pull-to-refresh preview animation preserves current in-memory changes. It does not fetch shop business data.
- API health indicator with retry. API reachability does not mean shop data is connected.

### Dashboard

- Sales preview, active-order count and product count.
- Add Product and Update Stock quick actions.
- Active-order preview and stock-to-check list.
- The sales amount and percentage change are hardcoded demo figures; they are not real revenue. Counts reflect the current local sample state.

### Products and inventory

- Product search by name, SKU and category.
- Add a product with name, price, category and starting stock.
- Stock totals and In stock / Low stock / Out of stock filters.
- Increase or decrease quantities locally.
- Edit name, SKU, category, price, quantity, reorder level and shelf location.
- Validation for required edit fields, prices, whole-number quantities and duplicate local SKUs.
- Delete product with a confirmation dialog.
- Product changes are available within the shop preview session; they are not published to the customer catalogue.

### Orders and deliveries

- Read-only order list: order ID, customer, amount, item count, time and pickup/delivery status.
- Order filters for awaiting pickup, picked up, out for delivery and delivered, plus all orders.
- Missing delivery records show a pending status.
- Delivery lists with All / In progress / Delivered filters and summary counts.
- Delivery record details: customer, address, item count, value, assigned driver and sample delivery window.
- Visual pickup/delivery progress.
- No shop-owner order confirmation, driver assignment or delivery-status editing controls.

### Advertisements and profile

- Create and edit an advertisement with title, offer, description and optional HTTPS image URL.
- Banner preview, image validation/fallback, enable/disable and delete confirmation.
- Advertisement changes stay local; they are not published to the customer homepage.
- Read-only store profile with shop name, category and location.
- Team management, opening hours and store pause/settings are not exposed as app features.

## Backend still needed for these features

1. Real shop-owner authentication, sessions and logout, with admin-approved shop access.
2. An owner-to-shop relationship and server-enforced shop isolation/permissions.
3. Persistent shop profile and service-location records.
4. Shop-owned product creation, listing, search, editing and deletion. Existing server product writes are admin-only and do not provide shop-owner access.
5. Authoritative stock updates, SKU uniqueness, reorder thresholds, validation and inventory-change history.
6. Stock reservation/decrement during customer checkout, safe concurrent updates and cancellation/restock handling.
7. Shop-scoped order lists and details with authoritative prices, item snapshots, customer/address access and status filters.
8. Delivery assignment/status feeds from admin and delivery apps, exposed read-only to the shop app.
9. Advertisement persistence, media hosting, publishing rules and customer-homepage delivery of enabled promotions.
10. Real dashboard statistics derived from shop orders/payments, including a defined reporting period. Preview sales must not become production revenue figures.
11. Durable storage and synchronization between customer, shop, delivery and admin apps, with proper refresh/loading/error handling.

Appearance switching, menu animations, layout, logo display and password visibility do not need a business-data backend. Keeping appearance preferences across app restarts can be implemented with local storage.

## Current limits

The app uses a demo account and sample products/orders/deliveries. Authentication is not real, and business data is held in memory. Restarting or logging out can discard local edits. Other apps cannot read these runtime changes. The admin preview compares initial source samples, not active shop sessions. No backend code was added by this UI update.
