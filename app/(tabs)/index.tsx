import { StyleSheet, Text, View, TouchableOpacity, Platform, Linking, ActivityIndicator, ScrollView, SafeAreaView } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { products } from '@/src/stripe-config';
import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { FlowerField } from '@/src/components/FlowerField';
import { useIAP } from '@/src/hooks/useIAP';

export default function HomeScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stripeIsPremium, setStripeIsPremium] = useState(false);
  const [flowerCount, setFlowerCount] = useState(0);

  // iOS: read premium status from StoreKit. useIAP no-ops on non-iOS,
  // so it's always safe to call unconditionally.
  const iap = useIAP();
  const isPremium = Platform.OS === 'ios' ? iap.isSubscribed : stripeIsPremium;

  useEffect(() => {
    // Check if user is signed in
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUser(data.session.user);

        // Web/Android: check Stripe subscription status from Supabase
        if (Platform.OS !== 'ios') {
          try {
            const { data: subscriptionData } = await supabase
              .from('stripe_user_subscriptions')
              .select('subscription_status')
              .eq('user_id', data.session.user.id)
              .maybeSingle();
              
            setStripeIsPremium(subscriptionData?.subscription_status === 'active');
          } catch (error) {
            console.error('Error checking subscription status:', error);
          }
        }
      }
    };
    
    checkUser();
  }, []);

  const getBaseUrl = () => {
    if (Platform.OS === 'web') {
      return window.location.origin;
    }
    // For development
    if (__DEV__) {
      return Constants.expoConfig?.hostUri 
        ? `http://${Constants.expoConfig.hostUri}`
        : 'http://localhost:8081';
    }
    // For production — deep link back into the app
    return 'flowersandbox://';
  };

  const handleDonate = async () => {
    setError(null);
    setLoading(true);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const baseUrl = getBaseUrl();
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-checkout-anonymous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          price_id: products.donation.priceId,
          mode: products.donation.mode,
          success_url: `${baseUrl}/donation-success`,
          cancel_url: `${baseUrl}/`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Checkout error:', data);
        setError(data.error || 'Failed to process donation. Please try again.');
        return;
      }

      const { url, sessionId } = data;
      
      console.log('Received checkout session data:', { url, sessionId });
      
      if (url) {
        if (Platform.OS === 'web') {
          console.log('Redirecting to Stripe checkout on web:', url);
          window.location.href = url;
        } else {
          console.log('Opening Stripe checkout URL on mobile:', url);
          try {
            await Linking.openURL(url);
          } catch (linkError) {
            console.error('Error opening URL:', linkError);
            setError('Unable to open payment page. Please try again.');
          }
        }
      } else {
        console.error('No checkout URL returned from server');
        setError('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Track flower planting
  const handleFlowerPlanted = () => {
    setFlowerCount(prev => prev + 1);
    
    // Give haptic feedback on real devices
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlowerField 
          count={isPremium ? 10 : 5}
          isPremium={isPremium}
          maxFlowers={isPremium ? 50 : 15}
          onAddFlower={handleFlowerPlanted}
        />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <BlurView intensity={80} tint="light" style={styles.contentWrapper}>
            <View style={styles.header}>
              <Text style={styles.welcomeText}>
                {user ? `Welcome, ${user.email?.split('@')[0]}` : 'Welcome to the Sandbox'}
              </Text>
              {!user && (
                <Link href="/login" style={styles.loginLink}>
                  <Text style={styles.loginText}>Login</Text>
                </Link>
              )}
            </View>
            
            <View style={styles.content}>
              <Text style={styles.titleText}>FlowerSandbox</Text>
              <Text style={styles.subtitle}>
                Tap anywhere to plant flowers {isPremium && "- Premium Mode Active!"}
              </Text>
              
              <Text style={styles.flowerCount}>
                Flowers planted: {flowerCount}
              </Text>
              
              {error && (
                <BlurView intensity={80} tint="light" style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </BlurView>
              )}
              
              <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureTitle}>✓ Beautiful Flowers</Text>
                  <Text style={styles.featureDescription}>Plant different types of flowers in your sandbox</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureTitle}>✓ {isPremium ? 'Premium Colors (Active)' : 'Premium Colors'}</Text>
                  <Text style={styles.featureDescription}>Subscribe for unique flower colors and varieties</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureTitle}>✓ {isPremium ? 'Extra Flowers (Active)' : 'Extra Flowers'}</Text>
                  <Text style={styles.featureDescription}>Plant up to {isPremium ? '50' : '15'} flowers in your garden</Text>
                </View>
              </View>
              
              <View style={styles.buttonContainer}>
                <Link href="/subscription" onPress={handleSubscribe}>
                  <TouchableOpacity
                    style={[
                      styles.subscribeButton,
                      Platform.select({
                        web: styles.buttonWeb,
                        default: {}
                      }),
                      isPremium && styles.subscribedButton
                    ]}>
                    <Text style={styles.buttonText}>
                      {isPremium ? 'Premium Active' : 'Subscribe Now'}
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
              
              {/* Donation via Stripe — web/Android only; removed from iOS (Apple IAP policy) */}
              {Platform.OS !== 'ios' && (
                <TouchableOpacity
                  style={[
                    styles.donateButton,
                    Platform.select({
                      web: styles.buttonWeb,
                      default: {}
                    }),
                    loading && styles.buttonDisabled
                  ]}
                  onPress={handleDonate}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Support Us</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFEBCD',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 500,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  contentWrapper: {
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  welcomeText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    padding: 8,
  },
  loginText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 12,
  },
  flowerCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A6FA5',
    marginBottom: 24,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  featureItem: {
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
  },
  buttonContainer: {
    marginBottom: 16,
    width: '100%',
    maxWidth: 280,
  },
  subscribeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%',
  },
  subscribedButton: {
    backgroundColor: '#5AC8FA',
  },
  donateButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%',
    maxWidth: 280,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonWeb: Platform.OS === 'web' ? {
    cursor: 'pointer',
    // Web-specific styles need to be handled differently
    // since React Native StyleSheet doesn't support some web properties
  } : {},
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});