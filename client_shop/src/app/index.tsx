import LiveShopRoot from '../live/LiveShopRoot';
import {Home} from '../screens/ShopScreens';
export default function ShopHome(){return process.env.EXPO_PUBLIC_SHOP_MODE !== 'demo' ? <LiveShopRoot/> : <Home/>;}
