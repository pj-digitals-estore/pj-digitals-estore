import test from "node:test";
import assert from "node:assert/strict";
import { clampExpiryMinutes, createJobLoop } from "../utils/jobLoop.js";

test("a tick is skipped while the previous run is still going", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const loop = createJobLoop({ intervalMs: 1000, run: async () => { calls++; await gate; } });
  const first = loop.tick();
  assert.equal(await loop.tick(), false); // overlapping: skipped
  assert.equal(calls, 1);
  release();
  await first;
  assert.equal(await loop.tick(), true); // free again
  assert.equal(calls, 2);
});

test("an error is reported and the loop keeps working", async () => {
  const seen: unknown[] = [];
  let n = 0;
  const loop = createJobLoop({
    intervalMs: 1000,
    run: async () => { if (++n === 1) throw new Error("boom"); },
    onError: (e) => seen.push((e as Error).message),
  });
  await loop.tick();
  await loop.tick();
  assert.deepEqual(seen, ["boom"]);
  assert.equal(n, 2);
});

test("start/stop schedule real ticks and stop cleanly", async () => {
  let n = 0;
  const loop = createJobLoop({ intervalMs: 20, firstDelayMs: 5, run: async () => { n++; } });
  loop.start();
  await new Promise((r) => setTimeout(r, 90));
  loop.stop();
  const atStop = n;
  assert.ok(atStop >= 2, `ran ${atStop} times`);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(n, atStop);
});

test("unpaid-order expiry window is clamped", () => {
  assert.equal(clampExpiryMinutes(undefined), 30);
  assert.equal(clampExpiryMinutes("abc"), 30);
  assert.equal(clampExpiryMinutes(1), 5); // never faster than 5 minutes: payment sheets take time
  assert.equal(clampExpiryMinutes(45), 45);
  assert.equal(clampExpiryMinutes(99999), 1440);
});
