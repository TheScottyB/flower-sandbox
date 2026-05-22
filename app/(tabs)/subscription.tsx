import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform, Linking, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { products } from '@/src/stripe-config';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Flower } from '@/src/components/Flower';
import { useIAP } from '@/src/hooks/useIAP';

type SubscriptionStatus = {
  subscription_status: string;
  price_id: string | null;
  current_period_end: number | null;
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const { success } = useLocalSearchParams<{ success?: string }>();

  // ── iOS: StoreKit ──────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const iap = Platform.OS === 'ios' ? useIAP() : null;

  // ── Web/Android: Stripe ───────────────────────────────────────────────────
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(Platform.OS !== 'ios');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { sandbox } = products;

  // ── Unified subscription status ───────────────────────────────────────────
  const isSubscribed =
    Platform.OS === 'ios'
      ? (iap?.isSubscribed ?? false)
      : subscription?.subscription_status === 'active';

  const currentPlan = isSubscribed ? sandbox.name : 'No active subscription';

  // ── Stripe helpers (web / Android only) ───────────────────────────────────
  const getBaseUrl = () => {
    if (Platform.OS === 'web') return window.location.origin;
    if (__DEV__)
      return Constants.expoConfig?.hostUri
        ? `http://${Constants.expoConfig.hostUri}`
        : 'http://localhost:8081';
    return 'flowersandbox://';
  };

  useEffect(() => {
    if (Platform.OS === 'ios') return; // IAP hook handles iOS

    if (success === 'true') {
      setSuccessMessage('Your subscription was successfully activated!');
    } else if (success === 'false') {
      setError('The subscription process was cancelled.');
    }
    fetchStripeSubscription();
  }, [success]);

  // Surface IAP errors in the shared error state
  useEffect(() => {
    if (iap?.error) setError(iap.error);
  }, [iap?.error]);

  const fetchStripeSubscription = async () => {
    setLoadingInfo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSubscription(null); return; }

      const { data, error: dbErr } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status, price_id, current_period_end')
        .maybeSingle();

      if (dbErr) throw dbErr;
      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      const { data: { session } } = await supabase.auth
        .getSession()
        .catch(() => ({ data: { session: null } }));
      if (session) setError('Failed to load subscription status. Please try again.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleStripeSubscribe = async () => {
    setStripeLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) { router.push('/login'); return; }

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
      iap?.purchaseSubscription();
    } else {
      handleStripeSubscribe();
    }
  };

  const handleRestore = () => {
    iap?.restorePurchases();
  };

  const loading = Platform.OS === 'ios' ? (iap?.loading ?? true) : stripeLoading;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FFEBCD', '#FFF8E1']}
        style={styles.background}
      />
      
      {/* Decorative flowers */}
      <View style={styles.decorativeFlowers}>
        <Flower type="sunflower" size={80} position={{ x: 50, y: 80 }} />
        <Flower type="rose" size={70} position={{ x: 320, y: 150 }} />
        <Flower type="daisy" size={60} position={{ x: 280, y: 70 }} />
        <Flower type="tulip" size={65} position={{ x: 120, y: 170 }} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>Premium Subscription</Text>
            </View>
            
            {(loadingInfo || (Platform.OS === 'ios' && iap?.loading)) ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading subscription information...</Text>
              </View>
            ) : (
              <>
                {successMessage && (
                  <View style={styles.successContainer}>
                    <Text style={styles.successText}>{successMessage}</Text>
                  </View>
                )}
                
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                
                <View style={styles.statusBanner}>
                  <Text style={styles.statusLabel}>Status:</Text>
                  <Text style={[styles.statusValue, isSubscribed ? styles.activeText : styles.inactiveText]}>
                    {isSubscribed ? 'Active' : 'Not Subscribed'}
                  </Text>
                </View>
                
                <View style={styles.planCard}>
                  <View style={styles.flowerIconContainer}>
                    <Flower type="sunflower" size={50} />
                  </View>
                  
                  <View style={styles.planHeaderContainer}>
                    <Text style={styles.planName}>{sandbox.name}</Text>
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceBadgeText}>{sandbox.price}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.planDescription}>{sandbox.description}</Text>
                  
                  <View style={styles.benefitsList}>
                    <View style={styles.benefitItem}>
                      <Text style={styles.benefitCheck}>✓</Text>
                      <Text style={styles.benefitText}>Premium Flower Colors</Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Text style={styles.benefitCheck}>✓</Text>
                      <Text style={styles.benefitText}>Plant Up to 50 Flowers</Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <Text style={styles.benefitCheck}>✓</Text>
                      <Text style={styles.benefitText}>Special Flower Varieties</Text>
                    </View>
                  </View>
                </View>

                {isSubscribed && (
                  <View style={styles.statusCard}>
                    <Text style={styles.statusTitle}>Subscription Details</Text>
                    
                    <View style={styles.infoItem}>
                      <Text style={styles.label}>Current Plan:</Text>
                      <Text style={styles.value}>
                        <Text style={styles.activeStatus}>{currentPlan}</Text>
                      </Text>
                    </View>

                    {subscription?.current_period_end && (
                      <View style={styles.infoItem}>
                        <Text style={styles.label}>Renews on:</Text>
                        <Text style={styles.value}>
                          {formatDate(subscription.current_period_end)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {!isSubscribed && (
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubscribe}
                    disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>Subscribe Now</Text>
                    )}
                  </TouchableOpacity>
                )}
                
                {isSubscribed && (
                  <View style={styles.thankYouContainer}>
                    <Text style={styles.thankYouText}>Thank you for your support!</Text>
                    <Text style={styles.enjoyText}>Enjoy your premium features!</Text>
                  </View>
                )}

                {/* Restore Purchases — required by Apple for IAP apps */}
                {Platform.OS === 'ios' && !isSubscribed && (
                  <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
                    <Text style={styles.restoreText}>Restore Purchases</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
    paddingVertical: 20,
  },
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
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
    margin: 16,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555555',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeText: {
    color: '#059669',
  },
  inactiveText: {
    color: '#9CA3AF',
  },
  flowerIconContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  planCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFE4B5',
    shadowColor: '#E2A76F',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  planHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceBadge: {
    backgroundColor: '#FFF0DB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFD599',
  },
  priceBadgeText: {
    color: '#B86E00',
    fontWeight: 'bold',
    fontSize: 16,
  },
  benefitsList: {
    marginTop: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitCheck: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
  },
  benefitText: {
    fontSize: 16,
    color: '#1F2937',
  },
  statusCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    color: '#1F2937',
  },
  activeStatus: {
    fontWeight: '600',
    color: '#059669',
  },
  inactiveStatus: {
    fontWeight: '500',
    color: '#9CA3AF',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    margin: 16,
    marginTop: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    margin: 16,
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
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  planDescription: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0EA5E9',
    marginTop: 12,
  },
  thankYouContainer: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  thankYouText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
  },
  enjoyText: {
    fontSize: 16,
    color: '#64748B',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  restoreText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
