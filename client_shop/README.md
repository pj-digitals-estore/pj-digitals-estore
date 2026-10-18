# TDP Store Shop app (`client_shop`)

Standalone Expo Router app for shop owners and staff. This is a TypeScript conversion of the TDP Store `shop-portal` app. It is prepared as a folder for you to copy into the PJ repository; it has not been copied into that repository.

## Copy into PJ

Copy the entire `client_shop` folder beside the existing `client` folder and `server` folder in the PJ repository. Do not put it inside `client/src/app`; it is a separate Expo app with its own `package.json`, `app.json`, routes, and assets.

## Run it

Open a terminal in `client_shop`, then run:

```powershell
pnpm.cmd install
pnpm.cmd run web
```

If pnpm is not available, use `npm.cmd install` then `npm.cmd run web`.

## Included screens

- Home dashboard with sales, active orders, and low-stock items.
- Orders with sample status updates.
- Deliveries with delivery details and progress controls.
- Product search and a local add-product form.
- Stock status with filters, quantity controls, edit, and delete.
- Team list and local demo invite form.
- Store status and profile details.

## Demo limits

Data is held in memory and resets when the app restarts. Forms do not call an API, save to a database, send invitations, or perform real delivery updates. Connect the backend later using the API your team agrees on.
