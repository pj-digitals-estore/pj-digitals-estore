import express from "express";
import { protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import { createSubscription, deleteSubscription, listSubscriptions, markOrdered, updateSubscription } from "../controllers/subscriptionController.js";

const SubscriptionRouter = express.Router();
SubscriptionRouter.use(protect);
SubscriptionRouter.get("/", listSubscriptions);
SubscriptionRouter.post("/", createSubscription);
SubscriptionRouter.put("/:id", validateObjectId("id"), updateSubscription);
SubscriptionRouter.post("/:id/done", validateObjectId("id"), markOrdered);
SubscriptionRouter.delete("/:id", validateObjectId("id"), deleteSubscription);

export default SubscriptionRouter;
