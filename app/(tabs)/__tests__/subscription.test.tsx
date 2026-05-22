import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Platform, Linking, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { useIAP } from '@/src/hooks/useIAP';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import SubscriptionScreen from '../subscription';

declare const global: any;

// Mock expo-router router push and replace
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => {
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }),
    useLocalSearchParams: jest.fn(),
    Link: 'Link',
  };
});

// Mock the useIAP hook
jest.mock('@/src/hooks/useIAP', () => ({
  useIAP: jest.fn(),
}));

const mockUseIAP = useIAP as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

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
  const mockOpenURL = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default platform and mock implementations
    Platform.OS = 'ios';
    
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
    });

    mockUseLocalSearchParams.mockReturnValue({ success: undefined });

    // Mock supabase auth session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock supabase database query
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    // Mock Linking
    jest.spyOn(Linking, 'openURL').mockImplementation(mockOpenURL);
    mockOpenURL.mockResolvedValue(true);

    // Default global fetch mock
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/pay/mock', error: null }),
    });
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    (globalThis as any).window = originalWindow;
    jest.restoreAllMocks();
  });

  // ── iOS StoreKit Tests ─────────────────────────────────────────────────────

  it('renders loading indicator when iap is loading on iOS', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: true,
      error: null,
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator).toBeDefined();

    const loadingTextNode = findTextWithContent(tree.root, 'Loading subscription information...');
    expect(loadingTextNode).toBeDefined();
  });

  it('renders active subscription state on iOS', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: true,
      loading: false,
      error: null,
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    
    // Check status is Active
    const statusTextNode = findTextWithContent(tree.root, 'Active');
    expect(statusTextNode).toBeDefined();

    // Should render Thank You container
    const thankYouTextNode = findTextWithContent(tree.root, 'Thank you for your support!');
    expect(thankYouTextNode).toBeDefined();

    // Should not render Subscribe Now button
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Subscribe Now'; } catch { return false; }
    });
    expect(subscribeBtn).toBeUndefined();
  });

  it('renders inactive subscription state on iOS with Subscribe and Restore buttons', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);

    // Check status is Not Subscribed
    const statusTextNode = findTextWithContent(tree.root, 'Not Subscribed');
    expect(statusTextNode).toBeDefined();

    const buttons = tree.root.findAllByType(TouchableOpacity);
    
    // Check Subscribe button
    const subscribeBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Subscribe Now'; } catch { return false; }
    });
    expect(subscribeBtn).toBeDefined();

    // Check Restore button
    const restoreBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Restore Purchases'; } catch { return false; }
    });
    expect(restoreBtn).toBeDefined();
  });

  it('triggers purchaseSubscription when clicking Subscribe on iOS', async () => {
    const purchaseMock = jest.fn().mockResolvedValue(undefined);
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      purchaseSubscription: purchaseMock,
      restorePurchases: jest.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Subscribe Now'; } catch { return false; }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect(purchaseMock).toHaveBeenCalled();
  });

  it('triggers restorePurchases when clicking Restore on iOS', async () => {
    const restoreMock = jest.fn().mockResolvedValue(undefined);
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: null,
      purchaseSubscription: jest.fn(),
      restorePurchases: restoreMock,
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const buttons = tree.root.findAllByType(TouchableOpacity);
    const restoreBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Restore Purchases'; } catch { return false; }
    })!;

    await TestRenderer.act(async () => {
      restoreBtn.props.onPress();
    });

    expect(restoreMock).toHaveBeenCalled();
  });

  it('surfaces error from iap hook', () => {
    mockUseIAP.mockReturnValue({
      isSubscribed: false,
      loading: false,
      error: 'Failed to connect to App Store.',
      purchaseSubscription: jest.fn(),
      restorePurchases: jest.fn(),
    });

    const tree = TestRenderer.create(<SubscriptionScreen />);
    const errorTextNode = findTextWithContent(tree.root, 'Failed to connect to App Store.');
    expect(errorTextNode).toBeDefined();
  });

  // ── Android/Web Stripe Tests ───────────────────────────────────────────────

  it('fetches and renders active subscription from Supabase on Android', async () => {
    Platform.OS = 'android';

    const mockSession = { access_token: 'fake-token' };
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        subscription_status: 'active',
        price_id: 'price_1RCQr6DesriQyUxd0aR0MNGG',
        current_period_end: 1774320000, // May 22, 2026 (or similar in local timezone)
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

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
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Subscribe Now'; } catch { return false; }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('starts Stripe Checkout and opens URL on Android when logged in', async () => {
    Platform.OS = 'android';

    const mockSession = { access_token: 'fake-access-token' };
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const subscribeBtn = buttons.find((b: any) => {
      try { return b.findByType(Text).props.children === 'Subscribe Now'; } catch { return false; }
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
      })
    );

    expect(mockOpenURL).toHaveBeenCalledWith('https://checkout.stripe.com/pay/mock');
  });

  it('starts Stripe Checkout and updates location on Web when logged in', async () => {
    Platform.OS = 'web';

    const mockSession = { access_token: 'fake-access-token-web' };
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
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
      try { return b.findByType(Text).props.children === 'Subscribe Now'; } catch { return false; }
    })!;

    await TestRenderer.act(async () => {
      subscribeBtn.props.onPress();
    });

    expect((globalThis as any).window.location.href).toBe('https://checkout.stripe.com/pay/mock');
  });

  // ── Success and Cancel Query Parameter Handling ────────────────────────────

  it('renders success message if success query parameter is true', async () => {
    Platform.OS = 'android';
    mockUseLocalSearchParams.mockReturnValue({ success: 'true' });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const successTextNode = findTextWithContent(tree.root, 'Your subscription was successfully activated!');
    expect(successTextNode).toBeDefined();
  });

  it('renders cancel/error message if success query parameter is false', async () => {
    Platform.OS = 'android';
    mockUseLocalSearchParams.mockReturnValue({ success: 'false' });

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<SubscriptionScreen />);
    });

    const errorTextNode = findTextWithContent(tree.root, 'The subscription process was cancelled.');
    expect(errorTextNode).toBeDefined();
  });
});
