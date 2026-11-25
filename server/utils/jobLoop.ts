/**
 * A repeating job that never overlaps itself: if the previous run is still going when the next tick
 * arrives, that tick is skipped. Errors are handed to onError and never stop the loop.
 */
export const createJobLoop = (opts: {
  run: () => Promise<unknown>;
  intervalMs: number;
  firstDelayMs?: number;
  onError?: (e: unknown) => void;
}) => {
  let running = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  let first: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (running) return false;
    running = true;
    try {
      await opts.run();
    } catch (e) {
      opts.onError?.(e);
    } finally {
      running = false;
    }
    return true;
  };

  return {
    tick,
    start() {
      first = setTimeout(() => void tick(), opts.firstDelayMs ?? 60_000);
      interval = setInterval(() => void tick(), opts.intervalMs);
      first.unref?.();
      interval.unref?.(); // never keeps the process alive on its own
    },
    stop() {
      if (first) clearTimeout(first);
      if (interval) clearInterval(interval);
    },
  };
};

/** Minutes after which an unpaid online order is given up on: at least 5, default 30. */
export const clampExpiryMinutes = (raw: unknown) => Math.max(5, Math.min(24 * 60, Number(raw) || 30));
