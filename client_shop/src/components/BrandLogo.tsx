import { Image } from 'react-native';

export default function BrandLogo({ size = 48 }: { size?: number }) {
  return <Image source={require('../../assets/images/nearby-logo-original.png')} resizeMode="contain" accessibilityLabel="NearBy logo" style={{ width: size, height: size, flexShrink: 0 }} />;
}
