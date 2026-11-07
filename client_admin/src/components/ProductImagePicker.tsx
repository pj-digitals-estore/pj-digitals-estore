import {useState} from 'react';
import {Image,Platform,Pressable,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useAppTheme} from '../AppearanceContext';
export type ProductImage={uri:string;asset?:ImagePicker.ImagePickerAsset};
export const MAX_PRODUCT_IMAGES=5;
const MAX_UPLOAD_BYTES=3*1024*1024;
export default function ProductImagePicker({images,onChange,disabled=false}:{images:ProductImage[];onChange:(images:ProductImage[])=>void;disabled?:boolean}){
 const {colors:c}=useAppTheme();const [error,setError]=useState(''),[picking,setPicking]=useState(false);
 async function choose(replaceIndex?:number){
  const replacing=replaceIndex!==undefined;
  if(picking||disabled||(!replacing&&images.length>=MAX_PRODUCT_IMAGES))return;
  setPicking(true);setError('');
  try{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:!replacing,selectionLimit:replacing?1:MAX_PRODUCT_IMAGES-images.length,orderedSelection:!replacing,quality:0.65});
   if(result.canceled)return;
   const selected=replacing?result.assets.slice(0,1):result.assets;
   if(selected.some(asset=>asset.mimeType&&!['image/jpeg','image/png','image/webp'].includes(asset.mimeType))){setError('Choose JPEG, PNG or WebP product images.');return;}
   if(replacing&&selected.some(asset=>images.some((image,index)=>index!==replaceIndex&&image.uri===asset.uri))){setError('That photo is already selected. Choose a different image.');return;}
   const additions=selected.filter((asset,index)=>!selected.slice(0,index).some(other=>other.uri===asset.uri)&&(!images.some(image=>image.uri===asset.uri)||replacing)).map(asset=>({uri:asset.uri,asset}));
   if(!additions.length)return;
   const combined=replacing?images.map((image,index)=>index===replaceIndex?additions[0]:image):[...images,...additions];
   if(combined.length>MAX_PRODUCT_IMAGES){setError('A product can have a maximum of 5 images.');return;}
   const bytes=combined.reduce((sum,image)=>sum+(image.asset?.fileSize??image.asset?.file?.size??0),0);
   if(bytes>MAX_UPLOAD_BYTES){setError('Keep the new images under 3 MB in total. Choose smaller or compressed photos.');return;}
   onChange(combined);
  }catch{setError('Could not choose photos. Please try again.');}finally{setPicking(false);}
 }
 function move(index:number,step:number){
  if(disabled||picking||index+step<0||index+step>=images.length)return;
  const next=[...images];
  [next[index],next[index+step]]=[next[index+step],next[index]];
  onChange(next);
 }
 return <View style={{gap:12,marginVertical:14}}><Text style={{color:c.text,fontWeight:'800'}}>Product images · {images.length} / 5</Text><Text style={{color:c.muted,fontSize:12,lineHeight:18}}>Add, replace or reorder up to five photos. The first image is the cover. New images: 3 MB total.</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{images.map((image,index)=><View key={image.uri} style={{width:126,gap:6,padding:8,borderWidth:1,borderColor:index===0?c.primary:c.border,borderRadius:12,backgroundColor:c.surface}}><Image source={{uri:image.uri}} resizeMode="contain" style={{width:108,height:90,borderRadius:8,backgroundColor:'#FFFFFF'}}/><Text style={{color:index===0?c.primaryText:c.muted,fontSize:11}}>{index===0?'Cover photo':`Image ${index+1}`}</Text>{index>0?<Pressable accessibilityRole="button" accessibilityLabel={`Make image ${index+1} the cover`} disabled={disabled||picking} onPress={()=>onChange([image,...images.filter((_,n)=>n!==index)])} style={{minHeight:34,justifyContent:'center'}}><Text style={{color:c.primaryText,fontSize:12}}>Make cover</Text></Pressable>:null}<Pressable accessibilityRole="button" accessibilityLabel={`Replace image ${index+1}`} disabled={disabled||picking} onPress={()=>void choose(index)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.primaryText,fontSize:12}}>Replace photo</Text></Pressable><View style={{flexDirection:'row',gap:4}}>{([-1,1] as const).map(step=><Pressable key={step} accessibilityRole="button" accessibilityLabel={`Move image ${index+1} ${step<0?'earlier':'later'}`} disabled={disabled||picking||index+step<0||index+step>=images.length} onPress={()=>move(index,step)} style={{minHeight:44,minWidth:48,alignItems:'center',justifyContent:'center',borderRadius:8,backgroundColor:c.soft,opacity:index+step<0||index+step>=images.length?0.35:1}}><Text style={{color:c.primaryText,fontSize:18}}>{step<0?'←':'→'}</Text></Pressable>)}</View><Pressable accessibilityRole="button" accessibilityLabel={`Remove image ${index+1}`} disabled={disabled||picking} onPress={()=>onChange(images.filter((_,n)=>n!==index))} style={{minHeight:34,justifyContent:'center'}}><Text style={{color:c.red,fontSize:12}}>Remove</Text></Pressable></View>)}</View><Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||picking||images.length===5}} disabled={disabled||picking||images.length===5} onPress={()=>void choose()} style={{minHeight:46,padding:12,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:c.soft,opacity:disabled||images.length===5?0.5:1}}><Text style={{color:c.primaryText,fontWeight:'700'}}>{picking?'Choosing photos…':images.length===5?'5 images selected':images.length?'＋ Add more images':'＋ Add product images'}</Text></Pressable>{error?<Text accessibilityRole="alert" style={{color:c.red,fontSize:12,lineHeight:18}}>{error}</Text>:null}</View>;
}
export function appendProductImages(body:FormData,images:ProductImage[]){
 if(!images.length||images.length>5)throw Error('Choose between 1 and 5 product images.');
 let next=0;const order:string[]=[];
 for(const image of images){if(!image.asset){body.append('existingImages',image.uri);order.push(image.uri);continue;}const asset=image.asset;order.push(`new:${next++}`);if(Platform.OS==='web'){if(!asset.file)throw Error('Please choose the photos again.');body.append('images',asset.file);}else body.append('images',{uri:asset.uri,name:asset.fileName||'product.jpg',type:asset.mimeType||'image/jpeg'} as unknown as Blob);}
 body.append('imageOrder',JSON.stringify(order));
}
