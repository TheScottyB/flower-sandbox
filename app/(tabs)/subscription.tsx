import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Flower } from '@/src/components/Flower';
import { useIAP } from '@/src/hooks/useIAP';
import { useThemeColors, useThemeMode } from '@/src/hooks/useThemeColors';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/src/legal';
import { products } from '@/src/stripe-config';

type SubscriptionStatus = {
  subscription_status: string;
  price_id: string | null;
  current_period_end: number | null;
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const { success } = useLocalSearchParams<{ success?: string }>();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const theme = useThemeColors();
  const { isDark } = useThemeMode();

  // ── iOS: StoreKit ──────────────────────────────────────────────────────────
  const iap = useIAP();

  // ── Web/Android: Stripe ───────────────────────────────────────────────────
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null,
  );
  const [loadingInfo, setLoadingInfo] = useState(Platform.OS !== 'ios');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { sandbox } = products;

  // ── Unified subscription status ───────────────────────────────────────────────
  const isSubscribed =
    Platform.OS === 'ios'
      ? iap.isSubscribed
      : subscription?.subscription_status === 'active';

  // On iOS, prefer the StoreKit-supplied display name and localised price so that
  // the purchase screen matches what appears in the StoreKit payment sheet
  // (Apple Guideline 3.1.2 requires parity between displayed and charged amounts).
  const planName =
    Platform.OS === 'ios' ? (iap.productTitle ?? sandbox.name) : sandbox.name;
  const planPrice =
    Platform.OS === 'ios' ? (iap.productPrice ?? sandbox.price) : sandbox.price;

  const currentPlan = isSubscribed ? planName : 'No active subscription';

  const flowerPositions = isWide
    ? [
        {
          type: 'sunflower' as const,
          size: 85,
          position: { x: width * 0.08, y: 120 },
        },
        {
          type: 'rose' as const,
          size: 75,
          position: { x: width * 0.88, y: 180 },
        },
        {
          type: 'daisy' as const,
          size: 65,
          position: { x: width * 0.84, y: 420 },
        },
        {
          type: 'tulip' as const,
          size: 70,
          position: { x: width * 0.12, y: 350 },
        },
      ]
    : [
        { type: 'sunflower' as const, size: 60, position: { x: 30, y: 60 } },
        {
          type: 'rose' as const,
          size: 55,
          position: { x: width - 60, y: 100 },
        },
        {
          type: 'daisy' as const,
          size: 45,
          position: { x: width - 40, y: 220 },
        },
        { type: 'tulip' as const, size: 50, position: { x: 35, y: 180 } },
      ];

  // ── Stripe helpers (web / Android only) ───────────────────────────────────
  const getBaseUrl = () => {
    if (Platform.OS === 'web') return window.location.origin;
    if (__DEV__)
      return Constants.expoConfig?.hostUri
        ? `http://${Constants.expoConfig.hostUri}`
        : 'http://localhost:8081';
    return 'flowersandbox://';
  };

  const fetchStripeSubscription = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setSubscription(null);
        return;
      }

      const { data, error: dbErr } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status, price_id, current_period_end')
        .maybeSingle();

      if (dbErr) throw dbErr;
      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      const {
        data: { session },
      } = await supabase.auth
        .getSession()
        .catch(() => ({ data: { session: null } }));
      if (session)
        setError('Failed to load subscription status. Please try again.');
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') return;

    if (success === 'true') {
      setSuccessMessage('Your subscription was successfully activated!');
    } else if (success === 'false') {
      setError('The subscription process was cancelled.');
    }
    fetchStripeSubscription();
  }, [success, fetchStripeSubscription]);

  // Surface IAP errors in the shared error state
  useEffect(() => {
    if (iap.error) setError(iap.error);
  }, [iap.error]);

  const handleStripeSubscribe = async () => {
    setStripeLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        router.push('/login');
        return;
      }

      const baseUrl = getBaseUrl();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            price_id: sandbox.priceId,
            success_url: `${baseUrl}/subscription?success=true`,
            cancel_url: `${baseUrl}/subscription?success=false`,
            mode: sandbox.mode,
          }),
        },
      );

      const { error: stripeError, url } = await response.json();
      if (stripeError) throw new Error(stripeError);

      if (url) {
        if (Platform.OS === 'web') {
          window.location.href = url;
        } else {
          await Linking.openURL(url);
        }
      } else {
        setError('Failed to create subscription checkout. Please try again.');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError('Failed to start checkout process.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleSubscribe = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (Platform.OS === 'ios') {
      iap.purchaseSubscription();
    } else {
      handleStripeSubscribe();
    }
  };

  const handleRestore = () => {
    iap.restorePurchases();
  };

  const loading = Platform.OS === 'ios' ? iap.loading : stripeLoading;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.backgroundStart }]}
    >
      <LinearGradient
        colors={[theme.backgroundStart, theme.backgroundEnd]}
        style={styles.background}
      />

      {/* Decorative flowers */}
      <View style={styles.decorativeFlowers} pointerEvents="none">
        {flowerPositions.map((flower, idx) => (
          <Flower
            key={idx}
            type={flower.type}
            size={flower.size}
            position={flower.position}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.container}>
          <View style={[styles.card, { borderColor: theme.cardBorder }]}>
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.cardBlur,
                {
                  backgroundColor: theme.cardBackground,
                },
              ]}
            >
              {/* Card Header */}
              <View
                style={[
                  styles.cardHeader,
                  {
                    borderBottomColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.06)',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(255, 255, 255, 0.35)',
                  },
                ]}
              >
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  Premium Subscription
                </Text>
                <View style={styles.statusChipContainer}>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: isSubscribed
                          ? theme.successBackground
                          : theme.statusBanner,
                        borderColor: isSubscribed
                          ? theme.successBorder
                          : theme.tabBarBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color: isSubscribed
                            ? theme.successText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      Status: {isSubscribed ? 'Active' : 'Not Subscribed'}
                    </Text>
                  </View>
                </View>
              </View>

              {loadingInfo || (Platform.OS === 'ios' && iap.loading) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>
                    Loading subscription information...
                  </Text>
                </View>
              ) : (
                <View style={styles.cardBody}>
                  {successMessage && (
                    <View
                      style={[
                        styles.successContainer,
                        {
                          backgroundColor: theme.successBackground,
                          borderColor: theme.successBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.successText,
                          { color: theme.successText },
                        ]}
                      >
                        {successMessage}
                      </Text>
                    </View>
                  )}

                  {error && (
                    <View
                      style={[
                        styles.errorContainer,
                        {
                          backgroundColor: theme.errorBackground,
                          borderColor: theme.errorBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.errorText, { color: theme.errorText }]}
                      >
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Plan Info Section */}
                  <View style={styles.planHeaderSection}>
                    <Flower type="sunflower" size={32} />
                    <View style={styles.planTitleWrapper}>
                      <Text
                        style={[
                          styles.planNameText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        {planName}
                      </Text>
                      <Text
                        style={[
                          styles.planDescriptionText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {sandbox.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.priceBadge,
                        {
                          backgroundColor: theme.priceBadgeBackground,
                          borderColor: theme.priceBadgeBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priceBadgeText,
                          { color: theme.priceBadgeText },
                        ]}
                      >
                        {planPrice}
                      </Text>
                    </View>
                  </View>

                  {/* Benefits List */}
                  <View style={styles.benefitsSection}>
                    <View style={styles.benefitItem}>
                      <Text
                        style={[
                          styles.benefitCheck,
                          { color: theme.tabBarFocused },
                        ]}
                      >
                        ✓
                      </Text>
                      <Text
                        style={[
                          styles.benefitText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Premium Flower Colors
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Text
                        style={[
                          styles.benefitCheck,
                          { color: theme.tabBarFocused },
                        ]}
                      >
                        ✓
                      </Text>
                      <Text
                        style={[
                          styles.benefitText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Plant Up to 50 Flowers
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Text
                        style={[
                          styles.benefitCheck,
                          { color: theme.tabBarFocused },
                        ]}
                      >
                        ✓
                      </Text>
                      <Text
                        style={[
                          styles.benefitText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Special Flower Varieties
                      </Text>
                    </View>
                  </View>

                  {/* Subscribed details */}
                  {isSubscribed && (
                    <View
                      style={[
                        styles.detailsCard,
                        {
                          backgroundColor: theme.planCardBackground,
                          borderColor: theme.planCardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailsTitle,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Subscription Details
                      </Text>
                      <View style={styles.detailsRow}>
                        <Text
                          style={[
                            styles.detailsLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Current Plan:
                        </Text>
                        <Text
                          style={[
                            styles.detailsValue,
                            { color: theme.successText, fontWeight: '600' },
                          ]}
                        >
                          {currentPlan}
                        </Text>
                      </View>
                      {subscription?.current_period_end && (
                        <View style={styles.detailsRow}>
                          <Text
                            style={[
                              styles.detailsLabel,
                              { color: theme.textSecondary },
                            ]}
                          >
                            Renews on:
                          </Text>
                          <Text
                            style={[
                              styles.detailsValue,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {formatDate(subscription.current_period_end)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Main Action CTA */}
                  {!isSubscribed ? (
                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleSubscribe}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>Subscribe Now</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.thankYouContainer}>
                      <Text
                        style={[
                          styles.thankYouText,
                          { color: theme.successText },
                        ]}
                      >
                        Thank you for your support!
                      </Text>
                      <Text
                        style={[
                          styles.enjoyText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Enjoy your premium features!
                      </Text>
                    </View>
                  )}

                  {/* Restore button (iOS only) */}
                  {Platform.OS === 'ios' && !isSubscribed && (
                    <TouchableOpacity
                      style={styles.restoreButton}
                      onPress={handleRestore}
                    >
                      <Text
                        style={[
                          styles.restoreText,
                          { color: theme.tabBarFocused },
                        ]}
                      >
                        Restore Purchases
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Divider to separate disclosures */}
                  <View
                    style={[
                      styles.divider,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  />

                  {/* Disclosures section */}
                  <View style={styles.disclosuresContainer}>
                    <Text
                      style={[
                        styles.renewalTermsText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Auto-renewable subscription · 1 month · {planPrice}.
                      Renews automatically unless cancelled at least 24 hours
                      before the end of the current period. Manage or cancel
                      anytime in your App Store account settings.
                    </Text>

                    <View style={styles.legalLinks}>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                      >
                        <Text
                          style={[
                            styles.legalLinkText,
                            { color: theme.tabBarFocused },
                          ]}
                        >
                          Privacy Policy
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.legalSeparator,
                          { color: theme.textSecondary },
                        ]}
                      >
                        •
                      </Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
                      >
                        <Text
                          style={[
                            styles.legalLinkText,
                            { color: theme.tabBarFocused },
                          ]}
                        >
                          Terms of Use (EULA)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </BlurView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFEBCD',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  decorativeFlowers: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    zIndex: 2,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 150,
  },
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  cardBlur: {
    width: '100%',
    backgroundColor:
      Platform.OS === 'android'
        ? 'rgba(255, 255, 255, 0.92)'
        : 'rgba(255, 255, 255, 0.55)',
  },
  cardHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  statusChipContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardBody: {
    padding: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  successContainer: {
    backgroundColor: '#DCFCE7',
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  successText: {
    color: '#166534',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  planHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  planTitleWrapper: {
    flex: 1,
  },
  planNameText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  planDescriptionText: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 20,
  },
  priceBadge: {
    backgroundColor: 'rgba(255, 240, 219, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 213, 153, 0.8)',
  },
  priceBadgeText: {
    color: '#B86E00',
    fontWeight: 'bold',
    fontSize: 16,
  },
  benefitsSection: {
    marginBottom: 24,
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitCheck: {
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
  },
  benefitText: {
    fontSize: 16,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsLabel: {
    fontSize: 14,
  },
  detailsValue: {
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  thankYouContainer: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  thankYouText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  enjoyText: {
    fontSize: 16,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  restoreText: {
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  disclosuresContainer: {
    gap: 12,
  },
  renewalTermsText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLinkText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 14,
  },
});
