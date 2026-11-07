import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Shop from '../models/Shop.js';
async function main(){if(!process.env.MONGODB_URI)throw Error('MONGODB_URI required');await mongoose.connect(process.env.MONGODB_URI);await Promise.all([Order.init(),Cart.init(),Shop.init()]);console.log('Trial indexes are ready. No records were reset or imported.');}
main().catch(()=>{console.error('Index preparation failed. Check existing records for conflicts before deploying.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
