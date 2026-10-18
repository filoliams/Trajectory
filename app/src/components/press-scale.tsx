import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 320, reduceMotion: ReduceMotion.System };

/** A Pressable that lifts a touch under a mouse, sinks under the finger and springs back. */
export function PressScale({
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const hovered = useSharedValue(false);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onHoverIn={(e) => {
        hovered.value = true;
        scale.value = withSpring(1.015, SPRING);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        hovered.value = false;
        scale.value = withSpring(1, SPRING);
        onHoverOut?.(e);
      }}
      onPressIn={(e) => {
        scale.value = withSpring(0.97, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(hovered.value ? 1.015 : 1, SPRING);
        onPressOut?.(e);
      }}
      style={[style, anim]}
    />
  );
}
