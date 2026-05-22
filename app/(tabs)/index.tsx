import { StyleSheet, Text, View, TouchableOpacity, Platform, Linking, ActivityIndicator, ScrollView, SafeAreaView, useWindowDimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { products } from '@/src/stripe-config';
import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { FlowerField } from '@/src/components/FlowerField';
import { useIAP } from '@/src/hooks/useIAP';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { ChevronUp, ChevronDown, Sparkles, Heart, CheckCircle2, User, LogIn } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stripeIsPremium, setStripeIsPremium] = useState(false);
  const [flowerCount, setFlowerCount] = useState(0);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  // iOS: read premium status from StoreKit.
  const iap = useIAP();
  const isPremium = Platform.OS === 'ios' ? iap.isSubscribed : stripeIsPremium;

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUser(data.session.user);

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
    if (__DEV__) {
      return Constants.expoConfig?.hostUri 
        ? `http://${Constants.expoConfig.hostUri}`
        : 'http://localhost:8081';
    }
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
      
      if (url) {
        if (Platform.OS === 'web') {
          window.location.href = url;
        } else {
          try {
            await Linking.openURL(url);
          } catch (linkError) {
            setError('Unable to open payment page. Please try again.');
          }
        }
      } else {
        setError('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
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

  const handleFlowerPlanted = () => {
    setFlowerCount(prev => prev + 1);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const toggleDrawer = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDrawerExpanded(prev => !prev);
  };

  const animatedDrawerStyle = useAnimatedStyle(() => {
    // Drawer height is 450. When collapsed we translate by 390px, leaving 60px visible.
    const translateVal = drawerExpanded ? 0 : 390;
    return {
      transform: [
        { translateY: withSpring(translateVal, { damping: 18, stiffness: 150 }) }
      ]
    };
  });

  const renderContent = () => (
    <View style={styles.panelContent}>
      <Text style={styles.flowerCount}>
        🌸 Flowers planted: <Text style={styles.countNumber}>{flowerCount}</Text>
      </Text>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <CheckCircle2 size={18} color="#34C759" style={styles.featureIcon} />
          <View style={styles.featureTextWrapper}>
            <Text style={styles.featureTitle}>Beautiful Flowers</Text>
            <Text style={styles.featureDescription}>Plant multiple animated flower types in your garden.</Text>
          </View>
        </View>
        
        <View style={styles.featureItem}>
          <Sparkles size={18} color={isPremium ? "#FFD60A" : "#8E8E93"} style={styles.featureIcon} />
          <View style={styles.featureTextWrapper}>
            <Text style={styles.featureTitle}>
              Premium Colors {isPremium && "(Active)"}
            </Text>
            <Text style={styles.featureDescription}>Unlock unique HSL color gradients and rare varieties.</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <CheckCircle2 size={18} color="#34C759" style={styles.featureIcon} />
          <View style={styles.featureTextWrapper}>
            <Text style={styles.featureTitle}>
              Garden Expansion {isPremium && "(Active)"}
            </Text>
            <Text style={styles.featureDescription}>Plant up to {isPremium ? '50' : '15'} flowers in your garden.</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.buttonsWrapper}>
        <Link href="/subscription" onPress={handleSubscribe} asChild>
          <TouchableOpacity
            style={[
              styles.subscribeButton,
              isPremium && styles.subscribedButton
            ]}>
            <Sparkles size={20} color="#FFF" style={styles.btnIcon} />
            <Text style={styles.buttonText}>
              {isPremium ? 'Premium Active' : 'Subscribe Now'}
            </Text>
          </TouchableOpacity>
        </Link>
        
        {Platform.OS !== 'ios' && (
          <TouchableOpacity
            style={[
              styles.donateButton,
              loading && styles.buttonDisabled
            ]}
            onPress={handleDonate}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Heart size={20} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.buttonText}>Support Us</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlowerField 
          count={isPremium ? 10 : 5}
          isPremium={isPremium}
          maxFlowers={isPremium ? 50 : 15}
          onAddFlower={handleFlowerPlanted}
          rightOffset={isWide ? 350 : 0}
        />
        
        {isWide ? (
          /* Sidebar view for Web & Tablet */
          <View style={styles.sidebarContainer}>
            <BlurView intensity={80} tint="light" style={styles.sidebarBlur}>
              <View style={styles.sidebarHeader}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.titleText}>FlowerSandbox</Text>
                  {user ? (
                    <View style={styles.userBadge}>
                      <User size={14} color="#007AFF" />
                      <Text style={styles.userBadgeText} numberOfLines={1}>
                        {user.email?.split('@')[0]}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => router.push('/login')} style={styles.sidebarLoginBtn}>
                      <LogIn size={16} color="#007AFF" />
                      <Text style={styles.loginText}>Login</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.subtitle}>
                  Interact with the field on the left to plant and nurture your garden.
                </Text>
              </View>
              <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarScrollContent}>
                {renderContent()}
              </ScrollView>
            </BlurView>
          </View>
        ) : (
          /* Collapsible Bottom Drawer for Mobile */
          <Animated.View style={[styles.drawerContainer, animatedDrawerStyle]}>
            <BlurView intensity={85} tint="light" style={styles.drawerBlur}>
              <TouchableOpacity activeOpacity={0.9} onPress={toggleDrawer} style={styles.drawerHeader}>
                <View style={styles.dragHandle} />
                <View style={styles.drawerHeaderMain}>
                  <View style={styles.drawerTitleRow}>
                    <Text style={styles.drawerTitle}>FlowerSandbox</Text>
                    {user && (
                      <View style={styles.userBadgeMobile}>
                        <Text style={styles.userBadgeText} numberOfLines={1}>
                          {user.email?.split('@')[0]}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.drawerSubtitle}>
                    {flowerCount} planted • {drawerExpanded ? 'Tap to close' : 'Tap to expand features'}
                  </Text>
                </View>
                
                <View style={styles.headerButtons}>
                  {!user && (
                    <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginBtnMobile}>
                      <Text style={styles.loginTextMobile}>Login</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.chevronWrapper}>
                    {drawerExpanded ? <ChevronDown size={22} color="#555" /> : <ChevronUp size={22} color="#555" />}
                  </View>
                </View>
              </TouchableOpacity>
              
              <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent}>
                {renderContent()}
              </ScrollView>
            </BlurView>
          </Animated.View>
        )}
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
  // Mobile Bottom Drawer Styles
  drawerContainer: {
    position: 'absolute',
    bottom: 90, // Leave room for floating tab bar
    left: 16,
    right: 16,
    height: 450,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 90,
  },
  drawerBlur: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.65)',
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    flexDirection: 'row',
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -15,
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  drawerHeaderMain: {
    flex: 1,
    paddingTop: 8,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  drawerSubtitle: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  loginBtnMobile: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  loginTextMobile: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chevronWrapper: {
    padding: 4,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Desktop Sidebar Styles
  sidebarContainer: {
    position: 'absolute',
    right: 20,
    top: 20,
    bottom: 20,
    width: 350,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 90,
  },
  sidebarBlur: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  sidebarHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  sidebarWelcome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 18,
    marginTop: 4,
  },
  sidebarLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  loginText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  userBadgeText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    maxWidth: 140,
  },
  userBadgeMobile: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    padding: 24,
  },
  // Shared Panel Contents Styles
  panelContent: {
    gap: 20,
  },
  flowerCount: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4A5568',
  },
  countNumber: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 19,
  },
  featuresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    marginTop: 2,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
  },
  featureDescription: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 18,
    marginTop: 2,
  },
  buttonsWrapper: {
    gap: 12,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  subscribedButton: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53E3E',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  btnIcon: {
    marginRight: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(254, 226, 226, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#B7791F',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
});