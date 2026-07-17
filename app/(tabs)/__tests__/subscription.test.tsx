import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
} from 'react-native';
import TestRenderer from 'react-test-renderer';
import { type Mock, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { useIAP } from '@/src/hooks/useIAP';
import SubscriptionScreen from '../subscription';

declare const global: any;

// Mock expo-router router push and replace
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

vi.mock('expo-router', () => {
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }),
    useLocalSearchParams: vi.fn(),
    Link: 'Link',
  };
});

// Mock the useIAP hook
vi.mock('@/src/hooks/useIAP', () => ({
  useIAP: vi.fn(),
}));

const mockUseIAP = useIAP as Mock;
const mockUseLocalSearchParams = useLocalSearchParams as Mock;

// Helper to find Text nodes by content
const findTextWithContent = (root: any, content: string) => {
  return root.find((node: any) => {
    if (node.type !== Text) return false;
    const children = node.props.children;
    if (children === content) return true;
    if (Array.isArray(children)) {
      return children.join('').includes(content);
    }
    if (typeof children === 'string' && children.includes(content)) return true;
    return false;
  });
};

describe('SubscriptionScreen', () => {
  const originalPlatformOS = Platform.OS;
  const originalWindow = (globalThis as any).window;
  const mockOpenURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Set default platform and mock implementations
    Platform.OS = 'ios';

    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      productTitle: null,
      productPrice: null,
      purchaseSubscription: vi.fn(),
      restorePurchases: vi.fn(),
    });

    mockUseLocalSearchParams.mockReturnValue({ success: undefined });

    // Mock supabase auth session
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock supabase database query
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const mockSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    (supabase.from as Mock).mockReturnValue({ select: mockSelect });

    // Mock Linking
    vi.spyOn(Linking, 'openURL').mockImplementation(mockOpenURL);
    mockOpenURL.mockResolvedValue(true);

    // Default global fetch mock
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          url: 'https://checkout.stripe.com/pay/mock',
          error: null,
        }),
    });
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  // ── iOS StoreKit Tests ─────────────────────────────────────────────────────

  it('renders loading indicator when iap is loading on iOS', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: true,
      error: null,
      productTitle: null,
      productPrice: null,
      purchaseSubscription: vi.fn(),
      restorePurchases: vi.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator).toBeDefined();

    const loadingTextNode = findTextWithContent(
      tree.root,
      'Loading subscription information...',
    );
    expect(loadingTextNode).toBeDefined();
  });

  it('renders active subscription state on iOS', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: true,
      loading: false,
      error: null,
      productTitle: null,
      productPrice: null,
      purchaseSubscription: vi.fn(),
      restorePurchases: vi.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);

    // Check status is Active
    const statusTextNode = findTextWithContent(tree.root, 'Active');
    expect(statusTextNode).toBeDefined();

    // Should render Thank You container
    const thankYouTextNode = findTextWithContent(
      tree.root,
      'Thank you for your support!',
    );
    expect(thankYouTextNode).toBeDefined();

    // Should not render Subscribe Now button
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Subscribe Now';
      } catch {
        return false;
      }
    });
    expect(subscribeBtn).toBeUndefined();
  });

  it('renders inactive subscription state on iOS with Subscribe and Restore buttons', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      productTitle: null,
      productPrice: null,
      purchaseSubscription: vi.fn(),
      restorePurchases: vi.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);

    // Check status is Not Subscribed
    const statusTextNode = findTextWithContent(tree.root, 'Not Subscribed');
    expect(statusTextNode).toBeDefined();

    const buttons = tree.root.findAllByType(TouchableOpacity);

    // Check Subscribe button
    const subscribeBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Subscribe Now';
      } catch {
        return false;
      }
    });
    expect(subscribeBtn).toBeDefined();

    // Check Restore button
    const restoreBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Restore Purchases';
      } catch {
        return false;
      }
    });
    expect(restoreBtn).toBeDefined();
  });

  it('triggers purchaseSubscription when clicking Subscribe on iOS', async () => {
    const purchaseMock = vi.fn().mockResolvedValue(undefined);
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      productTitle: null,
      productPrice: null,
      purchaseSubscription: purchaseMock,
      restorePurchases: vi.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Subscribe Now';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect(purchaseMock).toHaveBeenCalled();
  });

  it('triggers restorePurchases when clicking Restore on iOS', async () => {
    const restoreMock = vi.fn().mockResolvedValue(undefined);
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      productTitle: null,
      productPrice: null,
      purchaseSubscription: vi.fn(),
      restorePurchases: restoreMock,
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const restoreBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Restore Purchases';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      restoreBtn.props.onPress();
    });

    expect(restoreMock).toHaveBeenCalled();
  });

  it('uses StoreKit product title and price on iOS when available', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      productTitle: 'FlowerSandbox Premium',
      productPrice: '$0.99',
      purchaseSubscription: vi.fn(),
      restorePurchases: vi.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);

    const titleNode = findTextWithContent(tree.root, 'FlowerSandbox Premium');
    expect(titleNode).toBeDefined();

    // Price appears in both the badge and the renewal-terms sentence — use findAll
    const priceNodes = tree.root.findAll((node: any) => {
      if (node.type !== Text) return false;
      const ch = node.props.children;
      if (typeof ch === 'string') return ch.includes('$0.99');
      if (Array.isArray(ch)) return ch.join('').includes('$0.99');
      return false;
    });
    expect(priceNodes.length).toBeGreaterThan(0);

    // The Stripe catalog title must not appear
    const stripeTitle = tree.root.findAll((node: any) => {
      if (node.type !== Text) return false;
      const ch = node.props.children;
      return typeof ch === 'string' && ch.includes('A nice sandbox to play in');
    });
    expect(stripeTitle).toHaveLength(0);
  });

  it('surfaces error from iap hook', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: 'Failed to connect to App Store.',
      productTitle: null,
      productPrice: null,
      purchaseSubscription: vi.fn(),
      restorePurchases: vi.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const errorTextNode = findTextWithContent(
      tree.root,
      'Failed to connect to App Store.',
    );
    expect(errorTextNode).toBeDefined();
  });

  // ── Android/Web Stripe Tests ───────────────────────────────────────────────

  it('fetches and renders active subscription from Supabase on Android', async () => {
    Platform.OS = 'android';

    const mockSession = { access_token: 'fake-token' };
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        subscription_status: 'active',
        price_id: 'price_1RCQr6DesriQyUxd0aR0MNGG',
        current_period_end: 1774320000, // May 22, 2026 (or similar in local timezone)
      },
      error: null,
    });
    const mockSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    (supabase.from as Mock).mockReturnValue({ select: mockSelect });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    expect(supabase.from).toHaveBeenCalledWith('stripe_user_subscriptions');

    // Should show active status
    const statusTextNode = findTextWithContent(tree.root, 'Active');
    expect(statusTextNode).toBeDefined();

    // Should display subscription renews date
    const renewsLabelNode = findTextWithContent(tree.root, 'Renews on:');
    expect(renewsLabelNode).toBeDefined();
  });

  it('triggers login redirection when subscribing on Android while not logged in', async () => {
    Platform.OS = 'android';

    // Simulate user not logged in
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Subscribe Now';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('starts Stripe Checkout and opens URL on Android when logged in', async () => {
    Platform.OS = 'android';

    const mockSession = { access_token: 'fake-access-token' };
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Subscribe Now';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      'https://fake-supabase-url.supabase.co/functions/v1/stripe-checkout',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake-access-token',
        },
      }),
    );

    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://checkout.stripe.com/pay/mock',
    );
  });

  it('starts Stripe Checkout and updates location on Web when logged in', async () => {
    Platform.OS = 'web';

    const mockSession = { access_token: 'fake-access-token-web' };
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const mockLocation = {
      origin: 'http://localhost:8081',
      href: '',
    };
    (globalThis as any).window = {
      location: mockLocation,
    } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try {
        return b.findByType(Text).props.children === 'Subscribe Now';
      } catch {
        return false;
      }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect((globalThis as any).window.location.href).toBe(
      'https://checkout.stripe.com/pay/mock',
    );
  });

  // ── Success and Cancel Query Parameter Handling ────────────────────────────

  it('renders success message if success query parameter is true', async () => {
    Platform.OS = 'android';
    mockUseLocalSearchParams.mockReturnValue({ success: 'true' });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const successTextNode = findTextWithContent(
      tree.root,
      'Your subscription was successfully activated!',
    );
    expect(successTextNode).toBeDefined();
  });

  it('renders cancel/error message if success query parameter is false', async () => {
    Platform.OS = 'android';
    mockUseLocalSearchParams.mockReturnValue({ success: 'false' });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const errorTextNode = findTextWithContent(
      tree.root,
      'The subscription process was cancelled.',
    );
    expect(errorTextNode).toBeDefined();
  });
});
