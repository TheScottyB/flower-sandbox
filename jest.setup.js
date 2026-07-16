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
    return React.createElement(
      'AnimatedView',
      { ...props, ref },
      props.children,
    );
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

// Global environment variables mock
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://fake-supabase-url.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    appOwnership: 'standalone',
    expoConfig: {
      hostUri: 'localhost:8081',
    },
  },
  appOwnership: 'standalone',
  expoConfig: {
    hostUri: 'localhost:8081',
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  let cache = {};
  return {
    default: {
      getItem: jest.fn((key) => Promise.resolve(cache[key] || null)),
      setItem: jest.fn((key, value) => {
        cache[key] = value.toString();
        return Promise.resolve(null);
      }),
      removeItem: jest.fn((key) => {
        delete cache[key];
        return Promise.resolve(null);
      }),
      clear: jest.fn(() => {
        cache = {};
        return Promise.resolve(null);
      }),
    },
    getItem: jest.fn((key) => Promise.resolve(cache[key] || null)),
    setItem: jest.fn((key, value) => {
      cache[key] = value.toString();
      return Promise.resolve(null);
    }),
    removeItem: jest.fn((key) => {
      delete cache[key];
      return Promise.resolve(null);
    }),
    clear: jest.fn(() => {
      cache = {};
      return Promise.resolve(null);
    }),
  };
});

// Mock expo-iap
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve(true)),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  requestPurchase: jest.fn(() => Promise.resolve()),
  finishTransaction: jest.fn(() => Promise.resolve()),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: jest.fn(() => ({ success: undefined })),
  Link: 'Link',
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: (props) =>
      React.createElement('LinearGradient', props, props.children),
  };
});

// Mock supabase-js
jest.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    signInWithPassword: jest.fn(() =>
      Promise.resolve({ data: { user: {} }, error: null }),
    ),
    signUp: jest.fn(() => Promise.resolve({ data: { user: {} }, error: null })),
    getSession: jest.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  };
  const mockFrom = jest.fn(() => ({
    select: jest.fn(() => ({
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  }));
  return {
    createClient: jest.fn(() => ({
      auth: mockAuth,
      from: mockFrom,
    })),
  };
});
