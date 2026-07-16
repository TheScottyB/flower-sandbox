import AsyncStorage from '@react-native-async-storage/async-storage';
import * as expoIAP from 'expo-iap';
import type React from 'react';
import TestRenderer from 'react-test-renderer';
import { useIAP } from '../useIAP';

const HookWrapper = ({
  children,
}: {
  children: (state: any) => React.ReactNode;
}) => {
  const iap = useIAP();
  return <>{children(iap)}</>;
};

describe('useIAP hook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('initializes connection and loads subscription on iOS standalone', async () => {
    // Set cached subscription to true
    await AsyncStorage.setItem('@flowersandbox/iap_subscribed', '1');

    // Mock getAvailablePurchases to return active sub
    const getAvailablePurchasesMock =
      expoIAP.getAvailablePurchases as jest.Mock;
    getAvailablePurchasesMock.mockResolvedValue([
      { productId: 'com.djscottyb.flowersandbox.premium.monthly' },
    ]);

    let hookState: any = null;
    await TestRenderer.act(async () => {
      TestRenderer.create(
        <HookWrapper>
          {(state) => {
            hookState = state;
            return null;
          }}
        </HookWrapper>,
      );
    });

    expect(expoIAP.initConnection).toHaveBeenCalled();
    expect(hookState.isSubscribed).toBe(true);
    expect(hookState.loading).toBe(false);
  });

  it('calls requestPurchase when purchasing subscription', async () => {
    let hookState: any = null;
    await TestRenderer.act(async () => {
      TestRenderer.create(
        <HookWrapper>
          {(state) => {
            hookState = state;
            return null;
          }}
        </HookWrapper>,
      );
    });

    await TestRenderer.act(async () => {
      await hookState.purchaseSubscription();
    });

    expect(expoIAP.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: { sku: 'com.djscottyb.flowersandbox.premium.monthly' },
        google: { skus: ['com.djscottyb.flowersandbox.premium.monthly'] },
      },
      type: 'subs',
    });
  });

  it('restores purchases and sets subscription if found', async () => {
    // Mock getAvailablePurchases to return active subscription
    const getAvailablePurchasesMock =
      expoIAP.getAvailablePurchases as jest.Mock;
    getAvailablePurchasesMock.mockResolvedValue([
      { productId: 'com.djscottyb.flowersandbox.premium.monthly' },
    ]);

    let hookState: any = null;
    await TestRenderer.act(async () => {
      TestRenderer.create(
        <HookWrapper>
          {(state) => {
            hookState = state;
            return null;
          }}
        </HookWrapper>,
      );
    });

    await TestRenderer.act(async () => {
      await hookState.restorePurchases();
    });

    expect(hookState.isSubscribed).toBe(true);
    expect(hookState.error).toBeNull();
  });

  it('sets error if no previous subscription found on restore', async () => {
    // Mock getAvailablePurchases to return empty array
    const getAvailablePurchasesMock =
      expoIAP.getAvailablePurchases as jest.Mock;
    getAvailablePurchasesMock.mockResolvedValue([]);

    let hookState: any = null;
    await TestRenderer.act(async () => {
      TestRenderer.create(
        <HookWrapper>
          {(state) => {
            hookState = state;
            return null;
          }}
        </HookWrapper>,
      );
    });

    await TestRenderer.act(async () => {
      await hookState.restorePurchases();
    });

    expect(hookState.isSubscribed).toBe(false);
    expect(hookState.error).toBe(
      'No previous subscription found for this Apple ID.',
    );
  });
});
