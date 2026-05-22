/**
 * useIAP — StoreKit subscription hook (iOS only)
 *
 * Manages the full lifecycle of a single auto-renewable subscription via
 * expo-in-app-purchases. Call this hook only when Platform.OS === 'ios'.
 *
 * IMPORTANT: Before submitting to the App Store you must create the matching
 * auto-renewable subscription product in App Store Connect:
 *   Product ID: com.djscottyb.flowersandbox.premium.monthly
 *   Price:      $0.99/month  (or your chosen tier)
 *   Sub group:  FlowerSandbox Premium
 *
 * For production, add server-side Apple receipt validation (or switch to
 * RevenueCat) to cryptographically confirm subscription expiry dates.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as InAppPurchases from 'expo-in-app-purchases';

export const IAP_PRODUCT_ID =
  process.env.EXPO_PUBLIC_IAP_PRODUCT_ID ??
  'com.djscottyb.flowersandbox.premium.monthly';

const STORAGE_KEY = '@flowersandbox/iap_subscribed';
const subscribers = new Set<(value: boolean) => void>();

let connectionPromise: Promise<void> | null = null;
let purchaseListenerConfigured = false;
let currentSubscribed = false;

export type IAPState = {
  /** Whether the user currently has an active subscription. */
  isSubscribed: boolean;
  /** Whether the IAP system is still initialising. */
  loading: boolean;
  /** Human-readable error message, if any. */
  error: string | null;
  /** Trigger a new purchase sheet. */
  purchaseSubscription: () => Promise<void>;
  /** Restore previously completed transactions. */
  restorePurchases: () => Promise<void>;
};

export function useIAP(): IAPState {
  const [isSubscribed, setIsSubscribed] = useState(currentSubscribed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    subscribers.add(setIsSubscribed);

    const init = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && cached !== null) {
          await persistSubscribed(cached === '1');
        }

        await connectStore();

        configurePurchaseListener();
      } catch (err: any) {
        if (!cancelled) {
          console.error('[useIAP] init error:', err);
          setError('Failed to initialise purchases. Please restart the app.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      subscribers.delete(setIsSubscribed);
    };
  }, []);

  const purchaseSubscription = useCallback(async () => {
    setError(null);
    try {
      // Fetch the product first so StoreKit has the price metadata
      const { responseCode, results } = await InAppPurchases.getProductsAsync([
        IAP_PRODUCT_ID,
      ]);

      if (
        responseCode !== InAppPurchases.IAPResponseCode.OK ||
        !results ||
        results.length === 0
      ) {
        setError(
          'This product is not available. Please check your App Store connection.',
        );
        return;
      }

      await InAppPurchases.purchaseItemAsync(IAP_PRODUCT_ID);
      // Purchase result is delivered via the setPurchaseListener callback above
    } catch (err: any) {
      // USER_CANCELED (code 2) is not an error worth surfacing
      if (err?.code !== 'ERR_PAYMENT_CANCELLED') {
        console.error('[useIAP] purchase error:', err);
        setError('Purchase failed. Please try again.');
      }
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    setError(null);
    try {
      const { responseCode, results } =
        await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        const hasSubscription = results.some((p) => p.productId === IAP_PRODUCT_ID);
        await persistSubscribed(hasSubscription);
        if (!hasSubscription) {
          setError('No previous subscription found for this Apple ID.');
        }
      } else {
        setError('Could not retrieve purchase history. Please try again.');
      }
    } catch (err: any) {
      console.error('[useIAP] restore error:', err);
      setError('Restore failed. Please try again.');
    }
  }, [persistSubscribed]);

  return { isSubscribed, loading, error, purchaseSubscription, restorePurchases };
}

async function connectStore() {
  if (!connectionPromise) {
    connectionPromise = InAppPurchases.connectAsync().catch((err: any) => {
      if (String(err?.message ?? '').includes('Already connected')) {
        return;
      }
      connectionPromise = null;
      throw err;
    });
  }

  await connectionPromise;
}

function configurePurchaseListener() {
  if (purchaseListenerConfigured) return;

  InAppPurchases.setPurchaseListener(async ({ responseCode, results }) => {
    if (responseCode !== InAppPurchases.IAPResponseCode.OK || !results) return;

    for (const purchase of results) {
      const isCompleted =
        purchase.purchaseState === InAppPurchases.InAppPurchaseState.PURCHASED ||
        purchase.purchaseState === InAppPurchases.InAppPurchaseState.RESTORED;

      if (purchase.productId === IAP_PRODUCT_ID && isCompleted) {
        await persistSubscribed(true);

        if (!purchase.acknowledged) {
          await InAppPurchases.finishTransactionAsync(purchase, false);
        }
      }
    }
  });

  purchaseListenerConfigured = true;
}

async function persistSubscribed(value: boolean) {
  currentSubscribed = value;
  subscribers.forEach((subscriber) => subscriber(value));
  await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
}
