import express from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import upload from "../middleware/upload.js";
import { authorize, protect } from "../middleware/auth.js";

const ProductRouter = express.Router();

// Get all products
ProductRouter.get("/", getProducts);

// Get single product
ProductRouter.get("/:id", getProduct);

// Create product (Admin)
ProductRouter.post(
  "/",
  protect,
  authorize("admin"),
  upload.array("images", 5),
  createProduct,
);

// Update product (Admin)
ProductRouter.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.array("images", 5),
  updateProduct,
);

// Delete product (Admin)
ProductRouter.delete(
  "/:id",

  protect,
  authorize("admin"),
  deleteProduct,
);

export default ProductRouter;
