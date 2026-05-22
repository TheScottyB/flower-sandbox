import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { flowerTypes, FlowerType } from './flowerData';

const PARTICLE_COUNT = 8;
const PARTICLE_SIZE = 18;
const BASE_DURATION_MS = 400;
const DURATION_JITTER_MS = 200;
const MIN_DISTANCE_PX = 40;
const MAX_DISTANCE_PX = 80;
const FINAL_SCALE = 0.3;
const ANGLE_JITTER_RAD = Math.PI / 16;

type PetalBurstProps = {
  x: number;
  y: number;
  color: string;
  type: FlowerType;
  onComplete: () => void;
};

type ParticleParams = {
  angle: number;
  distance: number;
  rotation: number;
  duration: number;
  petalIndex: number;
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const buildParticleParams = (petalCount: number): ParticleParams[] => {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    angle: (i / PARTICLE_COUNT) * Math.PI * 2 + randomBetween(-ANGLE_JITTER_RAD, ANGLE_JITTER_RAD),
    distance: randomBetween(MIN_DISTANCE_PX, MAX_DISTANCE_PX),
    rotation: randomBetween(-Math.PI * 2, Math.PI * 2),
    duration: BASE_DURATION_MS + Math.random() * DURATION_JITTER_MS,
    petalIndex: Math.floor(Math.random() * Math.max(petalCount, 1)),
  }));
};

const Particle = ({
  params,
  color,
  petalPath,
  onDone,
}: {
  params: ParticleParams;
  color: string;
  petalPath: string;
  onDone?: () => void;
}) => {
  const progress = useSharedValue(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: params.duration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && onDoneRef.current) runOnJS(onDoneRef.current)();
      }
    );
    return () => {
      cancelAnimation(progress);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p,
      transform: [
        { translateX: params.distance * Math.cos(params.angle) * p },
        { translateY: params.distance * Math.sin(params.angle) * p },
        { rotate: `${params.rotation * p}rad` },
        { scale: 1 - (1 - FINAL_SCALE) * p },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: PARTICLE_SIZE, height: PARTICLE_SIZE },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Svg width={PARTICLE_SIZE} height={PARTICLE_SIZE} viewBox="0 0 100 100">
        <Path d={petalPath} fill={color} />
      </Svg>
    </Animated.View>
  );
};

export const PetalBurst = ({ x, y, color, type, onComplete }: PetalBurstProps) => {
  const flower = flowerTypes[type];
  const petals = flower?.petals ?? [];
  const paramsRef = useRef<ParticleParams[] | null>(null);
  if (paramsRef.current === null) {
    paramsRef.current = buildParticleParams(petals.length);
  }

  const longestIndex = paramsRef.current.reduce(
    (best, p, i, arr) => (p.duration > arr[best].duration ? i : best),
    0
  );

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { left: x - PARTICLE_SIZE / 2, top: y - PARTICLE_SIZE / 2 }]}
    >
      {paramsRef.current.map((params, i) => (
        <Particle
          key={i}
          params={params}
          color={color}
          petalPath={petals[params.petalIndex] ?? ''}
          onDone={i === longestIndex ? onComplete : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 20,
  },
  particle: {
    position: 'absolute',
  },
});
