import express from "express";
import {
  createOrder,
  getAllOrders,
  getOrder,
  getOrders,
  updateOrderStatus,
  resumeCheckout,
  cancelUnpaidOrder,
} from "../controllers/ordersController.js";
import { authorize, protect } from "../middleware/auth.js";

const OrderRouter = express.Router();

// Get user orders
OrderRouter.get("/", protect, getOrders);

// Get single orders
OrderRouter.get("/:id", protect, getOrder);

// create orders from cart
OrderRouter.post("/", protect, createOrder);
OrderRouter.post('/:id/checkout', protect, resumeCheckout);
OrderRouter.post('/:id/cancel', protect, cancelUnpaidOrder);

// Update order status (admin)
OrderRouter.put("/:id/status", protect, authorize("admin"), updateOrderStatus);

// Get all order (admin)
OrderRouter.get("/admin/all", protect, authorize("admin"), getAllOrders);

export default OrderRouter;
