export function preparePaymentWindow() {
 const tab=window.open('about:blank','_blank');
 if(!tab)throw Error('Allow the payment popup, then try again. No order has been created.');
 tab.opener=null;
 return {open:async(url:string)=>{tab.location.replace(url);},close:()=>tab.close()};
}
