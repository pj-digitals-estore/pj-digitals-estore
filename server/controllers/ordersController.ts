import { Request, Response } from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Address from "../models/Address.js";
import Shop from "../models/Shop.js";
import Delivery from "../models/Delivery.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PaymentMethod,
} from "../types/index.js";
import { escapeRegex, HttpError, round2, sendError } from "../utils/http.js";
import { checkoutTotals, codBlockReason, computeTotals } from "../utils/pricing.js";
import { cleanCoords, quoteDelivery } from "../utils/deliveryPricing.js";
import { deliveryRuleFor } from "../utils/locations.js";
import { buildMoney } from "../utils/money.js";
import { claimCheckoutKey, finishCheckoutKey, normalizeKey, releaseCheckoutKey } from "../utils/checkoutKey.js";
import {
  attachDeliveries,
  cancelReasonLabel,
  generateCheckoutId,
  generateOrderNumber,
  readCancelInfo,
  reserveStock,
  restoreOrderStock,
  restoreStockLines,
  transitionOrder,
} from "../utils/orderHelpers.js";
import { notify } from "../utils/notify.js";
import { alertOps, escapeHtml } from "../utils/telegram.js";
import { logActivity } from "../utils/activity.js";
import { getSettings } from "../utils/settings.js";
import { codeForCustomer } from "../utils/deliveryOtp.js";
import { ensureInvoice } from "../utils/invoices.js";
import { razorpayConfigured } from "../utils/razorpay.js";
import { createCheckoutPayment } from "./paymentController.js";

const ADDRESS_FIELDS = [
  "fullName",
  "phone",
  "street",
  "city",
  "state",
  "zipCode",
  "country",
  "location",
  "landmark",
];

// The customer app offers UPI / Card (online). All online options are paid
// through Razorpay; COD is still supported by the backend.
const ONLINE_OPTIONS = ["razorpay", "online", "upi", "card", "netbanking", "wallet"];
const normalizePaymentMethod = (value: any): PaymentMethod | null => {
  const v = String(value || "cod").toLowerCase();
  if (v === "cod" || v === "cash") return "cod";
  if (ONLINE_OPTIONS.includes(v)) return "razorpay";
  return null;
};

// Resolve the shipping address from either a saved address id or an inline object
const resolveShippingAddress = async (req: Request) => {
  const { addressId, shippingAddress } = req.body;

  let src: any = shippingAddress;
  if (addressId) {
    const saved = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!saved) throw new HttpError(400, "Selected address not found");
    src = saved;
  }
  if (!src) throw new HttpError(400, "Shipping address is required");

  const address: Record<string, any> = {};
  for (const f of ADDRESS_FIELDS) {
    if (src[f] !== undefined && src[f] !== null) address[f] = String(src[f]).trim();
  }
  address.country = address.country || "India";
  const pin = cleanCoords(src.latitude, src.longitude);
  if (pin) Object.assign(address, pin); // a map pin is the only non-text value on an address

  for (const f of ["street", "city", "state", "zipCode"]) {
    if (!address[f]) throw new HttpError(400, `Shipping address: ${f} is required`);
  }
  return address;
};

// Get user orders
// GET /api/orders
export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name images")
      .populate("shop", "name phone location")
      .sort("-createdAt");

    const mode = (await getSettings()).deliveryOtp;
    // the customer's own delivery code, only while the order is on its way
    const data = (await attachDeliveries(orders)).map((o: any) => ({ ...o, deliveryCode: codeForCustomer(o, mode) }));
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

// Get single order (customer, admin, the order's shop owner, or its assigned driver)
// GET /api/orders/:id
export const getOrder = async (req: Request, res: Response) => {
  try {
    const order: any = await Order.findById(req.params.id)
      .populate("items.product", "name images")
      .populate("shop", "name phone location addressLine")
      .populate("user", "name email");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const customerId = (order.user?._id ?? order.user).toString();
    let allowed = customerId === req.user._id.toString() || req.user.role === "admin";

    if (!allowed && order.shop) {
      const shop = await Shop.findOne({ owner: req.user._id }).select("_id");
      allowed = !!shop && shop._id.toString() === (order.shop._id ?? order.shop).toString();
    }
    if (!allowed) {
      const driver = await DeliveryPartner.findOne({ user: req.user._id }).select("_id");
      if (driver) allowed = !!(await Delivery.exists({ order: order._id, driver: driver._id }));
    }
    if (!allowed) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const [withDelivery] = await attachDeliveries([order]);
    // only the customer who ordered sees the delivery code (not the shop, the driver or an admin)
    const code = customerId === req.user._id.toString() ? codeForCustomer(order, (await getSettings()).deliveryOtp) : undefined;
    return res.json({ success: true, data: code ? { ...withDelivery, deliveryCode: code } : withDelivery });
  } catch (error) {
    sendError(res, error, "Failed to fetch order");
  }
};

// POST /api/orders/:id/invoice   the customer (or an admin) asks for the invoice of a delivered order.
// Gives it its number if it has none yet (orders delivered before invoices existed), then returns the order.
export const getInvoice = async (req: Request, res: Response) => {
  try {
    const base: any = await Order.findById(req.params.id).select("user orderStatus");
    if (!base) return res.status(404).json({ success: false, message: "Order not found" });
    if (String(base.user) !== String(req.user._id) && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Not authorized" });
    if (base.orderStatus !== "delivered") return res.status(400).json({ success: false, message: "The invoice is available once the order is delivered." });
    await ensureInvoice(base._id);
    const order = await Order.findById(base._id).populate("items.product", "name").populate("shop", "name phone location addressLine");
    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to prepare the invoice");
  }
};

// Create orders from the cart. The cart is split into ONE ORDER PER SHOP
// (each shop fulfils and is paid separately); orders from the same checkout
// share a `checkoutId`.
// POST /api/orders   body: { addressId | shippingAddress, paymentMethod?, notes? }
/** The reply for a checkout the customer already placed (a retry or double tap with the same key). */
const replayCheckout = async (req: Request, res: Response, checkoutId: string) => {
  const orders: any[] = await Order.find({ checkoutId, user: req.user._id }).sort({ createdAt: 1 });
  if (!orders.length) return res.status(409).json({ success: false, message: "This order was already handled. Check My orders." });
  const online = orders[0].paymentMethod === "razorpay" && orders.some((o) => o.paymentStatus !== "paid" && o.orderStatus !== "cancelled");
  const payment = online ? await createCheckoutPayment(orders, req.user) : null;
  const sum = (k: "subtotal" | "shippingCost" | "tax" | "totalAmount") => round2(orders.reduce((s, o) => s + o[k], 0));
  const summary = { subtotal: sum("subtotal"), shippingCost: sum("shippingCost"), tax: sum("tax"), totalAmount: sum("totalAmount") };
  return res.status(200).json({ success: true, data: orders, checkoutId, summary, payment, replayed: true });
};

export const createOrder = async (req: Request, res: Response) => {
  let reserved: { product: any; quantity: number }[] = [];
  let checkoutId = "";
  // Idempotency: the app sends one key per checkout attempt (body.idempotencyKey or an Idempotency-Key header).
  // The same key can never create a second set of orders, even if two requests arrive together.
  const idemKey = normalizeKey(req.body?.idempotencyKey ?? req.get("idempotency-key"));
  let keyHeld = false;
  let succeeded = false;
  try {
    if (idemKey) {
      const claim = await claimCheckoutKey(req.user._id, idemKey);
      if (claim.state === "exists") {
        if (claim.checkoutId) return await replayCheckout(req, res, claim.checkoutId);
        return res.status(409).json({ success: false, message: "Your order is already being placed. Please wait a moment." });
      }
      keyHeld = true;
    }
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
    if (!paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment method" });
    }

    const settings = await getSettings();
    if (paymentMethod === "cod" && !settings.allowCod) {
      return res
        .status(400)
        .json({ success: false, message: "Cash on delivery is not available" });
    }
    // fail before any stock is reserved
    if (paymentMethod === "razorpay" && !razorpayConfigured()) {
      return res
        .status(503)
        .json({ success: false, message: "Online payments are not available right now" });
    }

    const shippingAddress = await resolveShippingAddress(req);

    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Shops involved must be approved and open
    const shopIds = [
      ...new Set(
        cart.items
          .map((i: any) => i.product?.shop?.toString())
          .filter(Boolean) as string[],
      ),
    ];
    const shops: any[] = await Shop.find({ _id: { $in: shopIds } });
    const shopById = new Map(shops.map((s) => [s._id.toString(), s]));

    // Build order lines from CURRENT product data, never from client/cart prices
    const orderItems: any[] = [];
    for (const item of cart.items) {
      const product: any = item.product;
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: "A product in your cart is no longer available",
        });
      }
      if (product.sizes?.length > 0 && !product.sizes.includes(item.size)) {
        return res.status(400).json({
          success: false,
          message: `Please select a valid size for ${product.name}`,
        });
      }
      if (product.shop) {
        const shop = shopById.get(product.shop.toString());
        if (!shop || shop.status !== "approved") {
          return res.status(400).json({
            success: false,
            message: `${product.name} is not available right now`,
          });
        }
        if (!shop.isOpen) {
          return res.status(400).json({
            success: false,
            message: `${shop.name} is currently closed`,
          });
        }
      }
      orderItems.push({
        product: product._id,
        shop: product.shop?.toString() ?? "platform",
        name: product.name,
        image: product.images?.[0],
        quantity: item.quantity,
        price: product.price,
        size: item.size,
      });
    }

    // group by shop (one order per shop)
    const groups = new Map<string, any[]>();
    for (const item of orderItems) {
      const list = groups.get(item.shop) ?? [];
      list.push(item);
      groups.set(item.shop, list);
    }
    const shopKeys = [...groups.keys()];
    const subtotals = shopKeys.map((k) => groups.get(k)!.reduce((s, i) => s + i.price * i.quantity, 0));

    // ONE delivery fee for the whole checkout, from the delivery location's rules. Refused here (before any
    // stock is reserved) when we don't deliver there or the minimum order isn't reached.
    const rule = await deliveryRuleFor(shippingAddress.location, settings);
    const delivery = quoteDelivery(subtotals.reduce((a, b) => a + b, 0), rule);
    if (!delivery.ok) return res.status(400).json({ success: false, message: delivery.reason });
    const allTotals = checkoutTotals(subtotals, delivery.fee, settings);

    // COD limit: checked on the whole checkout BEFORE any stock is reserved
    if (paymentMethod === "cod" && Number(settings.codMaxAmount) > 0) {
      const why = codBlockReason(settings, allTotals.reduce((sum, t) => sum + t.totalAmount, 0));
      if (why) return res.status(400).json({ success: false, message: why });
    }

    // Atomic stock reservation (rolled back automatically on failure)
    const stock = await reserveStock(orderItems);
    if (!stock.ok) {
      const bad = orderItems.find(
        (i) => i.product.toString() === String(stock.productId),
      );
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${bad?.name ?? "a product"}`,
      });
    }
    reserved = orderItems;

    checkoutId = generateCheckoutId();
    const orders: any[] = [];
    for (const [index, shopKey] of shopKeys.entries()) {
      const items = groups.get(shopKey)!;
      const totals = allTotals[index];
      // commission is fixed now: a later change of the shop's rate must not touch this order
      const shopDoc = shopKey === "platform" ? null : shopById.get(shopKey);
      const own = shopDoc?.commissionRate;
      const hasOwn = own !== undefined && own !== null;
      const who = shopKey === "platform"
        ? { seller: "platform" as const, rate: 0, source: "none" as const }
        : { seller: "shop" as const, rate: hasOwn ? own : settings.commissionRate, source: hasOwn ? ("shop" as const) : ("platform_default" as const) };
      const order = await Order.create({
        user: req.user._id,
        shop: shopKey === "platform" ? undefined : shopKey,
        checkoutId,
        items: items.map(({ shop: _s, ...rest }) => rest),
        shippingAddress,
        paymentMethod,
        paymentOption: String(req.body.paymentMethod || "cod").toLowerCase(),
        paymentStatus: "pending",
        ...totals,
        money: buildMoney(totals, who),
        notes: req.body.notes,
        orderNumber: generateOrderNumber(),
      });
      orders.push(order);
    }

    // Online payment: ONE Razorpay order for the whole checkout. If this throws,
    // the catch block below removes the orders and returns the stock.
    let payment = null;
    if (paymentMethod === "razorpay") {
      payment = await createCheckoutPayment(orders, req.user);
    }
    reserved = []; // orders exist now - stock is owned by them

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    // Notifications (best effort)
    await notify(req.user._id, {
      type: "order",
      title: "Order placed",
      body:
        orders.length === 1
          ? `Your order ${orders[0].orderNumber} has been placed`
          : `Your ${orders.length} orders have been placed`,
      data: { checkoutId, orderIds: orders.map((o) => o._id) },
    });
    // Online orders reach the shop only once they are paid (see paymentController)
    for (const order of paymentMethod === "cod" ? orders : []) {
      const shop = order.shop && shopById.get(order.shop.toString());
      if (shop) {
        await notify(shop.owner, {
          type: "order",
          title: "New order received",
          body: `${order.orderNumber} - ₹${order.totalAmount}`,
          data: { orderId: order._id },
        });
      }
    }

    const summary = {
      subtotal: round2(orders.reduce((s, o) => s + o.subtotal, 0)),
      shippingCost: round2(orders.reduce((s, o) => s + o.shippingCost, 0)),
      tax: round2(orders.reduce((s, o) => s + o.tax, 0)),
      totalAmount: round2(orders.reduce((s, o) => s + o.totalAmount, 0)),
    };

    alertOps(
      `🛒 <b>New order</b> ${orders.map((o) => escapeHtml(o.orderNumber)).join(", ")}\n` +
        `₹${summary.totalAmount} · ${paymentMethod === "cod" ? "cash on delivery" : "online, awaiting payment"}`,
    );

    if (idemKey) await finishCheckoutKey(req.user._id, idemKey, checkoutId);
    succeeded = true;
    res.status(201).json({ success: true, data: orders, checkoutId, summary, payment });
  } catch (error) {
    if (checkoutId) await Order.deleteMany({ checkoutId, paymentStatus: "pending" }).catch(() => {});
    if (reserved.length) await restoreStockLines(reserved).catch(() => {});
    sendError(res, error, "Failed to create order");
  } finally {
    // any early "no" (empty cart, no stock, ...) frees the key so a corrected retry is allowed
    if (keyHeld && !succeeded) await releaseCheckoutKey(req.user._id, idemKey as string).catch(() => {});
  }
};

// Price the cart exactly the way createOrder will, without changing anything: one group per shop,
// each with its own delivery fee, plus anything that would stop the order (so checkout can warn first).
// Keep the rules here in step with createOrder above.
// GET /api/orders/quote
export const getQuote = async (req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    const cart: any = await Cart.findOne({ user: req.user._id }).populate("items.product");
    // The delivery location decides the fee: the address chosen at checkout (?addressId=), else the default one.
    const wanted = typeof req.query.addressId === "string" && req.query.addressId ? { _id: req.query.addressId, user: req.user._id } : { user: req.user._id, isDefault: true };
    const addr: any = await Address.findOne(wanted).select("location").lean().catch(() => null);
    const rule = await deliveryRuleFor(addr?.location, settings);
    const threshold = rule.freeAbove;
    const base = {
      gstRegistered: settings.gstRegistered,
      freeShippingThreshold: threshold,
      cod: { allowed: settings.allowCod, max: Number(settings.codMaxAmount) || 0 },
      online: razorpayConfigured(),
    };
    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        data: { ...base, empty: true, groups: [], issues: [], canCheckout: false, summary: { subtotal: 0, shippingCost: 0, tax: 0, totalAmount: 0, orders: 0 } },
      });
    }

    const shopIds = [...new Set(cart.items.map((i: any) => i.product?.shop?.toString()).filter(Boolean) as string[])];
    const shops: any[] = await Shop.find({ _id: { $in: shopIds } }).select("name logo location isOpen status");
    const shopById = new Map(shops.map((s) => [s._id.toString(), s]));

    const issues: { productId: any; name: string; message: string }[] = [];
    const byShop = new Map<string, { shop: any; items: any[] }>();
    for (const item of cart.items) {
      const product: any = item.product;
      if (!product || !product.isActive) {
        issues.push({ productId: product?._id ?? item.product, name: product?.name ?? "An item", message: "is no longer available" });
        continue;
      }
      const shop = product.shop ? shopById.get(product.shop.toString()) : null;
      if (product.shop && (!shop || shop.status !== "approved")) {
        issues.push({ productId: product._id, name: product.name, message: "is not available right now" });
        continue;
      }
      if (shop && !shop.isOpen) issues.push({ productId: product._id, name: product.name, message: `can't be ordered: ${shop.name} is closed right now` });
      if (product.sizes?.length > 0 && !product.sizes.includes(item.size)) issues.push({ productId: product._id, name: product.name, message: "needs a size selected" });
      if (product.stock < item.quantity) {
        issues.push({ productId: product._id, name: product.name, message: product.stock === 0 ? "is out of stock" : `only has ${product.stock} left` });
      }
      const key = shop ? shop._id.toString() : "platform";
      const g = byShop.get(key) ?? { shop: shop ?? null, items: [] };
      g.items.push({ productId: product._id, name: product.name, image: product.images?.[0], quantity: item.quantity, price: product.price, size: item.size, stock: product.stock });
      byShop.set(key, g);
    }

    const sorted = [...byShop.values()].sort((a, b) => (a.shop?.name ?? "￿").localeCompare(b.shop?.name ?? "￿"));
    const subtotals = sorted.map((g) => g.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0));
    // one fee for the whole checkout; each shop's group shows its share so the lines add up
    const delivery = quoteDelivery(subtotals.reduce((a, b) => a + b, 0), rule);
    const totals = checkoutTotals(subtotals, delivery.fee, settings);
    const groups = sorted.map((g, i) => ({
      shop: g.shop && { _id: g.shop._id, name: g.shop.name, logo: g.shop.logo, location: g.shop.location, isOpen: g.shop.isOpen },
      items: g.items,
      ...totals[i],
    }));
    if (!delivery.ok && delivery.reason) issues.push({ productId: null, name: "", message: delivery.reason.replace(/\.$/, "") });

    const sum = (k: "subtotal" | "shippingCost" | "tax" | "totalAmount") => round2(groups.reduce((s, g) => s + g[k], 0));
    const summary = { subtotal: sum("subtotal"), shippingCost: sum("shippingCost"), tax: sum("tax"), totalAmount: sum("totalAmount"), orders: groups.length };
    const deliveryInfo = { location: rule.location, fee: delivery.fee, ok: delivery.ok, reason: delivery.reason, freeAbove: delivery.freeAbove, addForFree: delivery.addForFree, minOrder: delivery.minOrder };
    const codWhy = codBlockReason(settings, summary.totalAmount);

    res.json({
      success: true,
      data: { ...base, empty: false, groups, issues, summary, delivery: deliveryInfo, canCheckout: issues.length === 0 && groups.length > 0, cod: { ...base.cod, allowed: !codWhy, reason: codWhy } },
    });
  } catch (error) {
    sendError(res, error, "Failed to price your cart");
  }
};

// Customer cancels their own order (only before it's processed / paid)
// PUT /api/orders/:id/cancel
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const order: any = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    if (order.orderStatus !== "placed") {
      return res.status(400).json({
        success: false,
        message: `Order can't be cancelled once it is ${order.orderStatus}`,
      });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Paid orders need a refund - please contact support",
      });
    }

    const info = readCancelInfo(req.body, "customer"); // the reason is optional for customers
    if (info.error) return res.status(400).json({ success: false, message: info.error });

    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    order.cancelledBy = "customer";
    if (info.reason) order.cancelReason = info.reason;
    if (info.note) order.cancelNote = info.note;
    await order.save();
    await restoreOrderStock(order._id);

    if (order.shop) {
      const shop: any = await Shop.findById(order.shop).select("owner");
      if (shop) {
        await notify(shop.owner, {
          type: "order",
          title: "Order cancelled by customer",
          body: `${order.orderNumber}${info.reason ? `: ${cancelReasonLabel("customer", info.reason)}` : ""}`,
          data: { orderId: order._id },
        });
      }
    }

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to cancel order");
  }
};

// update order Status (admin)
// PUT /api/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus, paymentStatus } = req.body;

    if (orderStatus && !(ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return res
        .status(400)
        .json({ success: false, message: `orderStatus must be one of: ${ORDER_STATUSES.join(", ")}` });
    }
    if (paymentStatus && !(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
      return res
        .status(400)
        .json({ success: false, message: `paymentStatus must be one of: ${PAYMENT_STATUSES.join(", ")}` });
    }

    const order: any = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const before = { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus };

    if (paymentStatus && paymentStatus !== order.paymentStatus) {
      order.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") order.paidAt = new Date();
    }
    if (orderStatus && orderStatus !== order.orderStatus) {
      await transitionOrder(order, orderStatus, "admin"); // saves
    } else {
      await order.save();
    }

    if (order.orderStatus !== before.orderStatus) {
      await notify(order.user, {
        type: "order",
        title: `Order ${order.orderNumber} is ${order.orderStatus === "shipping" ? "dispatched" : order.orderStatus}`,
        data: { orderId: order._id },
      });
    }
    await logActivity(req, "order.updated", "Order", order._id, {
      from: before,
      to: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to update order");
  }
};

// Get all orders (admin)
// GET /api/orders/admin/all?page=&limit=&status=&paymentStatus=&shop=&search=
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { status, paymentStatus, search, shop } = req.query;

    const query: any = {};
    if (status) query.orderStatus = String(status);
    if (paymentStatus) query.paymentStatus = String(paymentStatus);
    if (shop) query.shop = String(shop);
    if (search) query.orderNumber = new RegExp(escapeRegex(String(search)), "i");

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("shop", "name location")
      .populate("items.product", "name")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: await attachDeliveries(orders),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};
