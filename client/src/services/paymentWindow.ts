import * as WebBrowser from 'expo-web-browser';
export function preparePaymentWindow() {
 return { open: async(url:string)=>{await WebBrowser.openBrowserAsync(url);}, close:()=>{} };
}
