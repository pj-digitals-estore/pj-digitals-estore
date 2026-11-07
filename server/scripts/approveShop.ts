import 'dotenv/config';
import mongoose from 'mongoose';
import { clerkClient } from '@clerk/express';
import User from '../models/User.js';
import Shop from '../models/Shop.js';

// Explicit operator-only command. Never run automatically on server startup.
async function main() {
  const { TRIAL_SHOP_EMAIL: email, TRIAL_SHOP_NAME: name, TRIAL_SHOP_CITY: city, TRIAL_SHOP_ADDRESS: address, MONGODB_URI } = process.env;
  if (!email || !name || !address || !['Thodupuzha', 'Muttom'].includes(city || '') || !MONGODB_URI) throw new Error('Set TRIAL_SHOP_EMAIL, TRIAL_SHOP_NAME, TRIAL_SHOP_CITY, TRIAL_SHOP_ADDRESS and MONGODB_URI.');
  const profiles = await clerkClient.users.getUserList({ emailAddress: [email] });
  if (profiles.data.length !== 1) throw new Error('The owner must have exactly one matching Clerk account.');
  const profile = profiles.data[0];
  await mongoose.connect(MONGODB_URI);
  const user = await User.findOneAndUpdate({ clerkId: profile.id }, { $set: { email: email.toLowerCase(), name: [profile.firstName, profile.lastName].filter(Boolean).join(' '), role: 'shop' } }, { upsert: true, returnDocument: 'after' });
  await Shop.findOneAndUpdate({ owner: user._id }, { $set: { name, city, address, category: process.env.TRIAL_SHOP_CATEGORY || 'Electronics', approved: true } }, { upsert: true, runValidators: true });
  console.log('Shop approved. No demo products or orders were imported.');
}
main().catch(() => { console.error('Shop approval failed. Check the operator settings and account.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
