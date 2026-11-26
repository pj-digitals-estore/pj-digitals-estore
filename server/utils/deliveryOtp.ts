import { createHmac, timingSafeEqual } from "node:crypto";

// The customer's delivery code. It is worked out from the order id and a server secret, so nothing is
// stored and every order (old ones too) has a code. The customer sees it in the app; the delivery partner
// must type it to mark the order delivered. Nobody can guess it from the order id without the secret.

export const OTP_MAX_ATTEMPTS = 5; // wrong tries before the job is locked (an admin can still complete it)
export const OTP_MODES = ["off", "cod", "all"] as const;
export type OtpMode = (typeof OTP_MODES)[number];

const secret = () =>
  process.env.DELIVERY_OTP_SECRET || process.env.CLERK_SECRET_KEY || process.env.MONGODB_URI || "estore-dev-secret";

export const otpFor = (orderId: unknown, key: string = secret()) => {
  const digest = createHmac("sha256", key).update(`delivery-otp:${String(orderId)}`).digest();
  return String(digest.readUInt32BE(0) % 10000).padStart(4, "0");
};

/** Is a code needed for this order? "cod" = only cash-on-delivery orders (where cash changes hands). */
export const otpRequired = (mode: string | undefined, paymentMethod: string | undefined) =>
  mode === "all" || (mode === "cod" && paymentMethod === "cod");

export const checkOtp = (input: unknown, expected: string) => {
  const given = String(input ?? "").replace(/\D/g, "");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

/** The code the customer may see: only while the order is still on its way to them. */
export const codeForCustomer = (order: { _id: unknown; orderStatus?: string; paymentMethod?: string }, mode: string | undefined) =>
  otpRequired(mode, order.paymentMethod) && ["placed", "processing", "shipping"].includes(String(order.orderStatus)) ? otpFor(order._id) : undefined;
