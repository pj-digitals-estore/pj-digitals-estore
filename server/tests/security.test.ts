import test from "node:test";
import assert from "node:assert/strict";
import { byUserOrIp, clientIp, rateLimit, securityHeaders } from "../middleware/security.js";

const fake = (over: any = {}) => {
  const headers: Record<string, string> = {};
  const res: any = {
    headers, code: 200, body: null,
    setHeader: (k: string, v: string) => { headers[k] = v; },
    removeHeader() {},
    status(c: number) { res.code = c; return res; },
    json(b: any) { res.body = b; return res; },
  };
  const req: any = { headers: {}, method: "GET", path: "/api/x", ip: "1.1.1.1", ...over };
  return { req, res };
};
const hit = (limiter: any, over: any = {}) => { const f = fake(over); let passed = false; limiter(f.req, f.res, () => { passed = true; }); return { ...f, passed }; };

test("a visitor gets their allowance, then a 429 with Retry-After", () => {
  const lim = rateLimit({ name: "t", windowMs: 60_000, max: 3 });
  const results = [1, 2, 3, 4, 5].map(() => hit(lim, { headers: { "cf-connecting-ip": "9.9.9.9" } }));
  assert.deepEqual(results.map((r) => r.passed), [true, true, true, false, false]);
  assert.equal(results[3].res.code, 429);
  assert.ok(results[3].res.headers["Retry-After"]);
  assert.equal(results[3].res.body.success, false);
});

test("other visitors are not affected", () => {
  const lim = rateLimit({ name: "t", windowMs: 60_000, max: 1 });
  hit(lim, { headers: { "cf-connecting-ip": "1.2.3.4" } });
  assert.equal(hit(lim, { headers: { "cf-connecting-ip": "1.2.3.4" } }).passed, false);
  assert.equal(hit(lim, { headers: { "cf-connecting-ip": "5.6.7.8" } }).passed, true);
});

test("the allowance comes back after the window", async () => {
  const lim = rateLimit({ name: "t", windowMs: 50, max: 1 });
  hit(lim); assert.equal(hit(lim).passed, false);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(hit(lim).passed, true);
});

test("skip() exempts a request", () => {
  const lim = rateLimit({ name: "t", windowMs: 1000, max: 0, skip: () => true });
  assert.equal(hit(lim).passed, true);
});

test("clientIp prefers Cloudflare's header and falls back to the socket address", () => {
  assert.equal(clientIp(fake({ headers: { "cf-connecting-ip": "5.5.5.5" } }).req), "5.5.5.5");
  assert.equal(clientIp(fake().req), "1.1.1.1");
});

test("signed-in users are counted by account; anyone else by address; a broken auth never throws", () => {
  assert.equal(byUserOrIp(fake({ auth: () => ({ userId: "abc" }) }).req), "u:abc");
  assert.equal(byUserOrIp(fake({ auth: { userId: "z" } }).req), "u:z");
  assert.equal(byUserOrIp(fake().req), "ip:1.1.1.1");
  assert.equal(byUserOrIp(fake({ auth: () => { throw new Error("x"); } }).req), "ip:1.1.1.1");
});

test("security headers: HSTS only over HTTPS, a strict CSP only for /api", () => {
  const a = fake({ headers: { "x-forwarded-proto": "https" } });
  securityHeaders(a.req, a.res, () => {});
  assert.ok(a.res.headers["Strict-Transport-Security"]);
  assert.match(a.res.headers["Content-Security-Policy"], /default-src 'none'/);
  assert.equal(a.res.headers["X-Frame-Options"], "DENY");
  const b = fake({ path: "/share/product/1" });
  securityHeaders(b.req, b.res, () => {});
  assert.equal(b.res.headers["Strict-Transport-Security"], undefined);
  assert.equal(b.res.headers["Content-Security-Policy"], undefined);
});
