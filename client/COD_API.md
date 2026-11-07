# Cash on Delivery client integration

Cash on Delivery uses the existing orders API directly. It does not require a dedicated COD endpoint, `/api/payments/config`, a codEnabled response field or the online/Razorpay checkout flag.

1. After sign-in, address selection and cart synchronization, the customer selects Cash on Delivery.
2. The client sends `POST /api/orders` with a Clerk bearer token, `paymentMethod: "cod"`, an idempotent checkoutKey and the existing shippingAddress fields. Items and totals come from the server's cart.
3. The response must confirm success and return the created order's `_id` in data.
4. The client requests `GET /api/orders/:id` using that ID and the same Clerk token. It reports success only when the saved order has the matching ID, a COD method (cod or cash_on_delivery), an accepted order status and a payment status.
5. My orders and details use the existing order list/detail endpoints. COD records do not show the online Pay now or Cancel unpaid checkout controls. No Razorpay popup opens for COD.

The deployed API must actually accept and persist COD. The local server source currently hardcodes Razorpay, so it is not proof of the deployed orders controller's contract. The frontend retains its current paymentMethod value `cod`; confirm this spelling with the backend developer. An unexpected response or different method remains an error, not a successful COD order. No backend or deployment was changed by this client update.

Razorpay continues to use its existing configuration and online checkout flag independently. Removing the COD config dependency does not enable online payments.
