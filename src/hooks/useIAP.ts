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

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

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
  /**
   * StoreKit display name for the subscription product (e.g. "FlowerSandbox Premium").
   * null on non-iOS or before the product metadata has loaded.
   */
  productTitle: string | null;
  /**
   * StoreKit localised price string for the subscription product (e.g. "$0.99").
   * null on non-iOS or before the product metadata has loaded.
   */
  productPrice: string | null;
  /** Trigger a new StoreKit purchase sheet. */
  purchaseSubscription: () => Promise<void>;
  /** Restore previously completed transactions. */
  restorePurchases: () => Promise<void>;
};

const IS_IOS = Platform.OS === 'ios';
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const USE_IAP = IS_IOS && !IS_EXPO_GO;

export function useIAP(): IAPState {
  // Initial loading is true only on iOS (when not in Expo Go) — non-iOS/Expo Go has nothing to load.
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(USE_IAP);
  const [error, setError] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState<string | null>(null);
  const [productPrice, setProductPrice] = useState<string | null>(null);
  // Stable ref so the purchase listener closure always calls the latest setter
  const setSubscribedRef = useRef(setIsSubscribed);
  setSubscribedRef.current = setIsSubscribed;

  useEffect(() => {
    if (!USE_IAP) return; // non-iOS / Expo Go: nothing to subscribe to
    let cancelled = false;

    const persist = async (value: boolean) => {
      setSubscribedRef.current(value);
      await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    };

    const init = async () => {
      try {
        // Warm the UI with cached status while we hit the store
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && cached !== null)
          setSubscribedRef.current(cached === '1');

        await initConnection();

        // Fetch product metadata so the UI shows the StoreKit title and price
        // instead of the hardcoded Stripe catalog values (fixes 3.1.2 mismatch).
        try {
          const skProducts = await fetchProducts({
            skus: [IAP_PRODUCT_ID],
            type: 'subs',
          });
          const product = skProducts?.[0] as any;
          if (!cancelled && product) {
            const title: string | null =
              product.displayNameIOS ?? product.displayName ?? null;
            const price: string | null =
              product.displayPrice ?? product.localizedPrice ?? null;
            if (title) setProductTitle(title);
            if (price) setProductPrice(price);
          }
        } catch (productErr) {
          // Non-fatal — fall back to static Stripe catalog values in the UI.
          console.warn('[useIAP] fetchProducts error (non-fatal):', productErr);
        }

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
    if (!USE_IAP) return;
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
    if (!USE_IAP) return;
    setError(null);
    try {
      const purchases = await getAvailablePurchases();
      const hasSubscription = purchases.some(
        (p) => p.productId === IAP_PRODUCT_ID,
      );
      setIsSubscribed(hasSubscription);
      await AsyncStorage.setItem(STORAGE_KEY, hasSubscription ? '1' : '0');
      if (!hasSubscription)
        setError('No previous subscription found for this Apple ID.');
    } catch (err: any) {
      console.error('[useIAP] restore error:', err);
      setError('Restore failed. Please try again.');
    }
  }, []);

  return {
    isSubscribed,
    loading,
    error,
    productTitle,
    productPrice,
    purchaseSubscription,
    restorePurchases,
  };
}
