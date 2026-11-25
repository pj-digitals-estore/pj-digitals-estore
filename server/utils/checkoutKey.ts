import CheckoutKey from "../models/CheckoutKey.js";

export { normalizeKey } from "./idemKey.js";

export type Claim = { state: "claimed" } | { state: "exists"; checkoutId?: string };

/** Atomically reserves the key for this user. "exists" means an earlier attempt already used it. */
export const claimCheckoutKey = async (user: any, key: string): Promise<Claim> => {
  try {
    await CheckoutKey.create({ user, key });
    return { state: "claimed" };
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
    const row: any = await CheckoutKey.findOne({ user, key }).lean();
    return { state: "exists", checkoutId: row?.checkoutId };
  }
};

export const finishCheckoutKey = (user: any, key: string, checkoutId: string) =>
  CheckoutKey.updateOne({ user, key }, { checkoutId });

/** Frees the key after a failed attempt, so the customer can try again with the same one. */
export const releaseCheckoutKey = (user: any, key: string) =>
  CheckoutKey.deleteOne({ user, key, checkoutId: { $exists: false } });
