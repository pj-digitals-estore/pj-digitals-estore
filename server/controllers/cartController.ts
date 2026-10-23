import { Request, Response } from "express";

// get user cart
// GET /api/cart
export const getCart = async (req: Request, res: Response) => {
    // 07:22:15
};

// add item to cart
// POST /api/cart/add
export const addToCart = async (req: Request, res: Response) => {};

// update cart items
// PUT /api/cart/item/:productId
export const updateCartItems = async (req: Request, res: Response) => {};

// remove item from cart
// DELETE /api/cart/item/:productId
export const removeCartItem = async (req: Request, res: Response) => {};

// clear cart
// DELETE /api/cart
export const clearCart = async (req: Request, res: Response) => {};
