import type { NextFunction, Request, Response } from "express";
import { reportError, Throttle } from "../utils/errorReport.js";

const slowMs = () => Math.max(200, Number(process.env.SLOW_REQUEST_MS) || 1500);
const perRoute = new Throttle(10 * 60_000, 20);

/** Logs (and reports, if error tracking is on) any request that takes longer than SLOW_REQUEST_MS (default 1500). */
export const slowRequests = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms < slowMs()) return;
    // the route pattern (/api/orders/:id), never the real URL, so ids and queries stay out of logs
    const route = `${req.method} ${req.baseUrl || ""}${req.route?.path ?? ""}` || `${req.method} (unmatched)`;
    console.warn(`Slow request: ${route} took ${Math.round(ms)}ms (status ${res.statusCode})`);
    if (perRoute.allow(route)) {
      reportError(null, { level: "warning", message: `Slow request: ${route}`, tags: { route, status: res.statusCode }, extra: { ms: Math.round(ms) } });
    }
  });
  next();
};
