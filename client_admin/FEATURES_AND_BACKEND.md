# NearBy admin: features and backend

## Current access

- Clerk sign-in is the only login method.
- The backend must verify the signed-in account's admin role before the dashboard opens.
- Denial, failed verification or logout locks the dashboard.
- No hardcoded login account, local authentication provider or preview-login flag remains.
- Dashboard sample-data mode still requires the same verified admin access as live mode.

## Live order integration

Live mode now connects all five supplied order routes: user list, single detail, creation from the signed-in account’s cart, admin status update and paginated admin all-orders list. Creation includes cart/address review and a reusable checkout key. Status changes require confirmation and server acknowledgement. Clerk/server admin verification is retained; temporary login remains removed.

The orders API determines permissions, supported payment methods, stock handling and status transitions. The frontend does not approve users, change paymentStatus, collect cash or assign deliveries. See README.md for exact endpoint behaviour and limitations. The table below also describes the separate sample dashboard; sample records are not live server totals.

## Current features and backend needed

### Access & permissions (new)

Open the right-side menu → **Access & permissions**, or use **Manage access** on the preview overview.

- All four apps have permission lists: Customer, Shop, Delivery and Admin.
- Customer: catalogue/shops, checkout, orders/payments, wishlist/reviews, addresses/profile and notifications.
- Shop: dashboard, own products, five-image management, stock, own orders/delivery status, advertisements and profile.
- Delivery: dashboard, assigned orders, pickup/delivery status, GPS directions, history and profile.
- Admin: overview/reports, orders, shops/approvals, inventory, customers, delivery/assignments, advertisements and access management.
- Access management is read-only until protected account-management APIs are connected. It shows permission options and a server-connection notice.
- No local account controls can grant real access, approve a user or bypass Clerk/server verification.

**Backend still needed to enable these controls in real apps:**

1. Protected admin account list/detail APIs with search, app/status filters and pagination.
2. Persistent app memberships, permissions and Pending/Active/Suspended/Revoked state linked to Clerk user IDs. Email entry alone must never create an approved identity.
3. Admin grant/update/revoke endpoints with server validation, conflict checks and an audit trail.
4. Shop ownership/approval and delivery assignments linked by real IDs; the preview scope text is not suitable for authorization.
5. Server middleware enforcing account state, per-action permissions and record ownership on every protected route. Existing server roles are user/admin/shop; delivery permissions and granular grants do not exist yet.
6. Prevent self-lockout and removing the final active administrator; reject unauthorized role escalation.
7. All apps fetch their verified access and react to suspension/revocation. Do not trust preview state or client-side toggles.

No backend or real account permissions were modified for this addition.

| Area | Available in the admin frontend | Backend needed for live operation |
| --- | --- | --- |
| Login and access | Clerk sign-in; server admin-role verification; denial/retry screens; logout | Clerk user synchronization and approved database admin roles. Existing `/api/admin/stats` is used for verification only. |
| Overview | Calculated sample order count/value, products, stock units, active deliveries and discrepancies | Connect live statistics, agreed reporting periods and shared definitions for paid revenue and delivery status. |
| Orders | Live all-orders and own-account lists, page search, status filters, pagination, detail popup, own-cart creation and confirmed status changes; separate sample view | Deploy the supplied endpoints with admin authorization, correct ownership, idempotent creation and server-enforced status/payment rules. Live writes still need real-account testing. |
| Shops | Searchable sample directory, category and location | Shop records, ownership, admin listing/detail APIs and approval/suspension services. Approval controls are not implemented in this preview. |
| Products and stock | Live catalogue pages, details, creation, metadata/stock editing, five-photo management and confirmed deletion; separate sample inventory view | Deploy the supplied product routes with image handling, ownership/association validation and server concurrency control. Live uploads/deletions need real-account testing. |
| Delivery | Sample assigned jobs, customer/address, amount, item count and status | Driver accounts, assignment records, pickup/delivery updates, status history and shared order IDs. Live GPS tracking needs separate location updates. |
| Customers | Searchable customer names and sample order/job counts | Protected admin customer listing/details with pagination and access controls. Current names are samples, not registered-user totals. |
| App connections | Source snapshot from customer/shop/delivery apps; comparison of matching order IDs | Shared persistent services and synchronized IDs/statuses. Current view does not monitor running devices or their in-memory edits. |
| Reports | Sample order value, category bars, mismatch and missing-record reports | Live order/payment/inventory queries, date ranges and reconciliation jobs. |
| Insights | Live 7/30/90-day paid order trends, average order value, COD dues, cancellations, status/payment breakdowns, top products by paid units and current stock/category alerts | Uses existing all-orders and product endpoints. Accurate complete totals require valid pagination and creation dates. Large-scale reporting beyond 100 pages per source needs server aggregation; no new endpoint is required for the current bounded snapshot. |
| Payouts | Unavailable-state screen only | Payment reconciliation, shop settlement ledger, payout provider integration and payout history. No working payout controls yet. |
| Support | Unavailable-state screen only | Tickets, messages, customer/shop links, assignment and resolution history. No working shared inbox yet. |
| Settings and appearance | Snapshot information, light/dark switch, responsive layout, right-side menu and original logo | No backend needed for layout/theme. Persistent platform settings and admin audit logs need services if added. |
| Server indicator | API reachability check and retry | Existing server health response; this is not a check that every service works. |

## Existing server routes relevant to admin

- `GET /api/admin/stats`: protected admin statistics, used for access verification and the live overview.
- `GET /api/orders/admin/all`: integrated paginated live admin listing; separate from preview samples.
- `PUT /api/orders/:id/status`: integrated live status update after confirmation; separate from preview samples.
- `GET /api/orders`, `GET /api/orders/:id` and `POST /api/orders`: integrated own-account order list, detail and creation from the signed-in account cart.
- `GET /api/products` and `GET /api/products/:id`: connected live catalogue and product details.
- `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`: connected live create/edit/delete forms, five-photo editing and deletion confirmation. Server admin authorization remains required.

Route presence does not prove deployed functionality. Removing the local login did not change backend roles or any real admin account. The connected routes still need deployment and real-account acceptance testing.
