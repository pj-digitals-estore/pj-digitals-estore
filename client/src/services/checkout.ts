import {apiRequest,getBaseURL} from '../lib/api';
import type {GetSessionToken} from './cart';
import type {DeliveryAddress} from '../features/storefront/components/AddressBook';
export async function checkoutConfig(){const r=await apiRequest('/api/payments/config',{cache:'no-store'});const b=await r.json();return {enabled:b.enabled===true,mode:b.mode==='live'?'live':'test'};}
export async function startCheckout(getToken:GetSessionToken,key:string,address?:DeliveryAddress,orderId?:string):Promise<{url?:string;id:string;paid:boolean}>{
 const token=await getToken();if(!token)throw Error('Sign in before paying.');
 if(!orderId&&!address)throw Error('Select a delivery address.');
 const body=orderId?{}:{checkoutKey:key,shippingAddress:{name:address!.name,phone:address!.phone,street:address!.address,city:address!.location.split(',')[0],state:'Kerala',zipCode:address!.pincode,country:'India'}};
 const response=await apiRequest(orderId?`/api/orders/${encodeURIComponent(orderId)}/checkout`:'/api/orders',{method:'POST',timeoutMs:45000,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
 const result=await response.json();if(!result.success||!result.data?._id)throw Error('Checkout was not confirmed. Check My orders before trying again.');
 if(result.data.paymentStatus==='paid')return {id:result.data._id,paid:true};
 if(typeof result.checkoutUrl!=='string')throw Error('Payment page not available. Check My orders.');
 const url=new URL(result.checkoutUrl);if(url.protocol!=='https:'||url.origin!==new URL(getBaseURL()).origin||!/^\/api\/payments\/checkout\/[a-f0-9]{64}$/.test(url.pathname))throw Error('Unexpected payment address. Check the configured server origin.');
 return {url:url.href,id:result.data._id,paid:false};
}

export async function cancelCheckout(id:string,getToken:GetSessionToken){const token=await getToken();if(!token)throw Error('Sign in again.');const r=await apiRequest('/api/orders/'+encodeURIComponent(id)+'/cancel',{method:'POST',timeoutMs:30000,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});const b=await r.json();if(!b.success)throw Error(b.message||'Cancellation not confirmed.');}

// COD uses the orders API directly. Payment config applies only to Razorpay.
export async function placeCashOnDeliveryOrder(getToken:GetSessionToken,key:string,address:DeliveryAddress):Promise<string>{
 const token=await getToken();if(!token)throw Error('Sign in before placing your order.');
 const response=await apiRequest('/api/orders',{method:'POST',timeoutMs:45000,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({checkoutKey:key,paymentMethod:'cod',shippingAddress:{name:address.name,phone:address.phone,street:address.address,city:address.location.split(',')[0],state:'Kerala',zipCode:address.pincode,country:'India'}})});
 const body=await response.json();const order=body.data;
 if(body.success!==true||typeof order?._id!=='string'||!order._id)throw Error('Cash on Delivery was not confirmed. Check My orders before trying again.');
 const confirmation=await apiRequest(`/api/orders/${encodeURIComponent(order._id)}`,{cache:'no-store',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
 const confirmedBody=await confirmation.json();const confirmed=confirmedBody.data;
 if(confirmedBody.success!==true||confirmed?._id!==order._id||!['cod','cash_on_delivery'].includes(confirmed.paymentMethod)||!['placed','confirmed','processing','shipping','shipped','dispatched','delivered'].includes(confirmed.orderStatus)||!['pending','unpaid','due','paid'].includes(confirmed.paymentStatus))throw Error('Cash on Delivery was not confirmed. Check My orders before trying again.');
 return confirmed._id;
}
