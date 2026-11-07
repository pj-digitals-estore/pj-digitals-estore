import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from './AppText';
import ProductPhoto from './ProductPhoto';
import { useStoreTheme } from '../ThemeContext';
import type { Product } from '../data/types';
import type { createStyles } from '../styles/appStyles';
import type { createWebStyles } from '../styles/webStyles';

type Props = {product:Product;styles:ReturnType<typeof createStyles>|ReturnType<typeof createWebStyles>};
export default function ProductGallery({product,styles}:Props){
 const {palette:p}=useStoreTheme();const {width}=useWindowDimensions();
 const images=[...new Set(product.images?.filter(Boolean)||[])].slice(0,5);
 const [selected,setSelected]=useState(0),[expanded,setExpanded]=useState(false);
 const index=Math.min(selected,Math.max(0,images.length-1));
 const shown={...product,images:images.length?[images[index]]:product.images};
 const move=(step:number)=>setSelected((index+step+images.length)%images.length);
 const thumbs=<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingVertical:12,alignItems:'center'}}>{images.map((uri,n)=><Pressable key={uri} accessibilityRole="button" accessibilityLabel={`View image ${n+1} of ${images.length}`} accessibilityState={{selected:n===index}} onPress={()=>setSelected(n)} style={{width:64,height:64,padding:3,borderRadius:12,borderWidth:2,borderColor:n===index?p.primary:p.border,backgroundColor:'#FFFFFF'}}><Image source={{uri}} resizeMode="contain" style={{width:'100%',height:'100%',borderRadius:8}}/></Pressable>)}</ScrollView>;
 return <View style={{width:'100%',maxWidth:700,alignSelf:'center'}}>
  <Pressable accessibilityRole="button" accessibilityLabel={`Enlarge ${product.name} image ${index+1}`} onPress={()=>setExpanded(true)} style={styles.detailArt}><ProductPhoto key={images[index]||product.id} product={shown}/></Pressable>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingTop:10}}><Text style={{color:p.muted,fontSize:12}}>{images.length?`${index+1} / ${images.length}`:'Product image'}</Text><Pressable accessibilityRole="button" onPress={()=>setExpanded(true)} style={{minHeight:36,justifyContent:'center'}}><Text style={{color:p.primaryText,fontSize:12,fontWeight:'700'}}>View larger ↗</Text></Pressable></View>
  {images.length>1?thumbs:null}
  <Modal visible={expanded} transparent animationType="fade" onRequestClose={()=>setExpanded(false)}><SafeAreaView style={{flex:1,backgroundColor:p.background}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:16,padding:18}}><Text numberOfLines={2} style={{color:p.text,fontSize:18,fontWeight:'800',flex:1}}>{product.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={()=>setExpanded(false)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><Text style={{color:p.text,fontSize:28}}>×</Text></Pressable></View><View style={{flex:1,padding:16}}><ProductPhoto key={images[index]||product.id} product={shown}/></View><View style={{alignSelf:'center',width:Math.min(width-32,700),padding:16,gap:6}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Pressable accessibilityRole="button" accessibilityLabel="Previous image" disabled={images.length<2} onPress={()=>move(-1)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:p.soft,opacity:images.length<2?0.35:1}}><Text style={{color:p.primaryText,fontSize:24}}>‹</Text></Pressable><Text style={{color:p.text}}>{index+1} / {Math.max(images.length,1)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next image" disabled={images.length<2} onPress={()=>move(1)} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:p.soft,opacity:images.length<2?0.35:1}}><Text style={{color:p.primaryText,fontSize:24}}>›</Text></Pressable></View>{images.length>1?thumbs:null}</View></SafeAreaView></Modal>
 </View>;
}
