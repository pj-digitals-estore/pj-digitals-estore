import express from "express";
import { protect } from "../middleware/auth.js";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItems,
} from "../controllers/cartController.js";

const CartRouter = express.Router();

// get user cart
CartRouter.get("/", protect, getCart);

// add item to cart
CartRouter.post("/add", protect, addToCart);

// update cart item quantity
CartRouter.put("/item/:productId", protect, updateCartItems);

// remove cart item quantity
CartRouter.delete("/item/:productId", removeCartItem);

// clear cart
CartRouter.delete("/", protect, clearCart);

export default CartRouter;
