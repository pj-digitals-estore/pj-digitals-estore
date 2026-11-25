import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { buildEnvelope, buildEvent, parseDsn, parseStack, publicDsn, reportError, Throttle } from "../utils/errorReport.js";

test("a DSN is turned into an ingest address and key", () => {
  assert.deepEqual(parseDsn("https://abc123@o1.ingest.sentry.io/4507"), { publicKey: "abc123", endpoint: "https://o1.ingest.sentry.io/api/4507/envelope/" });
  assert.equal(parseDsn("https://k@glitch.example.com/sub/path/12")?.endpoint, "https://glitch.example.com/sub/path/api/12/envelope/");
  for (const bad of ["", "nope", "https://host/123", "https://k@host/abc", undefined, 5, "ftp://k@h/1"]) assert.equal(parseDsn(bad as any), null, String(bad));
});

test("a V8 stack becomes frames, oldest call first, app code marked", () => {
  const f = parseStack("Error: x\n    at doIt (/app/dist/a.js:10:5)\n    at /app/node_modules/express/lib/router.js:1:2\n    at node:internal/process:3:4\n    at Object.<anonymous> (file:///app/dist/b.js:7:8)");
  assert.equal(f.length, 4);
  assert.equal(f[0].filename, "/app/dist/b.js"); // last in the text = oldest... reversed order puts newest last
  assert.equal(f[3].function, "doIt");
  assert.equal(f[3].lineno, 10);
  assert.equal(f[3].in_app, true);
  assert.equal(f[2].in_app, false); // node_modules
  assert.equal(f[1].in_app, false); // node: internals
  assert.deepEqual(parseStack(undefined), []);
});

test("an event carries the error, tags and no request data", () => {
  const ev = buildEvent(new TypeError("bad thing"), { tags: { route: "POST /api/orders", skip: undefined }, extra: { ms: 5 } }, 1_700_000_000_000);
  assert.equal(ev.exception.values[0].type, "TypeError");
  assert.equal(ev.exception.values[0].value, "bad thing");
  assert.deepEqual(ev.tags, { route: "POST /api/orders" });
  assert.equal(ev.timestamp, 1_700_000_000);
  assert.match(ev.event_id, /^[0-9a-f]{32}$/);
  assert.equal(ev.request, undefined);
  assert.equal(buildEvent(null, { message: "Slow request: GET /x", level: "warning" }).message, "Slow request: GET /x");
  assert.equal(buildEvent("just a string").exception.values[0].value, "just a string");
});

test("the envelope is three JSON lines", () => {
  const lines = buildEnvelope(buildEvent(new Error("e")), "https://k@h/1").split("\n");
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[1]).type, "event");
  assert.equal(JSON.parse(lines[0]).dsn, "https://k@h/1");
});

test("the same problem is sent once a minute, and floods are capped", () => {
  const t = new Throttle(60_000, 3);
  assert.equal(t.allow("a", 0), true);
  assert.equal(t.allow("a", 1000), false);
  assert.equal(t.allow("b", 1000), true);
  assert.equal(t.allow("c", 1000), true);
  assert.equal(t.allow("d", 1000), false); // 3 per minute cap
  assert.equal(t.allow("a", 61_000), true);
});

test("reportError posts to the DSN host and survives a dead one", async () => {
  const got: { url: string; body: string }[] = [];
  const srv = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { got.push({ url: req.url || "", body: b }); res.end("{}"); });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as any).port;
  process.env.SENTRY_DSN = `http://pubkey@127.0.0.1:${port}/42`;
  reportError(new Error("integration boom"), { tags: { route: "t1" } });
  for (let i = 0; i < 50 && !got.length; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(got.length, 1);
  assert.match(got[0].url, /^\/api\/42\/envelope\/\?sentry_version=7&sentry_key=pubkey/);
  assert.match(got[0].body, /integration boom/);
  assert.equal(publicDsn(), process.env.SENTRY_DSN);
  srv.close();
  // dead host: must not throw or hang
  process.env.SENTRY_DSN = "http://k@127.0.0.1:1/9";
  assert.doesNotThrow(() => reportError(new Error("nobody home"), { tags: { route: "t2" } }));
  delete process.env.SENTRY_DSN;
  assert.doesNotThrow(() => reportError(new Error("no dsn")));
});
