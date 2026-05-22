import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';
import Svg, { Path, G } from 'react-native-svg';
import { flowerTypes, FlowerType } from './flowerData';
import * as Haptics from 'expo-haptics';

const AnimatedG = Animated.createAnimatedComponent(G) as any;

type FlowerProps = {
  id?: string;
  type?: FlowerType;
  size?: number;
  color?: string;
  position?: { x: number, y: number };
  onPress?: () => void;
  isPremium?: boolean;
};

/**
 * Animated Flower Component
 * Renders a flower SVG with animations
 */
export const Flower = React.memo(({ 
  type = 'daisy',
  size = 60,
  color,
  position,
  onPress,
  isPremium = false
}: FlowerProps) => {
  // Animation values
  const rotation = useSharedValue(0);
  const swayRotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const petalScale = useSharedValue(1);
  
  // Initialize flower with animations
  useEffect(() => {
    // Start with growing animation
    scale.value = withSpring(1, { 
      damping: 12, 
      stiffness: 100,
      mass: 1
    });
    
    // Add subtle perpetual swaying movement
    swayRotation.value = withRepeat(
      withTiming(0.05, { 
        duration: 2000 + Math.random() * 1000, 
        easing: Easing.inOut(Easing.sin) 
      }), 
      -1, 
      true
    );
    
    // Add a bit of random rotation to each flower
    rotation.value = (Math.random() * 0.3) - 0.15;
    
  }, []);
  
  // Handle tap on flower
  const handlePress = () => {
    if (onPress) {
      onPress();
    }
    
    // Bloom animation
    petalScale.value = withSpring(1.15, {
      damping: 4,
      stiffness: 80,
    });
    
    // Then return to normal
    petalScale.value = withDelay(
      300, 
      withSpring(1, {
        damping: 10,
        stiffness: 100,
      })
    );
    
    // Add haptic feedback for real devices
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  // Animated styles for the container
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}rad` }
      ]
    };
  });
  
  // Animated styles for the flower itself
  const flowerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${swayRotation.value}rad` }
      ]
    };
  });
  
  // Animated styles for the petals
  const petalStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: petalScale.value }
      ]
    };
  });
  
  // Get flower shape data
  const flowerData = flowerTypes[type];
  
  // Allow custom colors for premium users
  const flowerColor = color || flowerData.defaultColor;
  
  // Random stem height — computed once per mount so existing flowers
  // don't visibly wiggle when the parent (FlowerField) re-renders.
  const adjustedStem = React.useMemo(() => {
    const stemHeight = 40 + Math.random() * 20;
    return flowerData.stem.replace(
      'M50 100 C50 100, 50 80, 50 60',
      `M50 100 C50 100, 50 ${80 - (stemHeight - 40)}, 50 ${60 - (stemHeight - 40)}`,
    );
  }, [flowerData.stem]);
  
  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      style={[
        styles.container, 
        position && { 
          position: 'absolute', 
          left: position.x - (size / 2), 
          top: position.y - (size / 2) 
        }
      ]}
      onPress={handlePress}
    >
      <Animated.View style={containerStyle}>
        <Animated.View style={flowerStyle}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            {/* Stem */}
            <Path
              d={adjustedStem}
              fill="none"
              stroke="#3A8C3F"
              strokeWidth="4"
            />
            
            {/* Flower petals */}
            <AnimatedG style={petalStyle}>
              <G>
                {flowerData.petals.map((petal, index) => (
                  <Path
                    key={index}
                    d={petal}
                    fill={flowerColor}
                    opacity={isPremium ? 1 : 0.9}
                  />
                ))}
              </G>
            </AnimatedG>
            
            {/* Center */}
            <Path
              d={flowerData.center}
              fill={flowerData.centerColor}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

// Fix for Platform in React Native Web
import { Platform } from 'react-native';