import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flower } from './Flower';
import { PetalBurst } from './PetalBurst';
import { flowerTypes, FlowerType } from './flowerData';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

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
}: FlowerFieldProps) => {
  const { width, height } = useWindowDimensions();

  // State to track flowers
  const [flowers, setFlowers] = useState<FlowerItem[]>([]);
  const [bursts, setBursts] = useState<BurstItem[]>([]);

  // Create a random flower with relative coordinates
  const createRandomFlower = useCallback((x?: number, y?: number, currentWidth: number = width, currentHeight: number = height): FlowerItem => {
    let rx: number;
    let ry: number;
    
    const w = currentWidth > 0 ? currentWidth : 375;
    const h = currentHeight > 0 ? currentHeight : 812;
    const usableWidth = w - rightOffset;

    if (x !== undefined && y !== undefined) {
      rx = x / w;
      ry = y / h;
    } else {
      // Choose a random percentage within bounds so they don't clip outside viewports
      rx = (Math.random() * usableWidth * 0.8 + usableWidth * 0.1) / w;
      ry = Math.random() * 0.6 + 0.15;
    }
    
    return {
      id: Math.random().toString(),
      type: FLOWER_TYPE_NAMES[Math.floor(Math.random() * FLOWER_TYPE_NAMES.length)],
      size: Math.random() * 30 + 45, // Size between 45-75
      position: { x: rx, y: ry },
      color: isPremium 
        ? `hsl(${Math.random() * 360}, ${60 + Math.random() * 20}%, ${50 + Math.random() * 20}%)`
        : undefined
    };
  }, [isPremium]);

  // Generate initial flowers
  useEffect(() => {
    const initialFlowers: FlowerItem[] = [];
    const initialCount = Math.min(count, maxFlowers);
    
    for (let i = 0; i < initialCount; i++) {
      initialFlowers.push(createRandomFlower(undefined, undefined, width, height));
    }
    
    setFlowers(initialFlowers);
  }, [count, maxFlowers, createRandomFlower]);
  
  // Add a new flower when the user taps the screen
  const addFlower = useCallback((x: number, y: number) => {
    const newFlower = createRandomFlower(x, y, width, height);
    const burstColor = newFlower.color ?? flowerTypes[newFlower.type].defaultColor;
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
      prev.length >= MAX_CONCURRENT_BURSTS ? [...prev.slice(1), burst] : [...prev, burst]
    );

    if (!atCap) {
      if (onAddFlower) {
        onAddFlower();
      }
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, [flowers, maxFlowers, onAddFlower, createRandomFlower, width, height]);
  
  // Handle taps on the background
  const handleBackgroundPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    addFlower(locationX, locationY);
  };
  
  return (
    <TouchableWithoutFeedback onPress={handleBackgroundPress}>
      <View style={styles.container}>
        <LinearGradient
          colors={['#FFEBCD', '#FFF8E1']}
          style={styles.sandbox}
        />
        
        {flowers.map(flower => (
          <Flower
            key={flower.id}
            type={flower.type}
            size={flower.size}
            position={{
              x: flower.position.x * width,
              y: flower.position.y * height
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
            onComplete={() => setBursts((prev) => prev.filter((b) => b.id !== burst.id))}
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
});