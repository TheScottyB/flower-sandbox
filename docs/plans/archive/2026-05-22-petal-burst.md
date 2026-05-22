# Petal-burst Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When the user taps the sandbox to plant a flower, emit a short radial burst of 8 small petals from the tap point, tinted to match the flower's color.

**Architecture:** Add one new component (`PetalBurst.tsx`) that renders 8 absolutely-positioned animated SVG petals using `react-native-reanimated` shared values. Modify `FlowerField.tsx` to maintain a parallel `bursts` state array and render one `PetalBurst` per active burst. Bursts self-remove via an `onComplete` callback after ~500 ms. No new dependencies.

**Tech Stack:** TypeScript, React 19, react-native, react-native-reanimated 4, react-native-svg, jest + jest-expo + react-test-renderer.

**Design doc:** `docs/plans/2026-05-22-petal-burst-design.md`

**Skill references:**
- @superpowers:test-driven-development — strict TDD for the new component
- @superpowers:verification-before-completion — required for the manual smoke test

---

## Task 1: Baseline — verify test infrastructure works

**Files:** none (verification only)

**Step 1: Run the existing test command and confirm it succeeds with no tests**

Run: `pnpm test`

Expected output (jest with `--passWithNoTests`):
```
No tests found, exiting with code 0
...
Tests:       0 total
```
or similar success. Exit code 0.

**If this fails:** stop and investigate — the test infrastructure is broken and Task 2 cannot proceed. Likely fixes: `pnpm install`, check `jest-expo` version compatibility with the installed Expo SDK 56.

**Step 2: Commit nothing (verification only)**

---

## Task 2: Create `PetalBurst` component (TDD)

**Files:**
- Create: `src/components/PetalBurst.tsx`
- Create: `src/components/__tests__/PetalBurst.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/PetalBurst.test.tsx` with the following content:

```tsx
import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { PetalBurst } from '../PetalBurst';

describe('PetalBurst', () => {
  it('renders 8 SVG Path particles, each tinted with the given color', () => {
    const tree = TestRenderer.create(
      <PetalBurst x={50} y={50} color="#FF0000" type="rose" onComplete={jest.fn()} />
    );
    const paths = tree.root.findAllByType(Path);
    expect(paths).toHaveLength(8);
    paths.forEach((p) => {
      expect(p.props.fill).toBe('#FF0000');
    });
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/__tests__/PetalBurst.test.tsx`

Expected: FAIL with `Cannot find module '../PetalBurst'` (or equivalent module-not-found error).

**Step 3: Write the minimal `PetalBurst` implementation**

Create `src/components/PetalBurst.tsx` with the following content:

```tsx
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
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

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: params.duration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      }
    );
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
```

**Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/__tests__/PetalBurst.test.tsx`

Expected: PASS — one test, "renders 8 SVG Path particles, each tinted with the given color".

**If it fails:** check that `react-native-svg` `Path` is correctly imported in both files, and that `flowerTypes['rose']` has at least one petal. If `findAllByType(Path)` returns more than 8 (e.g., if `Svg` internally renders extra `Path` nodes), narrow the query — but `react-native-svg`'s test renderer output should be one `Path` per particle as written.

**Step 5: Type-check**

Run: `pnpm typecheck`

Expected: exit code 0, no errors.

**Step 6: Commit**

```bash
git add src/components/PetalBurst.tsx src/components/__tests__/PetalBurst.test.tsx
git commit -m "feat(flowers): add PetalBurst component (8-particle radial burst)"
```

---

## Task 3: Wire `PetalBurst` into `FlowerField`

**Files:**
- Modify: `src/components/FlowerField.tsx`

**Step 1: Read the current file**

Open `src/components/FlowerField.tsx` and confirm the structure matches what's referenced below (the design assumes the current state of the file, where `addFlower` updates `setFlowers` and calls `onAddFlower` + `Haptics`).

**Step 2: Add the `bursts` state and import**

In `src/components/FlowerField.tsx`:

1. Add import at the top, near the existing `Flower` import:
   ```tsx
   import { PetalBurst } from './PetalBurst';
   ```
2. Add a `BurstItem` type next to `FlowerItem`:
   ```tsx
   interface BurstItem {
     id: string;
     x: number;
     y: number;
     color: string;
     type: FlowerType;
   }
   ```
3. Add a parallel state inside the component, next to `const [flowers, setFlowers] = useState<FlowerItem[]>([]);`:
   ```tsx
   const [bursts, setBursts] = useState<BurstItem[]>([]);
   ```

**Step 3: Spawn a burst from `addFlower`**

Refactor `addFlower` so the new flower is created once, its resolved color is reused, and a matching burst is appended. Replace the entire `addFlower` function with:

```tsx
const addFlower = useCallback((x: number, y: number) => {
  const newFlower = createRandomFlower(x, y);
  const burstColor = newFlower.color ?? flowerTypes[newFlower.type].defaultColor;
  const burst: BurstItem = {
    id: `burst-${newFlower.id}`,
    x,
    y,
    color: burstColor,
    type: newFlower.type,
  };

  if (flowers.length >= maxFlowers) {
    setFlowers((prev) => [...prev.slice(1), newFlower]);
  } else {
    setFlowers((prev) => [...prev, newFlower]);
  }

  setBursts((prev) => (prev.length >= 6 ? [...prev.slice(1), burst] : [...prev, burst]));

  if (onAddFlower) {
    onAddFlower();
  }
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}, [flowers, isPremium, maxFlowers, onAddFlower]);
```

You'll also need to import `flowerTypes` from `./flowerData` (it's currently only `FlowerType` that's imported):

```tsx
import { flowerTypes, FlowerType } from './flowerData';
```

**Step 4: Render the bursts**

In the JSX returned by `FlowerField`, add the burst layer right after the `{flowers.map(...)}` block, still inside the container `<View>`:

```tsx
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
```

**Step 5: Run all tests**

Run: `pnpm test`

Expected: PASS, 1 test (the `PetalBurst` structural test from Task 2). No new test required here — `FlowerField` wiring is verified by the manual smoke test in Task 4. Adding a behavioral test would require `@testing-library/react-native` (new dep) and would mostly assert orchestration that the smoke test catches more meaningfully.

**Step 6: Type-check**

Run: `pnpm typecheck`

Expected: exit code 0. If `flowerTypes` is not exported from `./flowerData`, add an `export` in front of its declaration in `src/components/flowerData.ts` — it's used at runtime so the export is required.

**Step 7: Commit**

```bash
git add src/components/FlowerField.tsx src/components/flowerData.ts
git commit -m "feat(flowers): emit a petal burst on each plant"
```

---

## Task 4: Manual cross-platform smoke test

**Files:** none (verification only)

This task is the **real** acceptance gate for the feature. Visual effects can't be unit-tested meaningfully. Required by @superpowers:verification-before-completion before marking the feature done.

**Step 1: Start the dev server**

Run: `pnpm run dev`

Wait for the QR code / Metro banner. Leave this running.

**Step 2: iOS simulator smoke test**

1. Press `i` in the Metro terminal to launch iOS simulator.
2. Wait for the app to load to the Home tab.
3. Tap 20 distinct locations in the visible sandbox area (the top half of the screen, above the BlurView card).

Verify all of the following:
- [ ] A petal burst appears at each tap location, fanning outward
- [ ] The burst color matches the flower's color (sunflower → yellow burst, etc.)
- [ ] The burst lasts roughly half a second and fully disappears
- [ ] No visible frame drops during the burst
- [ ] No red box errors / console warnings in Metro
- [ ] The flower counter at the bottom still increments (existing behavior preserved)
- [ ] The swaying animation on existing flowers still runs (existing behavior preserved)

**Step 3: Android emulator smoke test**

1. Press `a` in the Metro terminal to launch Android emulator.
2. Repeat the same 20-tap verification.
3. Check the same 7 items above on Android.

**Step 4: Web smoke test**

1. Press `w` in the Metro terminal to launch web.
2. Repeat with mouse clicks instead of taps (20 distinct locations).
3. Check the same 7 items above on web. Special attention: SVG path rendering on react-native-web is occasionally subtly different — confirm the particles are visible and tinted, not transparent.

**Step 5: Subscribe state smoke test (premium burst colors)**

If a test Stripe subscription is available:
1. Sign in, subscribe (or temporarily set `isPremium={true}` in `app/(tabs)/index.tsx:140` for the test).
2. Tap 10 times.
3. Verify bursts use the same premium HSL colors as the flowers (each burst tinted differently from its neighbors).
4. Revert any temporary override.

**Step 6: Report verification results**

If all checks pass, report:
> Verified on iOS, Android, and web. All 7 acceptance criteria met. Premium burst colors also verified.

If anything fails, **do not mark the task complete**. Report the specific failure with the platform and which check failed, and return to the relevant earlier task to fix it.

**Step 7: Commit (if any fixes were needed during verification)**

If verification surfaced any small fixes, commit them with a descriptive message before declaring done. If no fixes were needed, no commit is required.

---

## Done means

- `pnpm test` passes (1 test, the PetalBurst structural test)
- `pnpm typecheck` exits clean
- Manual smoke test from Task 4 passes all 7 checks on iOS, Android, and web
- Three new files exist: `src/components/PetalBurst.tsx`, `src/components/__tests__/PetalBurst.test.tsx`, and the modified `src/components/FlowerField.tsx`
- Two commits land: the `feat(flowers): add PetalBurst component` commit and the `feat(flowers): emit a petal burst on each plant` commit
- Design doc at `docs/plans/2026-05-22-petal-burst-design.md` is referenced from both commits (mention in the commit body if you want)
