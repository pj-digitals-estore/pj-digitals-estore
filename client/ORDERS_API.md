# Customer order integration

All customer order requests send a Clerk session token as `Authorization: Bearer <token>` to `EXPO_PUBLIC_API_URL`.

| Route | Customer integration |
| --- | --- |
| `GET /api/orders` | My Orders; refresh on entry, pull to refresh, and every 30 seconds while open. |
| `GET /api/orders/:id` | View order details and refresh status. Uses the database `_id`, not the display order number. |
| `POST /api/orders` | `createUserOrder(body, getToken)` service added. Checkout wiring awaits the controller's required request body and response contract. |

The list parser accepts an array, `{ orders: [...] }`, `{ data: [...] }`, or `{ data: { orders: [...] } }`. A single order is accepted directly, in `order`, in `data`, or in `data.order`. Orders are validated against the local server's `IOrder` fields, including `_id`, `items`, `totalAmount`, and `createdAt`.

The create helper expects the same single-order response format. It performs no automatic retries and does not mark payment successful or clear the cart locally. A confirmed payment flow still needs its payment API contract; posting an order does not itself collect payment.

`PUT /api/orders/:id/status` and `GET /api/orders/admin/all` are admin routes. They are not exposed in the customer app. The backend must enforce `protect` and `authorize("admin")`.

No backend routes or controllers were created or modified.
