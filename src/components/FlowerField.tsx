import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { Flower } from './Flower';
import { type FlowerType, flowerTypes } from './flowerData';
import { PetalBurst } from './PetalBurst';

const FLOWER_TYPE_NAMES: FlowerType[] = ['rose', 'tulip', 'daisy', 'sunflower'];
const MAX_CONCURRENT_BURSTS = 6;

interface FlowerItem {
  id: string;
  type: FlowerType;
  size: number;
  position: {
    x: number; // Percentage (0.0 to 1.0)
    y: number; // Percentage (0.0 to 1.0)
  };
  color?: string;
}

interface BurstItem {
  id: string;
  x: number;
  y: number;
  color: string;
  type: FlowerType;
}

interface FlowerFieldProps {
  count?: number;
  isPremium?: boolean;
  onAddFlower?: () => void;
  maxFlowers?: number;
  rightOffset?: number;
  style?: any;
}

/**
 * FlowerField Component
 * Renders a field of flowers with ability to add more
 */
export const FlowerField = ({
  count = 5,
  isPremium = false,
  onAddFlower,
  maxFlowers = 20,
  rightOffset = 0,
  style,
}: FlowerFieldProps) => {
  const { width, height } = useWindowDimensions();
  const theme = useThemeColors();
  const scheme = useColorScheme();

  // State to track flowers and layout dimensions
  const [flowers, setFlowers] = useState<FlowerItem[]>([]);
  const [bursts, setBursts] = useState<BurstItem[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: any) => {
    const { width: layoutWidth, height: layoutHeight } =
      event.nativeEvent.layout;
    setDimensions({ width: layoutWidth, height: layoutHeight });
  }, []);

  const isWide = width >= 768;
  const fallbackWidth = isWide ? width - 410 : width - 32;
  const fallbackHeight = isWide ? height - 40 : height - 250;

  const activeWidth = dimensions.width || fallbackWidth;
  const activeHeight = dimensions.height || fallbackHeight;

  // Create a random flower with relative coordinates
  const createRandomFlower = useCallback(
    (
      x?: number,
      y?: number,
      containerWidth?: number,
      containerHeight?: number,
    ): FlowerItem => {
      let rx: number;
      let ry: number;

      if (
        x !== undefined &&
        y !== undefined &&
        containerWidth &&
        containerHeight
      ) {
        rx = x / containerWidth;
        ry = y / containerHeight;
      } else {
        // Choose a random percentage within bounds so they don't clip outside viewports
        rx = Math.random() * 0.8 + 0.1;
        ry = Math.random() * 0.7 + 0.15;
      }

      return {
        id: Math.random().toString(),
        type: FLOWER_TYPE_NAMES[
          Math.floor(Math.random() * FLOWER_TYPE_NAMES.length)
        ],
        size: Math.random() * 30 + 45, // Size between 45-75
        position: { x: rx, y: ry },
        color: isPremium
          ? `hsl(${Math.random() * 360}, ${60 + Math.random() * 20}%, ${50 + Math.random() * 20}%)`
          : undefined,
      };
    },
    [isPremium],
  );

  // Generate initial flowers
  useEffect(() => {
    const initialFlowers: FlowerItem[] = [];
    const initialCount = Math.min(count, maxFlowers);

    for (let i = 0; i < initialCount; i++) {
      initialFlowers.push(createRandomFlower());
    }

    setFlowers(initialFlowers);
  }, [count, maxFlowers, createRandomFlower]);

  // Add a new flower when the user taps the screen
  const addFlower = useCallback(
    (x: number, y: number) => {
      const newFlower = createRandomFlower(x, y, activeWidth, activeHeight);
      const burstColor =
        newFlower.color ?? flowerTypes[newFlower.type].defaultColor;
      const burst: BurstItem = {
        id: `burst-${newFlower.id}`,
        x,
        y,
        color: burstColor,
        type: newFlower.type,
      };
      const atCap = flowers.length >= maxFlowers;

      if (atCap) {
        setFlowers((prev) => [...prev.slice(1), newFlower]);
      } else {
        setFlowers((prev) => [...prev, newFlower]);
      }

      setBursts((prev) =>
        prev.length >= MAX_CONCURRENT_BURSTS
          ? [...prev.slice(1), burst]
          : [...prev, burst],
      );

      if (!atCap) {
        if (onAddFlower) {
          onAddFlower();
        }
      }
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [
      flowers,
      maxFlowers,
      onAddFlower,
      createRandomFlower,
      activeWidth,
      activeHeight,
    ],
  );

  // Handle taps on the background
  const handleBackgroundPress = (event: any) => {
    if (Platform.OS === 'web') {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.nativeEvent.clientX - rect.left;
      const y = event.nativeEvent.clientY - rect.top;
      addFlower(x, y);
    } else {
      const { locationX, locationY } = event.nativeEvent;
      addFlower(locationX, locationY);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleBackgroundPress}>
      <View
        testID="flower-field"
        style={[styles.container, style]}
        onLayout={onLayout}
      >
        <LinearGradient
          colors={[theme.backgroundStart, theme.backgroundEnd]}
          style={styles.sandbox}
        />

        {/* Sandbox Inner Frame (Dashed Soil border) */}
        <View
          style={[
            styles.sandboxInnerFrame,
            {
              borderColor:
                scheme === 'dark'
                  ? 'rgba(255, 255, 255, 0.15)'
                  : 'rgba(140, 122, 107, 0.35)',
            },
          ]}
          pointerEvents="none"
        />

        {/* Sandbox Instruction Label */}
        <View
          style={[
            styles.sandboxLabel,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[styles.sandboxLabelText, { color: theme.textSecondary }]}
          >
            🌸 Tap sandbox to plant flowers
          </Text>
        </View>

        {flowers.map((flower) => (
          <Flower
            key={flower.id}
            type={flower.type}
            size={flower.size}
            position={{
              x: flower.position.x * activeWidth,
              y: flower.position.y * activeHeight,
            }}
            color={flower.color}
            isPremium={isPremium}
            onPress={() => {
              // Make the flower "bloom" when tapped
              // This is handled inside the Flower component
            }}
          />
        ))}

        {bursts.map((burst) => (
          <PetalBurst
            key={burst.id}
            x={burst.x}
            y={burst.y}
            color={burst.color}
            type={burst.type}
            onComplete={() =>
              setBursts((prev) => prev.filter((b) => b.id !== burst.id))
            }
          />
        ))}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  sandbox: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  sandboxLabel: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sandboxLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  sandboxInnerFrame: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(140, 122, 107, 0.35)',
    borderRadius: 16,
  },
});
