# NearBy shop trial — deployment handoff

Prepared for the 7 November 2026 trial. The code is not a deployment or proof that a real payment works. A developer must configure the services and complete the device checks below before accepting customer payments.

## Scope

The live path is: approved owner signs in → uploads a real product photo and publishes a product → customer chooses the shop/service area → selects a size if needed → saves a cart → adds a delivery address → opens Razorpay → server verifies captured payment → shop sees the paid order → verified admin updates processing/dispatched/delivered.

Live delivery-partner dispatch/GPS, advertisements, reviews, wishlist persistence and support tickets are outside this trial implementation. The separate delivery app now uses Clerk sign-in, Clerk account settings, and GET /api/orders plus GET /api/orders/:id for the signed-in account. These user-order endpoints do not provide driver assignments or permit delivery status updates; authentication does not establish driver approval. Coordinate physical delivery manually through the trial operator and the live admin order screen.

## Separate demo from real data

| App | Demo/preview | Live trial |
| --- | --- | --- |
| Shop | `EXPO_PUBLIC_SHOP_MODE=demo` | `EXPO_PUBLIC_SHOP_MODE=live` |
| Customer online/Razorpay checkout | `EXPO_PUBLIC_ENABLE_LIVE_CHECKOUT=false` | `EXPO_PUBLIC_ENABLE_LIVE_CHECKOUT=true` |
| Admin business screens | `EXPO_PUBLIC_ADMIN_DATA_MODE=preview` | `EXPO_PUBLIC_ADMIN_DATA_MODE=live` |

Restart Expo after changing public variables. Rebuild/redeploy hosted web bundles after changing them: Expo embeds public variables at build time. The shop's demo products never upload automatically. Switching back to demo does not delete real server records. Customer catalogue/cart already use APIs even when online checkout is disabled; the checkout flag is not a fake-data/database switch. COD now uses POST /api/orders directly and confirms the saved order through GET /api/orders/:id, independently of this Razorpay flag. This assumes the deployed orders controller supports COD as confirmed by the project owner; the local server source still hardcodes Razorpay. See client/COD_API.md for the expected request/response. No backend deployment was performed.

Use separate MongoDB databases, Clerk instances and Razorpay test/live keys for rehearsals and actual trading. Never copy demo records into the live database. Changing a public app flag alone does not migrate data or convert Razorpay test payments to real payments.

## Server environment (Vercel backend)

Use the existing server secrets plus:

```dotenv
MONGODB_URI=<MongoDB Atlas/replica-set connection>
CLERK_PUBLISHABLE_KEY=<same Clerk instance as the apps>
CLERK_SECRET_KEY=<server only>
CLERK_WEBHOOK_SIGNING_SECRET=<server only>
ADMIN_EMAIL=<explicit approved admin email>
CLOUDINARY_CLOUD_NAME=<configured media account>
CLOUDINARY_API_KEY=<server only>
CLOUDINARY_API_SECRET=<server only>
PUBLIC_API_ORIGIN=https://<permanent-backend-domain>
ENABLE_CHECKOUT=false
RAZORPAY_KEY_ID=<rzp_test_... for rehearsal; rzp_live_... for real payments>
RAZORPAY_KEY_SECRET=<server only>
RAZORPAY_WEBHOOK_SECRET=<server only>
```

`PUBLIC_API_ORIGIN` must be an HTTPS origin with no trailing slash or path and must match the origin in every app's `EXPO_PUBLIC_API_URL`. Choose a permanent deployment domain, rather than a disposable preview deployment URL. Never put secret keys in `EXPO_PUBLIC_*` variables or frontend source.

MongoDB transactions are required. Use Atlas or a replica set; a standalone MongoDB server is insufficient. From `server`, run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test:trial` and `pnpm test:transactions`. The transaction tests start a disposable local replica set and simulate Razorpay; they never use the live database. The first run downloads a MongoDB binary.

Before enabling checkout, run `pnpm prepare:trial` against the intended database to prepare unique shop-owner, cart-owner and checkout-request indexes. Resolve any existing index/data conflicts deliberately; do not reset the database or run destructive migrations. Keep the existing address-book single-address constraint for now.

## Razorpay and Clerk configuration

1. Configure Razorpay automatic capture. An authorized-only payment is not treated as paid.
2. Add `https://<permanent-backend-domain>/api/payments/webhook` as the Razorpay webhook with the same webhook secret. Subscribe to `payment.captured` and `refund.processed`.
3. Use Razorpay test keys first, rehearse cancellation/failure as well as success, and verify the captured record in the Razorpay dashboard.
4. For an approved real-money trial, configure the merchant's live keys and repeat one explicitly approved small payment/refund check on the deployed system. Do not treat a mocked test or test-mode payment as a live check.
5. Configure Clerk's web domains/redirects and webhook URL (`/api/clerk`). Enable Native API/hosted auth for Expo Go. All apps and the server must use the same Clerk instance.
6. Set a real customer-support contact in the customer deployment and verify who will handle delivery and refunds during the trial.

## Shop approval — deferred until the owner details are supplied

The owner must have a Clerk account. A sign-up does not approve a shop. No real account was granted access during development.

The operator can explicitly run `pnpm approve:shop` from `server` after setting:

```dotenv
TRIAL_SHOP_EMAIL=<owner Clerk sign-in email>
TRIAL_SHOP_NAME=<shop name>
TRIAL_SHOP_CITY=Thodupuzha
TRIAL_SHOP_ADDRESS=<pickup/shop address>
TRIAL_SHOP_CATEGORY=Electronics
```

`TRIAL_SHOP_CITY` may instead be `Muttom`. The command links that one account to a shop and approves it; it does not import products or grant admin access. Run it only after approving the intended owner. An existing admin should not be reused as the shop-owner account, because the explicit command sets the selected account's role to `shop`.

## App environment

For `client`, `client_shop` and `client_admin`, set `EXPO_PUBLIC_API_URL` to the permanent HTTPS backend origin and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the matching public key. Configure the mode flags above. For local Expo Go, restart with `pnpm expo start --clear`; use the hosted API, not phone `localhost`. Web payment opens a new tab; Expo Go opens the hosted Razorpay checkout in the system browser. Return to My orders afterward to see server-verified status.

Keep checkout disabled until deployment, merchant settings, owner approval and the acceptance run are complete. Once ready, set server `ENABLE_CHECKOUT=true` and the customer checkout flag to `true`. `/api/payments/config` reports whether payment configuration is present and whether the configured key is test/live; it does not prove the merchant or webhook is working.

## New/changed server contract

- `GET /api/shops`: public approved shops, optional `city`.
- `GET /api/shops/profile`: signed-in approved shop owner only.
- `GET /api/shops/products`: that owner's active inventory.
- `POST /api/shops/products`: multipart, one or more JPEG/PNG/WebP images, each at most 3 MB; name, description, category, price, stock and optional sizes/SKU/reorder level/shelf location.
- `PUT /api/shops/products/:id/stock`: JSON `{stock, version}`; stale versions return 409.
- `PUT /api/shops/products/:id/images`: multipart with `version`, retained `existingImages`, new `images` files and `imageOrder` JSON. Retained and new images together must total 1–5; `imageOrder` uses retained URLs and `new:0`, `new:1`, etc. The first entry is the cover. Other product fields, including price and stock, remain unchanged.
- `PUT /api/shops/products/:id`: owner-scoped multipart edit; include `version` and every retained `existingImages` URL.
- `DELETE /api/shops/products/:id`: hide own product; preserve order history.
- `GET /api/shops/orders`: latest 200 paid, non-cancelled orders containing that shop's items; no other shop's item values are returned.
- Product reads accept `city`/`shop` and populate seller details. Live customer browsing uses the selected service city.
- `POST /api/orders`: JSON `{checkoutKey, shippingAddress:{name,phone,street,city,state,zipCode,country}}`. Server calculates current prices, checks shop coverage and reserves stock transactionally. Response includes the order and an HTTPS `checkoutUrl`.
- `POST /api/orders/:id/checkout`: owner reopens the same pending Razorpay order.
- `POST /api/orders/:id/cancel`: owner/admin cancels an unpaid checkout after checking provider payment state; restores stock exactly once.
- `GET /api/payments/checkout/:token`: hosted payment page. Its opaque token grants checkout access only; never include customer session tokens in payment URLs.
- `POST /api/payments/verify`: checkout callback with token and Razorpay signature fields; server also retrieves the captured payment and validates order/amount/currency.
- `POST /api/payments/webhook`: raw-body signed Razorpay webhook.
- Admin order listing/details return correct data/status. Admin status changes allow paid orders only and cannot manually mark a payment paid.
- Customer order reads recover the latest pending payment from Razorpay if a callback was missed. `pnpm reconcile:payments` checks up to 100 pending orders; it does not initiate payments.

## Acceptance run before customers pay

On BOTH the hosted website and a physical phone running Expo Go:

1. Sign in as the approved owner; an unapproved/customer account must be rejected.
2. Upload a product photo, price and stock, then reload and sign out/in: the real product must persist.
3. Open the customer app in the matching location; find the shop and product. A different service city must not offer that product for checkout.
4. Add an item/size to the cart, sign in and enter a real supported delivery address.
5. Complete a test-mode Razorpay payment; verify captured amount in Razorpay and matching paid order in customer, shop and admin.
6. Reload every app. Payment/order/stock must persist. A second checkout attempt must not duplicate the reservation or charge the customer automatically.
7. Check failed/cancelled browser flows, a pending payment, cancellation and a sold-out product. Do not fulfil pending payments.
8. Update the paid order through admin processing → dispatched → delivered. Shop and customer must see the update.
9. After operator approval, repeat the agreed real-money smoke test with live keys, and verify the refund/support process.

## Important pilot limits

- Unpaid checkouts reserve stock until completed or explicitly cancelled; there is no automatic reservation-expiry worker yet. Monitor pending orders during the trial. A customer can cancel an unpaid checkout from My orders after closing its payment page.
- A late captured payment can race cancellation. It is flagged `manualReview`, stays cancelled, never reaches shop fulfilment and is shown for refund review. The operator must refund in Razorpay and verify the refund webhook. Refunds are not automatically initiated by this code.
- Customer saved addresses remain session-local in this trial; the submitted address is persisted on the order. Wishlist/reviews/ads also remain preview/local features. Avoid presenting these as synchronized services.
- Shop live UI covers photo/product publishing, stock, paid orders and profile. The richer existing demo screens remain separate. Admin live UI covers server totals and order fulfilment.
- Payments go to the configured Razorpay merchant account. Automatic transfers/split settlements to shop owners are not implemented; agree the pilot's shop settlement process with the owner before accepting orders.
- Shop owners can select, remove and reorder up to five images in demo and live modes. All new image files in one request must fit within 3 MB total. Configure sufficient Vercel execution time for Cloudinary/provider calls; the host's total request-size limit still applies. The client product page includes thumbnails and a larger image viewer.
- No live merchant payment, owner approval, production database migration or deployment has been executed by Codex.

Primary references: [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps), [Expo Go browser support](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/), [MongoDB transactions through Mongoose](https://mongoosejs.com/docs/transactions.html).

## Checks completed locally

- 25 server checks pass. These include isolated MongoDB replica-set transactions, rollback, idempotency, concurrent last-unit sales, shop isolation, stale stock updates, cancellation/restock, late-payment refund-review handling and image-count/order validation. An image-only update is also checked to preserve product stock and price.
- Server, customer, shop and admin TypeScript checks pass. Targeted frontend lint checks pass using the shop app's Expo ESLint configuration for the customer app, which has no local ESLint configuration.
- Live-mode customer and shop exports pass for web, Android and iOS; the admin web export also passes. These are bundle checks, not physical-device or real-payment acceptance tests.
- Payment API responses in automated tests are simulated. No merchant charge, production database write, account approval or deployment is part of these checks.
