import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle as SvgCircle } from "react-native-svg";

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

const STROKE_WIDTH = 2.5;

interface CountdownCircleProps {
  /** Current seconds remaining (1..period) */
  remaining: number;
  /** Total period in seconds */
  period: number;
  /** Diameter of the circle in pixels */
  size: number;
  /** Resolved color string for the progress arc */
  progressColor: string;
  /** Resolved color string for the background track */
  trackColor: string;
  /** Content rendered centered inside the circle */
  children: React.ReactNode;
}

export function CountdownCircle({
  remaining,
  period,
  size,
  progressColor,
  trackColor,
  children,
}: CountdownCircleProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const progress = useSharedValue(remaining / period);
  const prevRemaining = useRef(remaining);

  useEffect(() => {
    const isReset = remaining > prevRemaining.current;
    prevRemaining.current = remaining;

    if (isReset) {
      // Period rolled over (e.g. 1 → 30): snap instantly
      progress.value = remaining / period;
    } else {
      // Normal tick: animate smoothly over 1 second
      progress.value = withTiming(remaining / period, {
        duration: 1000,
        easing: Easing.linear,
      });
    }
  }, [remaining, period, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        {/* Background track */}
        <SvgCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Animated progress arc */}
        <AnimatedSvgCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
        />
      </Svg>
      {/* Centered content */}
      <View style={[StyleSheet.absoluteFill, styles.content]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  content: {
    justifyContent: "center",
    alignItems: "center",
  },
});
