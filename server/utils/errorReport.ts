import { randomBytes } from "node:crypto";

/**
 * Error tracking with no extra packages: sends events to Sentry (or GlitchTip, which speaks the same protocol)
 * over plain HTTPS. Switched on by SENTRY_DSN; without it everything here is a no-op.
 * It never throws, never blocks a request, sends no request bodies or headers, and throttles repeats.
 */

export type Dsn = { endpoint: string; publicKey: string };

/** https://<key>@<host>[/path]/<projectId>  ->  where to post envelopes. null if it isn't a usable DSN. */
export const parseDsn = (raw: unknown): Dsn | null => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol) || !u.username) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const projectId = parts.pop();
    if (!projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = parts.length ? "/" + parts.join("/") : "";
    return {
      publicKey: decodeURIComponent(u.username),
      endpoint: `${u.protocol}//${u.host}${prefix}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
};

/** V8 stack text -> Sentry frames (oldest call first, as Sentry expects). */
export const parseStack = (stack: unknown) => {
  if (typeof stack !== "string") return [];
  const frames: any[] = [];
  for (const line of stack.split("\n")) {
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!m) continue;
    const filename = m[2].replace(/^file:\/\//, "");
    frames.push({
      function: m[1] || "<anonymous>",
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !filename.includes("node_modules") && !filename.startsWith("node:"),
    });
  }
  return frames.reverse();
};

const hex32 = () => randomBytes(16).toString("hex");

export type Ctx = {
  level?: "error" | "warning" | "info";
  tags?: Record<string, string | number | undefined>;
  extra?: Record<string, unknown>;
  message?: string; // report this text instead of an exception (e.g. "Slow request")
};

export const buildEvent = (err: unknown, ctx: Ctx = {}, now = Date.now()) => {
  const e: any = err;
  const event: any = {
    event_id: hex32(),
    timestamp: now / 1000,
    platform: "node",
    level: ctx.level || "error",
    environment: process.env.NODE_ENV || "development",
    release: process.env.RELEASE || undefined,
    server_name: "estore-api",
    tags: Object.fromEntries(Object.entries(ctx.tags || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])),
    extra: ctx.extra,
  };
  if (ctx.message !== undefined) {
    event.message = String(ctx.message).slice(0, 500);
  } else {
    event.exception = {
      values: [
        {
          type: String(e?.name || "Error").slice(0, 100),
          value: String(e?.message ?? e ?? "Unknown error").slice(0, 500),
          stacktrace: { frames: parseStack(e?.stack) },
        },
      ],
    };
  }
  return event;
};

export const buildEnvelope = (event: any, dsnRaw: string) =>
  [JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: dsnRaw }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");

/** Same problem repeating is sent once a minute; at most 30 events a minute overall. */
export class Throttle {
  private seen = new Map<string, number>();
  private recent: number[] = [];
  constructor(private perKeyMs = 60_000, private maxPerMinute = 30) {}
  allow(key: string, now = Date.now()) {
    this.recent = this.recent.filter((t) => now - t < 60_000);
    if (this.recent.length >= this.maxPerMinute) return false;
    const last = this.seen.get(key);
    if (last !== undefined && now - last < this.perKeyMs) return false;
    if (this.seen.size >= 200) this.seen.clear();
    this.seen.set(key, now);
    this.recent.push(now);
    return true;
  }
}

const throttle = new Throttle();
let sent = 0;
export const errorReportStats = () => ({ configured: !!parseDsn(process.env.SENTRY_DSN), sent });

/** Fire and forget. Safe to call from anywhere, including a failing request. */
export const reportError = (err: unknown, ctx: Ctx = {}) => {
  try {
    const raw = process.env.SENTRY_DSN;
    const dsn = parseDsn(raw);
    if (!dsn || !raw) return;
    const e: any = err;
    const key = `${ctx.message ?? e?.name}|${ctx.message ?? e?.message}|${ctx.tags?.route ?? ""}`;
    if (!throttle.allow(key)) return;
    const body = buildEnvelope(buildEvent(err, ctx), raw);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    void fetch(`${dsn.endpoint}?sentry_version=7&sentry_key=${encodeURIComponent(dsn.publicKey)}&sentry_client=estore-lite%2F1`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      signal: ctl.signal,
    })
      .then(() => { sent += 1; })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  } catch {
    /* reporting must never break the app */
  }
};

/** The DSN the browser may use: FRONTEND_SENTRY_DSN if set, else the same one. Public by design (it only allows sending). */
export const publicDsn = () => {
  const v = process.env.FRONTEND_SENTRY_DSN || process.env.SENTRY_DSN || "";
  return parseDsn(v) ? v : "";
};
