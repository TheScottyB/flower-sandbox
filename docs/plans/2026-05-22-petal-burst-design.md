# Petal-burst design

**Status:** Approved, ready for implementation plan
**Date:** 2026-05-22
**Scope:** Sensory-juice upgrade to the tap-to-plant moment in FlowerField

## Goal

When a user taps the sandbox to plant a flower, emit a short radial burst of small petals from the tap point, tinted to match the flower's color. The whole burst lasts ~500 ms and is one cohesive moment with the existing spring-in flower animation.

Out of scope: persistence, sound, growth animations, ripple/screen flash, discovery/variety, IA changes.

## Architecture

One new component, one modified file. No new dependencies.

```
src/components/
├── FlowerField.tsx        (modified)
├── Flower.tsx             (unchanged)
├── PetalBurst.tsx         (new — owns all particles for one burst)
└── flowerData.ts          (unchanged)
```

## Components

### `PetalBurst.tsx` (new)

Props: `{ x: number, y: number, color: string, type: FlowerType, onComplete: () => void }`.

Renders 8 absolutely-positioned `Animated.View`s, each containing a small SVG petal drawn from `flowerData[type].petals` (random index per particle). On mount, each particle's shared values animate from start to end via `withTiming(..., duration)`, easing `Easing.out(Easing.cubic)`. After the longest animation completes, `onComplete` fires so the parent removes this burst from state.

Per-particle parameters, computed once on mount and stored in `useRef` so they survive re-renders without recomputing:

| Property | Range | Notes |
|---|---|---|
| Angle | `(i / 8) * 2π + jitter(±π/16)` | Evenly distributed around tap, small jitter avoids mechanical look |
| Distance | 40–80 px | Random per particle |
| Rotation | 0 → random in ±360° | Tumbling feel |
| Lifetime | 400 + random(0, 200) ms | Staggered finish |
| Scale | 1.0 → 0.3 | Dissipation read |
| Opacity | 1 → 0 | Cubic-out fade |
| Petal index | random from `flowerData[type].petals` | Same SVG petal family as the flower |

The translation is applied as
`transform: [{ translateX: distance * cos(angle) * progress }, { translateY: distance * sin(angle) * progress }, { rotate: rotation * progress }, { scale: 1 - 0.7 * progress }]`,
where `progress` is a single `useSharedValue` per particle animated `0 → 1` over its lifetime. Opacity is animated independently with the same duration.

### `FlowerField.tsx` (modified)

Adds a parallel state array `bursts: { id: string, x: number, y: number, color: string, type: FlowerType }[]`.

In `addFlower(x, y)`:

1. Pick the flower (existing logic, unchanged)
2. Append a burst with the same `(x, y)`, the flower's resolved color, and its type
3. Call `onAddFlower?.()` (existing)
4. Trigger `Haptics.impactAsync(Medium)` (existing)

Render order in the container:

```
<TouchableWithoutFeedback>
  <View>
    <LinearGradient />            (existing background)
    {flowers.map(<Flower />)}     (existing)
    {bursts.map(<PetalBurst />)}  (new — above flowers, below the BlurView card)
  </View>
</TouchableWithoutFeedback>
```

The BlurView content card in `app/(tabs)/index.tsx` already sits on top via its own `<ScrollView>` — burst stays under it as desired.

### `flowerData.ts` (unchanged)

PetalBurst imports the existing `flowerTypes` map and reuses its `petals: string[]` paths. No changes needed.

## Data flow

```
TouchableWithoutFeedback.onPress
  → handleBackgroundPress(event)
  → addFlower(locationX, locationY)
      ├─ setFlowers(...)                       (existing)
      ├─ setBursts(prev => [...prev, burst])   (new)
      ├─ onAddFlower?.()                        (existing — increments counter in parent)
      └─ Haptics.impactAsync(Medium)            (existing)

PetalBurst (mounted)
  → 8 particles animate 400–600 ms on UI thread (Reanimated)
  → onComplete → setBursts(prev => prev.filter(b => b.id !== this.id))
```

Bursts and flowers are independent: at max-capacity, the oldest flower is replaced silently (existing FIFO behavior) but the burst still fires at the tap point.

## Color cohesion

The burst inherits the flower's resolved color:

- Free flower → `flowerData[type].defaultColor`
- Premium flower → the HSL value generated for that specific flower

Yellow sunflower → yellow burst. Pink rose → pink burst. Premium teal flower → teal burst. No separate tinting logic.

## Edge cases

| Case | Behavior |
|---|---|
| Rapid taps (5+ in 1s) | Independent bursts spawn in parallel. **Cap**: if `bursts.length > 6`, drop the oldest before appending (defensive). |
| Plant at max flowers | Oldest flower replaced silently (existing). Burst still fires for the new flower at the tap point. |
| Tap behind the bottom content card | The BlurView already eats those taps via the ScrollView layer — no change. Burst only fires when a flower lands. |
| Web | `event.nativeEvent.locationX/Y` and Reanimated 3 both work on web. Will verify SVG path rendering in smoke test. |
| Component unmounts mid-burst | Reanimated shared values are GC'd with the component. `onComplete` simply never fires — no leak, no error. |
| `onAddFlower` throws | Existing behavior; not affected. |

## Performance budget

- Steady state: 0 particles.
- One burst: 8 `Animated.View` + 8 SVG `Path`, UI-thread animated. Negligible.
- Stress: 50 taps over 5 s → ≤6 concurrent bursts × 8 = ~48 animated views peak. Target 60fps on iPhone 12 / equivalent Android. Web: 60fps modern browsers.

## Verification

1. **Static snapshot test (Jest)** — render `<PetalBurst x={50} y={50} color="#FF0000" type="rose" onComplete={jest.fn()} />` and assert 8 `Path` children with expected `fill`. Catches structural regressions.
2. **Manual smoke (iOS sim + Android emu + web)** — `pnpm run dev`, plant 20 flowers on each platform, watch for color cohesion, smooth motion, no console errors.
3. No automated visual-regression — poor cost/value for a 500 ms effect in RN.

### Done means

- Tap-plants produce a visible petal burst matching the flower color, on iOS, Android, and web
- No frame drops or console warnings in normal use
- Existing flower behavior unchanged (count increments, sway runs, max-flower replacement works)
- Snapshot test added and passing

## What we are deliberately NOT doing (YAGNI)

- No gravity / falling — radial dissipation only.
- No physics simulation — pure tween.
- No tap-on-existing-flower burst — bloom animation already covers that.
- No premium-only burst — burst happens on every plant; premium variation comes from color.
- No sound, no ripple, no growth-from-seed animation — out of scope for this iteration.
