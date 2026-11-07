import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {createOrder} from '../controllers/ordersController.js';
import {confirmCapturedPayment} from '../services/payments.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import Product from '../models/Products.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';

let database:MongoMemoryReplSet;let buyer:any,shop:any,remote=0;const originalFetch=globalThis.fetch;
const address={name:'Trial buyer',phone:'9876543210',street:'Test house',city:'Muttom',state:'Kerala',zipCode:'685587',country:'India'};
function response(){return {code:200,body:undefined as any,status(n:number){this.code=n;return this;},json(b:any){this.body=b;return this;}};}
async function checkout(user:any,key:string){const res=response();await createOrder({user,body:{shippingAddress:address,checkoutKey:key}} as any,res as any);return res;}
async function item(stock=5){return Product.create({name:'Isolated test item',description:'Not a live product',price:100,stock,images:['https://example.invalid/image.jpg'],sizes:['M','L'],category:'Textiles',shop:shop._id});}
async function cart(user:any,products:{product:any;quantity:number;size?:string}[]){await Cart.deleteOne({user:user._id});return Cart.create({user:user._id,items:products.map(i=>({...i,price:100})),totalAmount:products.reduce((n,i)=>n+i.quantity*100,0)});}
before(async()=>{
 process.env.ENABLE_CHECKOUT='true';process.env.RAZORPAY_KEY_ID='rzp_test_isolated';process.env.RAZORPAY_KEY_SECRET='fake';process.env.RAZORPAY_WEBHOOK_SECRET='fake';process.env.PUBLIC_API_ORIGIN='https://example.invalid';
 globalThis.fetch=async(input:any,options:any)=>{
  const path=String(input);if(path.endsWith('/orders')){const b=JSON.parse(options.body);return {ok:true,json:async()=>({id:'order_test'+(++remote),amount:b.amount,currency:'INR'})} as any;}
  if(path.includes('/payments/')){const order=await Order.findOne({paymentStatus:'pending',orderStatus:'awaiting_payment'}).sort('-createdAt');return {ok:true,json:async()=>({id:'pay_test'+remote,order_id:order!.razorpayOrderId,status:'captured',amount:Math.round(order!.totalAmount*100),currency:'INR'})} as any;}
  throw Error('Unexpected external request in isolated tests');
 };
 database=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'},binary:{downloadDir:process.env.MONGOMS_DOWNLOAD_DIR}});
 const uri=database.getUri();assert.match(uri,/127\.0\.0\.1/);await mongoose.connect(uri);
 await Promise.all([User.init(),Shop.init(),Product.init(),Cart.init(),Order.init()]);
 const owner=await User.create({name:'Test owner',email:'owner@test.invalid',clerkId:'testowner',role:'shop'});
 shop=await Shop.create({owner:owner._id,name:'Isolated shop',city:'Muttom',address:'Test road',category:'Textiles',approved:true});
 buyer=await User.create({name:'Test buyer',email:'buyer@test.invalid',clerkId:'testbuyer'});
}, {timeout:180000});
after(async()=>{globalThis.fetch=originalFetch;await mongoose.disconnect();await database?.stop();});
test('same checkout request reserves stock once and returns the same order',async()=>{const p=await item(5);await cart(buyer,[{product:p._id,quantity:2,size:'M'}]);const first=await checkout(buyer,'test_idempotency_001');assert.equal(first.code,201,JSON.stringify(first.body));const second=await checkout(buyer,'test_idempotency_001');assert.equal(second.code,201,JSON.stringify(second.body));assert.equal(String(first.body.data._id),String(second.body.data._id));assert.equal((await Product.findById(p._id))!.stock,3);assert.equal(await Order.countDocuments({checkoutKey:'test_idempotency_001'}),1);await Order.updateOne({_id:first.body.data._id},{$set:{paymentStatus:'failed'}});});
test('unavailable second cart item rolls back the first stock change',async()=>{const a=await item(3),b=await item(0);await cart(buyer,[{product:a._id,quantity:1,size:'M'},{product:b._id,quantity:1,size:'M'}]);const result=await checkout(buyer,'test_rollback_0001');assert.equal(result.code,409,JSON.stringify(result.body));assert.equal((await Product.findById(a._id))!.stock,3);assert.equal(await Order.countDocuments({checkoutKey:'test_rollback_0001'}),0);});
test('two customers cannot buy the same last unit',async()=>{const p=await item(1);const other=await User.create({email:'other@test.invalid',clerkId:'testother'});await cart(buyer,[{product:p._id,quantity:1,size:'M'}]);await cart(other,[{product:p._id,quantity:1,size:'M'}]);const results=await Promise.all([checkout(buyer,'test_lastunit_001'),checkout(other,'test_lastunit_002')]);assert.deepEqual(results.map(r=>r.code).sort(),[201,409],JSON.stringify(results.map(r=>r.body)));assert.equal((await Product.findById(p._id))!.stock,0);await Order.updateMany({checkoutKey:{$in:['test_lastunit_001','test_lastunit_002']}},{$set:{paymentStatus:'failed'}});});
test('captured payment confirms once and preserves items added after checkout',async()=>{const p=await item(5);await cart(buyer,[{product:p._id,quantity:1,size:'M'}]);const result=await checkout(buyer,'test_captured_001');assert.equal(result.code,201,JSON.stringify(result.body));await Cart.updateOne({user:buyer._id},{$set:{'items.0.quantity':3,totalAmount:300}});await confirmCapturedPayment('pay_test'+remote);const paid=await Order.findById(result.body.data._id);assert.equal(paid!.paymentStatus,'paid');assert.equal(paid!.orderStatus,'placed');assert.equal(paid!.items[0].price,100);assert.equal(paid!.items[0].quantity,1);assert.equal((await Cart.findOne({user:buyer._id}))!.items[0].quantity,2);});
import express from 'express';
import {once} from 'node:events';
import {ShopRouter} from '../routes/shopRoutes.js';
import {cancelUnpaidOrder} from '../controllers/ordersController.js';

test('shop endpoints enforce ownership and reject stale stock versions',async()=>{
 const ownProduct=await item(7);const owner2=await User.create({email:'owner2@test.invalid',clerkId:'testowner2',role:'shop'});await Shop.create({owner:owner2._id,name:'Second test shop',city:'Muttom',address:'Test road',category:'Electronics',approved:true});
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.auth=()=>({userId:String(req.headers['x-test-clerk'])});next();});app.use('/api/shops',ShopRouter);const server=app.listen(0,'127.0.0.1');await once(server,'listening');const endpoint='http://127.0.0.1:'+(server.address() as any).port+'/api/shops';
 try{
  let r=await originalFetch(endpoint+'/products',{headers:{'x-test-clerk':'testbuyer'}});assert.equal(r.status,403);
  r=await originalFetch(endpoint+'/products/'+String(ownProduct._id)+'/stock',{method:'PUT',headers:{'x-test-clerk':'testowner2','Content-Type':'application/json'},body:JSON.stringify({stock:99,version:0})});assert.equal(r.status,404);assert.equal((await Product.findById(ownProduct._id))!.stock,7);
  r=await originalFetch(endpoint+'/products/'+String(ownProduct._id)+'/stock',{method:'PUT',headers:{'x-test-clerk':'testowner','Content-Type':'application/json'},body:JSON.stringify({stock:8,version:0})});assert.equal(r.status,200,await r.text());
  r=await originalFetch(endpoint+'/products/'+String(ownProduct._id)+'/stock',{method:'PUT',headers:{'x-test-clerk':'testowner','Content-Type':'application/json'},body:JSON.stringify({stock:9,version:0})});assert.equal(r.status,409);assert.equal((await Product.findById(ownProduct._id))!.stock,8);
  const retained=['https://example.invalid/front.jpg','https://example.invalid/back.jpg'];
  await Product.updateOne({_id:ownProduct._id},{$set:{images:retained}});
  r=await originalFetch(endpoint+'/products/'+String(ownProduct._id)+'/images',{method:'PUT',headers:{'x-test-clerk':'testowner','Content-Type':'application/json'},body:JSON.stringify({version:1,existingImages:retained,imageOrder:JSON.stringify([...retained].reverse())})});assert.equal(r.status,200,await r.text());
  const changed=await Product.findById(ownProduct._id);assert.deepEqual([...changed!.images],[...retained].reverse());assert.equal(changed!.stock,8);assert.equal(changed!.price,100);

 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('cancelling an unpaid checkout restores reserved stock once',async()=>{
 const p=await item(4);await cart(buyer,[{product:p._id,quantity:2,size:'M'}]);const created=await checkout(buyer,'test_cancelled_001');assert.equal(created.code,201,JSON.stringify(created.body));const orderId=created.body.data._id;
 globalThis.fetch=async(input:any,options:any)=>String(input).endsWith('/payments')?({ok:true,json:async()=>({items:[]})} as any):originalFetch(input,options);
 let res=response();await cancelUnpaidOrder({params:{id:orderId},user:buyer} as any,res as any);assert.equal(res.code,200,JSON.stringify(res.body));assert.equal((await Product.findById(p._id))!.stock,4);
 res=response();await cancelUnpaidOrder({params:{id:orderId},user:buyer} as any,res as any);assert.equal(res.code,200);assert.equal((await Product.findById(p._id))!.stock,4);
 globalThis.fetch=async()=>({ok:true,json:async()=>({id:'pay_late',order_id:created.body.data.razorpayOrderId,status:'captured',currency:'INR',amount:Math.round(created.body.data.totalAmount*100)})} as any);
 await confirmCapturedPayment('pay_late');const late=await Order.findById(orderId);assert.equal(late!.orderStatus,'cancelled');assert.equal(late!.manualReview,true);assert.equal(late!.paymentStatus,'paid');assert.equal((await Product.findById(p._id))!.stock,4);
});
