import { vi } from 'vitest';

(globalThis as any).__DEV__ = true;

// React 19's `TestRenderer.create()` auto-act patch
{
  const TestRenderer = require('react-test-renderer');
  const { act } = TestRenderer;
  const originalCreate = TestRenderer.create;
  TestRenderer.create = function autoActCreate(...args: any[]) {
    let result: any;
    act(() => {
      result = originalCreate.apply(this, args);
    });
    return result;
  };
}

// React Native mock components and functions
vi.mock('react-native', () => {
  const React = require('react');

  const createMockComponent = (name: string) => {
    const Component = React.forwardRef((props: any, ref: any) => {
      return React.createElement(name, { ...props, ref }, props.children);
    });
    Component.displayName = name;
    return Component;
  };

  const Platform = {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  };

  const StyleSheet = {
    create: (styles: any) => styles,
    flatten: (styles: any): any => {
      if (Array.isArray(styles)) {
        return Object.assign({}, ...styles.map(StyleSheet.flatten));
      }
      return styles || {};
    },
  };

  return {
    ActivityIndicator: createMockComponent('ActivityIndicator'),
    Alert: {
      alert: vi.fn(),
    },
    Animated: {
      View: createMockComponent('AnimatedView'),
      createAnimatedComponent: (c: any) => c,
      timing: () => ({ start: (cb: any) => cb?.() }),
      spring: () => ({ start: (cb: any) => cb?.() }),
      Value: class {
        setValue() {}
      },
    },
    Button: createMockComponent('Button'),
    Dimensions: {
      get: () => ({ width: 375, height: 812 }),
      addEventListener: () => ({ remove: vi.fn() }),
    },
    Keyboard: {
      dismiss: vi.fn(),
      addListener: () => ({ remove: vi.fn() }),
    },
    KeyboardAvoidingView: createMockComponent('KeyboardAvoidingView'),
    Linking: {
      openURL: vi.fn(),
      canOpenURL: vi.fn(() => Promise.resolve(true)),
      addEventListener: () => ({ remove: vi.fn() }),
    },
    Platform,
    ScrollView: createMockComponent('ScrollView'),
    StyleSheet,
    Text: createMockComponent('Text'),
    TextInput: createMockComponent('TextInput'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    TouchableWithoutFeedback: createMockComponent('TouchableWithoutFeedback'),
    View: createMockComponent('View'),
    useColorScheme: vi.fn(() => 'light'),
    useWindowDimensions: vi.fn(() => ({ width: 375, height: 812 })),
    NativeModules: {
      BlobModule: {
        BLOB_URI_SCHEME: 'blob',
      },
      DevMenu: {},
    },
  };
});

// react-native-svg mock
vi.mock('react-native-svg', () => {
  const React = require('react');
  const createMockComponent = (name: string) => {
    const Component = React.forwardRef((props: any, ref: any) =>
      React.createElement(name, { ...props, ref }, props.children),
    );
    Component.displayName = name;
    return Component;
  };
  return {
    default: createMockComponent('Svg'),
    Svg: createMockComponent('Svg'),
    Path: createMockComponent('Path'),
    Circle: createMockComponent('Circle'),
    Rect: createMockComponent('Rect'),
    G: createMockComponent('G'),
  };
});

// react-native-safe-area-context mock
vi.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children, style, ...props }: any) =>
      React.createElement('SafeAreaView', { style, ...props }, children),
    useSafeAreaInsets: () => inset,
  };
});

// react-native-reanimated mock
vi.mock('react-native-reanimated', () => {
  const React = require('react');

  const AnimatedView = React.forwardRef(function AnimatedView(
    props: any,
    ref: any,
  ) {
    return React.createElement(
      'AnimatedView',
      { ...props, ref },
      props.children,
    );
  });

  const identity = (t: any) => t;
  const fakeAnimation = (toValue: any, _config: any, callback: any) => {
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
    default: { View: AnimatedView, createAnimatedComponent: (C: any) => C },
    View: AnimatedView,
    createAnimatedComponent: (C: any) => C,
    useSharedValue: (init: any) => ({ value: init }),
    useDerivedValue: (factory: any) => ({ value: factory() }),
    useAnimatedStyle: (factory: any) => factory(),
    runOnJS: (fn: any) => fn,
    withTiming: fakeAnimation,
    withSpring: fakeAnimation,
    withDelay: (_delay: any, anim: any) => anim,
    withRepeat: (anim: any) => anim,
    withSequence: (...anims: any[]) => anims[anims.length - 1],
    cancelAnimation: () => {},
    Easing,
  };
});

// Process env mock
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://fake-supabase-url.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';

// expo-haptics mock
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
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

// expo-constants mock
vi.mock('expo-constants', () => ({
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

// AsyncStorage mock
vi.mock('@react-native-async-storage/async-storage', () => {
  let cache: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(cache[key] || null)),
      setItem: vi.fn((key: string, value: any) => {
        cache[key] = value.toString();
        return Promise.resolve(null);
      }),
      removeItem: vi.fn((key: string) => {
        delete cache[key];
        return Promise.resolve(null);
      }),
      clear: vi.fn(() => {
        cache = {};
        return Promise.resolve(null);
      }),
    },
    getItem: vi.fn((key: string) => Promise.resolve(cache[key] || null)),
    setItem: vi.fn((key: string, value: any) => {
      cache[key] = value.toString();
      return Promise.resolve(null);
    }),
    removeItem: vi.fn((key: string) => {
      delete cache[key];
      return Promise.resolve(null);
    }),
    clear: vi.fn(() => {
      cache = {};
      return Promise.resolve(null);
    }),
  };
});

// expo-iap mock
vi.mock('expo-iap', () => ({
  initConnection: vi.fn(() => Promise.resolve(true)),
  endConnection: vi.fn(() => Promise.resolve(true)),
  getAvailablePurchases: vi.fn(() => Promise.resolve([])),
  fetchProducts: vi.fn(() => Promise.resolve([])),
  requestPurchase: vi.fn(() => Promise.resolve()),
  finishTransaction: vi.fn(() => Promise.resolve()),
  purchaseUpdatedListener: vi.fn(() => ({ remove: vi.fn() })),
  purchaseErrorListener: vi.fn(() => ({ remove: vi.fn() })),
}));

// expo-router mock
vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useLocalSearchParams: vi.fn(() => ({ success: undefined })),
  Link: 'Link',
}));

// expo-linear-gradient mock
vi.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: (props: any) =>
      React.createElement('LinearGradient', props, props.children),
  };
});

// expo-blur mock
vi.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: ({ children, style, ...props }: any) =>
      React.createElement('BlurView', { style, ...props }, children),
  };
});

// supabase-js mock
vi.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    signInWithPassword: vi.fn(() =>
      Promise.resolve({ data: { user: {} }, error: null }),
    ),
    signUp: vi.fn(() => Promise.resolve({ data: { user: {} }, error: null })),
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  }));
  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
      from: mockFrom,
    })),
  };
});

// react-native-svg mock
vi.mock('react-native-svg', () => {
  const React = require('react');
  const createMockComponent = (name: string) => {
    const Component = React.forwardRef((props: any, ref: any) => {
      return React.createElement(name, { ...props, ref }, props.children);
    });
    Component.displayName = name;
    return Component;
  };
  return {
    default: createMockComponent('Svg'),
    Svg: createMockComponent('Svg'),
    Path: createMockComponent('Path'),
    G: createMockComponent('G'),
    Circle: createMockComponent('Circle'),
    Rect: createMockComponent('Rect'),
  };
});

// lucide-react-native mock
vi.mock('lucide-react-native', () => {
  const React = require('react');
  const createMockIcon = (name: string) => {
    const Component = React.forwardRef((props: any, ref: any) =>
      React.createElement(name, { ...props, ref }, props.children),
    );
    Component.displayName = name;
    return Component;
  };
  return {
    Eye: createMockIcon('Eye'),
    EyeOff: createMockIcon('EyeOff'),
    X: createMockIcon('X'),
    CreditCard: createMockIcon('CreditCard'),
    Home: createMockIcon('Home'),
    Info: createMockIcon('Info'),
    CheckCircle2: createMockIcon('CheckCircle2'),
    ChevronDown: createMockIcon('ChevronDown'),
    ChevronUp: createMockIcon('ChevronUp'),
    Heart: createMockIcon('Heart'),
    LogIn: createMockIcon('LogIn'),
    Sparkles: createMockIcon('Sparkles'),
    User: createMockIcon('User'),
  };
});

// react-native-url-polyfill mock
vi.mock('react-native-url-polyfill', () => ({}));
vi.mock('react-native-url-polyfill/auto', () => ({}));
