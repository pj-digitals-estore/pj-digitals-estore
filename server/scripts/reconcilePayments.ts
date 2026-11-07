import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { reconcileOrderPayment } from '../services/payments.js';
async function main(){if(!process.env.MONGODB_URI)throw Error('MONGODB_URI required.');await mongoose.connect(process.env.MONGODB_URI);const orders=await Order.find({paymentStatus:'pending',razorpayOrderId:{$exists:true}}).limit(100);let checked=0;for(const order of orders){await reconcileOrderPayment(order);checked++;}console.log(`Verified ${checked} pending orders against Razorpay. No payment was initiated.`);}
main().catch(()=>{console.error('Reconciliation could not complete. Check provider settings and try again.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
