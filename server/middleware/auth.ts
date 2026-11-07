import { NextFunction, Request, Response } from "express";
import User from "../models/User.js";
import { clerkClient } from '@clerk/express';

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = await req.auth();

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    let user = await User.findOne({
      clerkId: userId,
    });
    if (!user) {
      const profile = await clerkClient.users.getUser(userId);
      const email = profile.emailAddresses.find(item => item.id === profile.primaryEmailAddressId)?.emailAddress;
      if (!email) return res.status(409).json({ success: false, message: 'Complete your account email before continuing.' });
      user = await User.findOneAndUpdate({ clerkId: userId }, { $setOnInsert: { clerkId: userId, email: email.toLowerCase(), name: [profile.firstName, profile.lastName].filter(Boolean).join(' '), image: profile.imageUrl, role: 'user' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Error in protect middleware, auth error:", error);
    res.status(500).json({ success: false, message: "failed auth" });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden, unauh role" });
    }
    next();
  };
};
