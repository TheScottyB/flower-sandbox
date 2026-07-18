import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  type ThemeMode,
  useThemeColors,
  useThemeMode,
} from '@/src/hooks/useThemeColors';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/src/legal';

export default function AboutScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const appVersion = Constants.expoConfig?.version ?? '1.0.1';
  const theme = useThemeColors();
  const { themeMode, setThemeMode, isDark } = useThemeMode();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingUser(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleDeleteAccount = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        Alert.alert(
          'Error',
          result.error ?? 'Failed to delete account. Please try again.',
        );
        return;
      }

      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Error deleting account:', err);
      Alert.alert(
        'Error',
        'Network error. Please check your connection and try again.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const flowerPositions = isWide
    ? [
        {
          type: 'tulip' as const,
          size: 80,
          position: { x: width * 0.08, y: 140 },
        },
        {
          type: 'daisy' as const,
          size: 70,
          position: { x: width * 0.88, y: 200 },
        },
        {
          type: 'rose' as const,
          size: 75,
          position: { x: width * 0.12, y: 440 },
        },
        {
          type: 'sunflower' as const,
          size: 85,
          position: { x: width * 0.84, y: 460 },
        },
      ]
    : [
        { type: 'tulip' as const, size: 60, position: { x: 25, y: 70 } },
        {
          type: 'daisy' as const,
          size: 50,
          position: { x: width - 65, y: 120 },
        },
        {
          type: 'rose' as const,
          size: 55,
          position: { x: width - 50, y: 310 },
        },
        { type: 'sunflower' as const, size: 60, position: { x: 30, y: 230 } },
      ];

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
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* App info card */}
          <View style={[styles.card, { borderColor: theme.cardBorder }]}>
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.cardBlur,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.cardBackground,
                },
              ]}
            >
              <View style={styles.cardInner}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  FlowerSandbox
                </Text>
                <Text
                  style={[styles.description, { color: theme.textSecondary }]}
                >
                  A peaceful little garden where you can plant and grow
                  beautiful flowers. Subscribe for premium colors, rare
                  varieties, and a larger garden.
                </Text>
                <Text style={[styles.version, { color: theme.versionText }]}>
                  Version {appVersion}
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
                  <Text style={styles.legalSeparator}>·</Text>
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
            </BlurView>
          </View>

          {/* Theme Settings card */}
          <View style={[styles.card, { borderColor: theme.cardBorder }]}>
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.cardBlur,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.cardBackground,
                },
              ]}
            >
              <View style={styles.cardInner}>
                <Text
                  style={[styles.sectionTitle, { color: theme.textPrimary }]}
                >
                  Theme
                </Text>

                <View
                  style={[
                    styles.themeRow,
                    {
                      backgroundColor: theme.statusBanner,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
                    const isSelected = themeMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.themeButton,
                          isSelected && {
                            backgroundColor: theme.buttonBackground,
                          },
                        ]}
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                          }
                          setThemeMode(mode);
                        }}
                      >
                        <Text
                          style={[
                            styles.themeButtonText,
                            {
                              color: isSelected
                                ? theme.buttonText
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </BlurView>
          </View>

          {/* Account card — only shown when signed in */}
          {!loadingUser && user && (
            <View style={[styles.card, { borderColor: theme.cardBorder }]}>
              <BlurView
                intensity={80}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.cardBlur,
                  {
                    borderColor: theme.cardBorder,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
              >
                <View style={styles.cardInner}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.textPrimary }]}
                  >
                    Account
                  </Text>

                  <View
                    style={[
                      styles.emailRow,
                      { backgroundColor: theme.statusBanner },
                    ]}
                  >
                    <Text
                      style={[
                        styles.emailLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Signed in as
                    </Text>
                    <Text
                      style={[styles.emailValue, { color: theme.textPrimary }]}
                      numberOfLines={1}
                    >
                      {user.email}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={handleSignOut}
                  >
                    <Text style={styles.signOutText}>Sign Out</Text>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.divider,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.08)',
                      },
                    ]}
                  />

                  <Text style={styles.dangerLabel}>Danger Zone</Text>
                  <TouchableOpacity
                    style={[
                      styles.deleteButton,
                      deletingAccount && styles.buttonDisabled,
                    ]}
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}
                  >
                    {deletingAccount ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.deleteText}>Delete Account</Text>
                    )}
                  </TouchableOpacity>
                  <Text
                    style={[styles.deleteHint, { color: theme.textSecondary }]}
                  >
                    Permanently removes your account and all data. Cannot be
                    undone.
                  </Text>
                </View>
              </BlurView>
            </View>
          )}

          {!loadingUser && !user && (
            <View style={[styles.card, { borderColor: theme.cardBorder }]}>
              <BlurView
                intensity={80}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.cardBlur,
                  {
                    borderColor: theme.cardBorder,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
              >
                <View style={styles.cardInner}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.textPrimary }]}
                  >
                    Account
                  </Text>
                  <Text
                    style={[styles.description, { color: theme.textSecondary }]}
                  >
                    Sign in to sync your subscription and garden layout across
                    multiple devices.
                  </Text>
                  <TouchableOpacity
                    style={styles.signInButton}
                    onPress={() => router.push('/login')}
                  >
                    <Text style={styles.signInText}>Sync Account</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          )}
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
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 110,
  },
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    width: '100%',
    maxWidth: 500,
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
  cardInner: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1A1A1A',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
    marginBottom: 12,
    textAlign: 'center',
  },
  version: {
    fontSize: 13,
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  legalLinkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    color: '#94A3B8',
    fontSize: 14,
  },
  themeRow: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  themeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emailRow: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 12,
    borderRadius: 12,
  },
  emailLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 24,
  },
  dangerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteHint: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
