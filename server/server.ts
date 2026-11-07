import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhook } from "./controllers/webhooks.js";
import makeAdmin from "./scripts/makeAdmin.js";
import ProductRouter from "./routes/productsRoutes.js";
import CartRouter from "./routes/cartRoutes.js";
import OrderRouter from "./routes/ordersRoute.js";
import AddressRouter from "./routes/addressRoutes.js";
import AdminRouter from "./routes/adminRoutes.js";
import { ShopRouter } from './routes/shopRoutes.js';
import { PaymentRouter, paymentWebhook } from './routes/paymentRoutes.js';

const app = express();

// Use Clerk middleware
app.use(clerkMiddleware());

// COnnect to mongoDB
await connectDB();

app.post("/api/clerk", express.raw({ type: "application/json" }), clerkWebhook);
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhook);

// Middleware
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.send("Server is Live!");
});

app.use("/api/products", ProductRouter);
app.use("/api/cart", CartRouter);
app.use("/api/orders", OrderRouter);
app.use("/api/address", AddressRouter);
app.use("/api/admin", AdminRouter);
app.use('/api/shops', ShopRouter);
app.use('/api/payments', PaymentRouter);

app.use((error: any, _req: Request, res: Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error);
  const message = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
    ? 'A product can have a maximum of 5 images.'
    : 'Invalid request or product photo. Choose JPEG, PNG or WebP images under 3 MB total.';
  res.status(error.status === 413 ? 413 : 400).json({ success: false, message });
});

await makeAdmin();

export default app;
if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}
