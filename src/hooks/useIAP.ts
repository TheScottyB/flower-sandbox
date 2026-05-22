/**
 * useIAP — StoreKit subscription hook (iOS only)
 *
 * Manages the full lifecycle of a single auto-renewable subscription via
 * expo-iap (OpenIAP-compliant, Expo SDK 56 compatible).
 * Call this hook only when Platform.OS === 'ios'.
 *
 * Product ID: com.djscottyb.flowersandbox.premium.monthly
 * Sub group:  FlowerSandbox Premium
 *
 * getAvailablePurchases() returns only currently active (non-expired)
 * subscriptions — no server-side receipt validation needed for status checks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useIAP(): IAPState {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stable ref so the purchase listener closure always calls the latest setter
  const setSubscribedRef = useRef(setIsSubscribed);
  setSubscribedRef.current = setIsSubscribed;

  useEffect(() => {
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
