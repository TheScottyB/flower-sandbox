// React 19's `TestRenderer.create()` schedules the initial render
// asynchronously via the scheduler, so reading `.root` synchronously
// afterwards finds an unmounted tree. Wrapping every call in act() works,
// but our component tests use the natural synchronous shape:
//
//   const tree = TestRenderer.create(<X />);
//   expect(tree.root.findAllByType(...))...
//
// To make that shape work, we patch `TestRenderer.create` to auto-wrap
// its body in act(), so the initial render commits before returning.
// Tests that explicitly drive async effects can still call act() manually
// — nested act() is supported.
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TestRenderer = require('react-test-renderer');
  const { act } = TestRenderer;
  const originalCreate = TestRenderer.create;
  TestRenderer.create = function autoActCreate(...args) {
    let result;
    act(() => {
      result = originalCreate.apply(this, args);
    });
    return result;
  };
  // Also keep IS_REACT_ACT_ENVIRONMENT true (default) so legitimate
  // unwrapped state updates still warn.
}

// Hand-written mock for react-native-reanimated v4.
//
// We deliberately avoid jest.requireActual('react-native-reanimated') and the
// shipped 'react-native-reanimated/mock' — both re-import the real module,
// which triggers react-native-worklets native init under jest and throws
// "WorkletsError: [Worklets] Native part of Worklets doesn't seem to be initialized".
//
// We also avoid require('react-native') inside the factory: RN's index.js
// uses lazy property getters that can fire after the Jest env is torn down
// and crash the test. Instead, the mocked Animated.View is a tiny passthrough
// React component that renders its children — sufficient for shallow tree
// inspection via react-test-renderer.
//
// This mock covers the reanimated APIs used by:
//   - src/components/PetalBurst.tsx
//   - src/components/Flower.tsx
jest.mock('react-native-reanimated', () => {
  const React = require('react');

  const AnimatedView = React.forwardRef(function AnimatedView(props, ref) {
    return React.createElement('AnimatedView', { ...props, ref }, props.children);
  });

  const identity = (t) => t;
  const fakeAnimation = (toValue, _config, callback) => {
    if (typeof callback === 'function') callback(true);
    return toValue;
  };

  const Easing = {
    out: () => identity,
    inOut: () => identity,
    in: () => identity,
    cubic: identity,
    sin: identity,
    linear: identity,
    ease: identity,
    quad: identity,
    bezier: () => identity,
  };

  return {
    __esModule: true,
    default: { View: AnimatedView, createAnimatedComponent: (C) => C },
    View: AnimatedView,
    createAnimatedComponent: (C) => C,
    useSharedValue: (init) => ({ value: init }),
    useDerivedValue: (factory) => ({ value: factory() }),
    useAnimatedStyle: (factory) => factory(),
    runOnJS: (fn) => fn,
    withTiming: fakeAnimation,
    withSpring: fakeAnimation,
    withDelay: (_delay, anim) => anim,
    withRepeat: (anim) => anim,
    withSequence: (...anims) => anims[anims.length - 1],
    cancelAnimation: () => {},
    Easing,
  };
});
