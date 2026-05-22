/**
 * useIAP — StoreKit subscription hook
 *
 * Manages the full lifecycle of a single auto-renewable subscription via
 * expo-iap (OpenIAP-compliant, Expo SDK 56 compatible).
 *
 * Always callable from any component on any platform. On non-iOS platforms
 * the hook returns a stable "not subscribed, not loading, no error" stub
 * so callers don't need a `Platform.OS === 'ios' ? useIAP() : null` guard
 * (which would violate the rules of hooks if the condition ever became
 * non-constant).
 *
 * Product ID: com.djscottyb.flowersandbox.premium.monthly
 * Sub group:  FlowerSandbox Premium
 *
 * getAvailablePurchases() returns only currently active (non-expired)
 * subscriptions — no server-side receipt validation needed for status checks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  getAvailablePurchases,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';

export const IAP_PRODUCT_ID =
  process.env.EXPO_PUBLIC_IAP_PRODUCT_ID ??
  'com.djscottyb.flowersandbox.premium.monthly';

const STORAGE_KEY = '@flowersandbox/iap_subscribed';

export type IAPState = {
  /** Whether the user currently has an active subscription. */
  isSubscribed: boolean;
  /** Whether the IAP system is still initialising. */
  loading: boolean;
  /** Human-readable error message, if any. */
  error: string | null;
  /** Trigger a new StoreKit purchase sheet. */
  purchaseSubscription: () => Promise<void>;
  /** Restore previously completed transactions. */
  restorePurchases: () => Promise<void>;
};

const IS_IOS = Platform.OS === 'ios';

export function useIAP(): IAPState {
  // Initial loading is true only on iOS — non-iOS has nothing to load.
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(IS_IOS);
  const [error, setError] = useState<string | null>(null);
  // Stable ref so the purchase listener closure always calls the latest setter
  const setSubscribedRef = useRef(setIsSubscribed);
  setSubscribedRef.current = setIsSubscribed;

  useEffect(() => {
    if (!IS_IOS) return; // non-iOS: nothing to subscribe to
    let cancelled = false;

    const persist = async (value: boolean) => {
      setSubscribedRef.current(value);
      await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    };

    const init = async () => {
      try {
        // Warm the UI with cached status while we hit the store
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && cached !== null) setSubscribedRef.current(cached === '1');

        await initConnection();

        // getAvailablePurchases returns only currently-valid (non-expired) subs
        const purchases = await getAvailablePurchases();
        if (!cancelled) {
          await persist(purchases.some((p) => p.productId === IAP_PRODUCT_ID));
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[useIAP] init error:', err);
          setError('Failed to initialise purchases. Please restart the app.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Listen for purchase completions (new purchases and deferred transactions)
    const purchaseSub = purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== IAP_PRODUCT_ID) return;
      try {
        await finishTransaction({ purchase });
        if (!cancelled) await persist(true);
      } catch (err) {
        console.error('[useIAP] finishTransaction error:', err);
      }
    });

    const errorSub = purchaseErrorListener((err) => {
      if (String(err.code) === 'UserCancelled') return;
      if (!cancelled) setError('Purchase failed. Please try again.');
    });

    init();

    return () => {
      cancelled = true;
      purchaseSub.remove();
      errorSub.remove();
      endConnection().catch(() => {});
    };
  }, []);

  const purchaseSubscription = useCallback(async () => {
    if (!IS_IOS) return;
    setError(null);
    try {
      await requestPurchase({
        request: {
          apple: { sku: IAP_PRODUCT_ID },
          google: { skus: [IAP_PRODUCT_ID] },
        },
        type: 'subs',
      });
      // Result delivered via purchaseUpdatedListener above
    } catch (err: any) {
      if (String(err?.code) !== 'UserCancelled') {
        console.error('[useIAP] purchase error:', err);
        setError('Purchase failed. Please try again.');
      }
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    if (!IS_IOS) return;
    setError(null);
    try {
      const purchases = await getAvailablePurchases();
      const hasSubscription = purchases.some((p) => p.productId === IAP_PRODUCT_ID);
      setIsSubscribed(hasSubscription);
      await AsyncStorage.setItem(STORAGE_KEY, hasSubscription ? '1' : '0');
      if (!hasSubscription) setError('No previous subscription found for this Apple ID.');
    } catch (err: any) {
      console.error('[useIAP] restore error:', err);
      setError('Restore failed. Please try again.');
    }
  }, []);

  return { isSubscribed, loading, error, purchaseSubscription, restorePurchases };
}
