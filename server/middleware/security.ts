import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Security headers and rate limiting, written without extra packages.
 *
 * The API is reached only through the Cloudflare tunnel, which puts the visitor's real address
 * in CF-Connecting-IP (the API port is not published to the network), so that is what we count
 * per visitor. Without it (local development) we fall back to req.ip.
 */
export const clientIp = (req: Request): string => {
  const cf = req.headers["cf-connecting-ip"];
  const v = Array.isArray(cf) ? cf[0] : cf;
  return (v && v.trim()) || req.ip || req.socket?.remoteAddress || "unknown";
};

/** The useful parts of helmet: no sniffing, no framing, no referrer leaks, HTTPS only (when served over it). */
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (req.headers["x-forwarded-proto"] === "https" || req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  // The JSON API never needs to load anything; the share pages (HTML for link previews) are left alone.
  if (req.path.startsWith("/api/")) res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
};

type Hit = { count: number; reset: number };
type Options = {
  name: string;
  windowMs: number;
  max: number;
  /** What to count by. Defaults to the visitor's address. */
  key?: (req: Request) => string;
  message?: string;
  /** Requests for which the limit does not apply. */
  skip?: (req: Request) => boolean;
};

const MAX_TRACKED = 50_000; // keeps memory bounded even under a flood of different addresses
export const limiterStores = new Set<Map<string, Hit>>();

export function rateLimit(opts: Options): RequestHandler {
  const hits = new Map<string, Hit>();
  limiterStores.add(hits);
  const sweep = () => {
    const now = Date.now();
    for (const [k, h] of hits) if (h.reset <= now) hits.delete(k);
  };
  setInterval(sweep, Math.max(opts.windowMs, 30_000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (opts.skip?.(req)) return next();
    const now = Date.now();
    const key = (opts.key ? opts.key(req) : clientIp(req)) || "unknown";
    let h = hits.get(key);
    if (!h || h.reset <= now) {
      if (!h && hits.size >= MAX_TRACKED) {
        sweep();
        if (hits.size >= MAX_TRACKED) hits.delete(hits.keys().next().value as string); // drop the oldest
      }
      h = { count: 0, reset: now + opts.windowMs };
      hits.set(key, h);
    }
    h.count++;
    const left = Math.max(0, opts.max - h.count);
    const secs = Math.ceil((h.reset - now) / 1000);
    res.setHeader("RateLimit-Limit", String(opts.max));
    res.setHeader("RateLimit-Remaining", String(left));
    res.setHeader("RateLimit-Reset", String(secs));
    if (h.count > opts.max) {
      res.setHeader("Retry-After", String(secs));
      return void res.status(429).json({
        success: false,
        message: opts.message || "Too many requests. Please wait a moment and try again.",
      });
    }
    next();
  };
};

/** Signed-in users are counted by account (so a shared mobile/shop network doesn't punish everyone), others by address. */
export const byUserOrIp = (req: Request): string => {
  let id: string | undefined;
  try {
    const a = (req as any).auth;
    id = (typeof a === "function" ? a.call(req) : a)?.userId;
  } catch {}
  return id ? `u:${id}` : `ip:${clientIp(req)}`;
};

const isWrite = (req: Request) => !["GET", "HEAD", "OPTIONS"].includes(req.method);

// Generous on purpose: many customers share one mobile-carrier address in India.
export const apiLimiter = rateLimit({ name: "api", windowMs: 60_000, max: 600 });
export const writeLimiter = rateLimit({
  name: "writes", windowMs: 60_000, max: 120, key: byUserOrIp, skip: (r) => !isWrite(r),
});
export const supportLimiter = rateLimit({
  name: "support", windowMs: 15 * 60_000, max: 15, key: byUserOrIp, skip: (r) => !isWrite(r),
  message: "You're sending messages too fast. Please try again in a few minutes.",
});
export const orderLimiter = rateLimit({
  name: "orders", windowMs: 60 * 60_000, max: 30, key: byUserOrIp, skip: (r) => r.method !== "POST",
  message: "Too many orders in a short time. Please try again later.",
});
export const reviewLimiter = rateLimit({
  name: "reviews", windowMs: 60 * 60_000, max: 30, key: byUserOrIp, skip: (r) => r.method !== "POST",
  message: "Too many reviews in a short time. Please try again later.",
});
export const trackingLimiter = rateLimit({ name: "tracking", windowMs: 60_000, max: 120 }); // ad impressions/clicks
export const shareLimiter = rateLimit({ name: "share", windowMs: 60_000, max: 120 }); // image rendering is CPU work
export const brandLimiter = rateLimit({ name: "brand", windowMs: 60_000, max: 300 }); // icons are drawn on demand (cached after)
