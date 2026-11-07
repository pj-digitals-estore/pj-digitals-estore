import { Platform, View, type ViewProps, type ViewStyle } from 'react-native';

type Props = ViewProps & { colors: readonly [string, string, ...string[]] };

// React Native 0.86 supports gradients directly; web uses the CSS equivalent.
export default function DeliveryGradient({ colors, style, ...props }: Props) {
  const gradient = `linear-gradient(135deg, ${colors.join(', ')})`;
  const background: ViewStyle & { backgroundImage?: string } = Platform.OS === 'web'
    ? { backgroundImage: gradient }
    : { experimental_backgroundImage: gradient };
  return <View {...props} style={[{ backgroundColor: colors[0] }, style, background]} />;
}
