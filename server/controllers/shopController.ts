import { Request, Response } from "express";
import Shop from "../models/Shop.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Settlement from "../models/Settlement.js";
import { ORDER_STATUSES, SERVICE_LOCATIONS } from "../types/index.js";
import { escapeRegex, sendError } from "../utils/http.js";
import { destroyImages, uploadImage } from "../utils/imageStore.js";
import { attachDeliveries, cancelReasonLabel, readCancelInfo, transitionOrder } from "../utils/orderHelpers.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { getSettings } from "../utils/settings.js";
import { csvSafe } from "../utils/csvImport.js";
import { toCsv } from "../utils/payouts.js";
import { shopMayAssignDrivers } from "./shopDispatchController.js";
import { adjustStock } from "./inventoryController.js";

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
  "-" +
  Math.random().toString(36).slice(2, 6);

const parseList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* comma separated */
  }
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const PROFILE_FIELDS = [
  "name",
  "description",
  "phone",
  "email",
  "addressLine",
  "landmark",
  "location",
  "openingHours",
  "isOpen",
] as const;

const pickProfile = (body: any) => {
  const out: Record<string, any> = {};
  for (const f of PROFILE_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (body.categories !== undefined) out.categories = parseList(body.categories);
  if (body.coordinates !== undefined) {
    let c = body.coordinates;
    if (typeof c === "string") {
      try {
        c = JSON.parse(c);
      } catch {
        c = undefined;
      }
    }
    if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
      out.coordinates = { lat: Number(c.lat), lng: Number(c.lng) };
    }
  }
  return out;
};

const PUBLIC_SELECT = "-owner -statusReason -approvedBy";

// ===================== PUBLIC (customer app) =====================

// GET /api/shops?location=&search=&category=&page=&limit=
export const listShops = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = { status: "approved" };

    if (req.query.location) query.location = String(req.query.location);
    if (req.query.category) query.categories = String(req.query.category);
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
      query.$or = [{ name: rx }, { barcode: rx }, { sku: rx }, { brand: rx }];
    }

    const [total, shops] = await Promise.all([
      Shop.countDocuments(query),
      Shop.find(query)
        .select(PUBLIC_SELECT)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: shops,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch shops");
  }
};

// GET /api/shops/:id
export const getShop = async (req: Request, res: Response) => {
  try {
    const shop = await Shop.findOne({ _id: req.params.id, status: "approved" }).select(
      PUBLIC_SELECT,
    );
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }
    const productCount = await Product.countDocuments({ shop: shop._id, isActive: true });
    res.json({ success: true, data: { ...shop.toObject(), productCount } });
  } catch (error) {
    sendError(res, error, "Failed to fetch shop");
  }
};

// ===================== APPLY / OWN PROFILE =====================

// POST /api/shops/apply   (multipart; optional `logo` file)
// Any signed-in user can apply. The shop starts as "pending" and becomes usable
// (and the user becomes a shop_owner) once an admin approves it.
export const applyForShop = async (req: Request, res: Response) => {
  let logo: string | undefined;
  try {
    if (await Shop.exists({ owner: req.user._id })) {
      return res
        .status(409)
        .json({ success: false, message: "You have already applied for a shop" });
    }

    const data = pickProfile(req.body);
    if (!data.name?.trim() || !data.phone?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "name and phone are required" });
    }
    if (!(SERVICE_LOCATIONS as readonly string[]).includes(data.location)) {
      return res.status(400).json({
        success: false,
        message: `location must be one of: ${SERVICE_LOCATIONS.join(", ")}`,
      });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) logo = (await uploadImage(file, "pj-digitals-estore/shops")).secure_url;

    const shop = await Shop.create({
      ...data,
      isOpen: undefined, // always starts with the default
      owner: req.user._id,
      slug: slugify(data.name),
      logo,
      status: "pending",
    });

    await notifyAdmins({
      type: "shop",
      title: "New shop application",
      body: shop.name,
      data: { shopId: shop._id },
    });

    res.status(201).json({ success: true, data: shop });
  } catch (error) {
    if (logo) await destroyImages([logo]);
    sendError(res, error, "Failed to submit shop application");
  }
};

// GET /api/shop/me   (works while pending so the app can show the status)
export const getMyShop = async (req: Request, res: Response) => {
  const shop: any = req.shop;
  const allowed = await shopMayAssignDrivers(shop).catch(() => false);
  res.json({ success: true, data: { ...shop.toObject(), canAssignDrivers: allowed, canAssignDriversOverride: shop.canAssignDrivers } });
};

// PUT /api/shop/me   (multipart; optional `logo`)
export const updateMyShop = async (req: Request, res: Response) => {
  let newLogo: string | undefined;
  try {
    const shop = req.shop;
    const updates = pickProfile(req.body);

    if (updates.location && !(SERVICE_LOCATIONS as readonly string[]).includes(updates.location)) {
      return res.status(400).json({
        success: false,
        message: `location must be one of: ${SERVICE_LOCATIONS.join(", ")}`,
      });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      newLogo = (await uploadImage(file, "pj-digitals-estore/shops")).secure_url;
      updates.logo = newLogo;
    }

    const oldLogo = shop.logo;
    shop.set(updates);
    await shop.save();
    if (newLogo && oldLogo) await destroyImages([oldLogo]);

    res.json({ success: true, data: shop });
  } catch (error) {
    if (newLogo) await destroyImages([newLogo]);
    sendError(res, error, "Failed to update shop");
  }
};

// ===================== OWNER: INVENTORY =====================

// GET /api/shop/products?search=&lowStock=true&isActive=&page=&limit=
export const getShopProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = { shop: req.shop._id };

    if (req.query.search) {
      query.name = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
    }
    if (req.query.lowStock === "true") query.stock = { $lte: (await getSettings()).lowStockLevel };
    if (req.query.isActive === "true" || req.query.isActive === "false") {
      query.isActive = req.query.isActive === "true";
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .select("+costPrice")
        .sort("-updatedAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch inventory");
  }
};

// PUT /api/shop/products/:id/stock   body: { stock } (set) OR { adjust } (+/-)
// Kept for the existing screens; it now goes through the same code as the new stock tools,
// so every change is also written to the stock history.
export const updateStock = async (req: Request, res: Response) => {
  const { stock, adjust } = req.body || {};
  if (stock === undefined && adjust === undefined) {
    return res.status(400).json({ success: false, message: "Provide stock or adjust" });
  }
  req.body = stock !== undefined ? { set: stock } : { delta: adjust };
  return adjustStock(req, res);
};

// ===================== OWNER: ORDERS =====================

// GET /api/shop/orders?status=&page=&limit=   (includes delivery info)
export const getShopOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    // unpaid online orders aren't the shop's yet (they expire if never paid)
    const query: any = {
      shop: req.shop._id,
      $or: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }],
    };
    if (req.query.status) query.orderStatus = String(req.query.status);

    const [total, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .populate("user", "name")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: await attachDeliveries(orders),
      canAssignDrivers: await shopMayAssignDrivers(req.shop),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

// GET /api/shop/orders/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD   (dates are India time; default: last 30 days)
export const exportShopOrders = async (req: Request, res: Response) => {
  try {
    const ist = (d: string, end: boolean) => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T${end ? "23:59:59.999" : "00:00:00.000"}+05:30`) : null;
    const to = ist(String(req.query.to || ""), true) ?? new Date();
    const from = ist(String(req.query.from || ""), false) ?? new Date(to.getTime() - 30 * 86_400_000);
    const orders: any[] = await Order.find({
      shop: req.shop._id,
      createdAt: { $gte: from, $lte: to },
      $or: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }],
    }).sort("createdAt").limit(10000).lean();
    const when = (d: Date) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const rows = orders.map((o) => ({
      order_number: o.orderNumber,
      date: when(o.createdAt),
      customer: csvSafe(o.shippingAddress?.fullName ?? ""),
      phone: csvSafe(o.shippingAddress?.phone ?? ""),
      area: csvSafe(o.shippingAddress?.location ?? o.shippingAddress?.city ?? ""),
      status: o.orderStatus,
      payment: `${o.paymentMethod} / ${o.paymentStatus}`,
      items: csvSafe((o.items || []).map((i: any) => `${i.name}${i.size ? ` (${i.size})` : ""} x${i.quantity}`).join(" | ")),
      items_total: o.subtotal,
      delivery_fee: o.shippingCost ?? 0,
      tax: o.tax ?? 0,
      order_total: o.totalAmount,
      cancel_reason: o.orderStatus === "cancelled" ? o.cancelReason ?? "" : "",
    }));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="my-orders.csv"');
    res.send("\uFEFF" + (rows.length ? toCsv(rows) : "order_number,date,customer,status,order_total"));
  } catch (error) {
    sendError(res, error, "Failed to export orders");
  }
};

// PUT /api/shop/orders/:id/status   body: { orderStatus: "processing" | "cancelled" }
// ("shipping"/"delivered" are driven by the delivery partner.)
export const updateShopOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus } = req.body;
    if (!(ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return res
        .status(400)
        .json({ success: false, message: `orderStatus must be one of: ${ORDER_STATUSES.join(", ")}` });
    }

    const order: any = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (
      order.paymentMethod === "razorpay" &&
      order.paymentStatus !== "paid" &&
      orderStatus !== "cancelled"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "This online order hasn't been paid yet" });
    }

    let cancel;
    if (orderStatus === "cancelled" && order.orderStatus !== "cancelled") {
      const info = readCancelInfo(req.body, "shop", { required: true });
      if (info.error) return res.status(400).json({ success: false, message: info.error });
      cancel = { ...info, by: "shop" as const };
    }

    await transitionOrder(order, orderStatus, "shop", cancel);

    await notify(order.user, {
      type: "order",
      title: `Order ${order.orderNumber} is ${orderStatus}`,
      body: cancel?.reason
        ? `${req.shop.name}: ${cancelReasonLabel("shop", cancel.reason)}${cancel.note ? ` (${cancel.note})` : ""}`
        : req.shop.name,
      data: { orderId: order._id },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to update order");
  }
};

// ===================== OWNER: STATS / SETTLEMENTS =====================

// GET /api/shop/stats?days=30
// Every date from `since` to today in India time, so the chart has no gaps (days without sales show 0).
export const fillDays = (rows: { _id: string; orders: number; sales: number }[], days: number, now = new Date()) => {
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const by = new Map(rows.map((r) => [r._id, r]));
  const out: { date: string; orders: number; sales: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = fmt(new Date(now.getTime() - i * 86_400_000));
    const r = by.get(date);
    out.push({ date, orders: r?.orders ?? 0, sales: r?.sales ?? 0 });
  }
  return out;
};

export const getShopStats = async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const DAY = 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - days * DAY);
    const before = new Date(since.getTime() - days * DAY); // the same length of time just before, to compare with
    const shopId = req.shop._id;
    const lowLevel = (await getSettings()).lowStockLevel;
    const live = { shop: shopId, orderStatus: { $ne: "cancelled" } };
    const sumOrders = (from: Date, to: Date) => Order.aggregate([
      { $match: { ...live, createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, orders: { $sum: 1 }, sales: { $sum: "$subtotal" }, paidSales: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$subtotal", 0] } } } },
    ]);

    const [totals, prevTotals, statusAgg, daily, topProducts, byCategory, lowStock, productCount] = await Promise.all([
      sumOrders(since, new Date(Date.now() + DAY)),
      sumOrders(before, since),
      Order.aggregate([
        { $match: { shop: shopId } },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...live, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, orders: { $sum: 1 }, sales: { $sum: "$subtotal" } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { ...live, createdAt: { $gte: since } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", name: { $first: "$items.name" }, unitsSold: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
      ]),
      // revenue by category + an estimate of profit (uses today's cost price; products without one don't count)
      Order.aggregate([
        { $match: { ...live, createdAt: { $gte: since } } },
        { $unwind: "$items" },
        { $lookup: { from: Product.collection.name, localField: "items.product", foreignField: "_id", as: "p" } },
        { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ["$p.category", "Other"] },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          units: { $sum: "$items.quantity" },
          costedRevenue: { $sum: { $cond: [{ $gt: ["$p.costPrice", null] }, { $multiply: ["$items.price", "$items.quantity"] }, 0] } },
          costedCost: { $sum: { $cond: [{ $gt: ["$p.costPrice", null] }, { $multiply: ["$p.costPrice", "$items.quantity"] }, 0] } },
        } },
        { $sort: { revenue: -1 } },
      ]),
      Product.find({ shop: shopId, isActive: true, stock: { $lte: lowLevel } }).select("name stock images").sort("stock").limit(10),
      Product.countDocuments({ shop: shopId }),
    ]);

    const itemsRevenue = byCategory.reduce((s: number, c: any) => s + c.revenue, 0);
    const costed = byCategory.reduce((s: number, c: any) => s + c.costedRevenue, 0);
    const cost = byCategory.reduce((s: number, c: any) => s + c.costedCost, 0);

    res.json({
      success: true,
      data: {
        periodDays: days,
        orders: totals[0]?.orders ?? 0,
        sales: totals[0]?.sales ?? 0,
        paidSales: totals[0]?.paidSales ?? 0,
        previous: { orders: prevTotals[0]?.orders ?? 0, sales: prevTotals[0]?.sales ?? 0 },
        productCount,
        ordersByStatus: Object.fromEntries(statusAgg.map((s) => [s._id, s.count])),
        dailySales: fillDays(daily, days),
        topProducts,
        salesByCategory: byCategory.map((c: any) => ({ category: c._id, revenue: c.revenue, units: c.units })),
        profit: { estimated: Math.round((costed - cost) * 100) / 100, coverage: itemsRevenue ? Math.round((costed / itemsRevenue) * 100) : 0 },
        lowStockProducts: lowStock,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load stats");
  }
};

// GET /api/shop/settlements
export const getShopSettlements = async (req: Request, res: Response) => {
  try {
    const settlements = await Settlement.find({ shop: req.shop._id })
      .select("-orders")
      .sort("-createdAt");
    res.json({ success: true, data: settlements });
  } catch (error) {
    sendError(res, error, "Failed to fetch settlements");
  }
};
