import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { Eye, EyeOff, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Flower } from '@/src/components/Flower';
import { useThemeColors } from '@/src/hooks/useThemeColors';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const theme = useThemeColors();
  const scheme = useColorScheme();

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    // Add haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const getRedirectUrl = () => {
      if (Platform.OS === 'web') {
        return `${window.location.origin}/app/login`;
      }
      return 'https://flowersandbox.com/app/login';
    };

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      });

      if (error) {
        // Check for specific error codes and provide user-friendly messages
        if (error.message === 'User already registered') {
          setError(
            'An account with this email already exists. Please try logging in instead.',
          );
        } else {
          setError(error.message);
        }

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        // Success notification
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (data.session) {
          router.replace('/');
        } else {
          // Email confirmation is enabled — no session until the user confirms
          setInfo(
            'Account created! Check your email to confirm your address, then log in.',
          );
        }
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError(
        'Could not reach the server. Please check your connection and try again.',
      );
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
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
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <BlurView
              intensity={80}
              tint={scheme === 'dark' ? 'dark' : 'light'}
              style={[
                styles.cardBlur,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.cardBackground,
                },
              ]}
            >
              <View style={styles.cardInner}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor:
                        scheme === 'dark'
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  accessibilityLabel="Close"
                  activeOpacity={0.7}
                >
                  <X size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  Create Account
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Join our flower sandbox community
                </Text>

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
                      style={StyleSheet.flatten([
                        styles.errorText,
                        { color: theme.errorText },
                      ])}
                    >
                      {error}
                    </Text>
                  </View>
                )}

                {info && (
                  <View
                    style={[
                      styles.infoContainer,
                      {
                        backgroundColor: theme.successBackground,
                        borderColor: theme.successBorder,
                      },
                    ]}
                  >
                    <Text
                      style={StyleSheet.flatten([
                        styles.infoText,
                        { color: theme.successText },
                      ])}
                    >
                      {info}
                    </Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: theme.textSecondary }]}
                  >
                    Email
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.textInputBackground,
                        borderColor: theme.textInputBorder,
                        color: theme.textInputText,
                      },
                    ]}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.textInputPlaceholder}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text
                    style={[styles.inputLabel, { color: theme.textSecondary }]}
                  >
                    Password
                  </Text>
                  <View
                    style={[
                      styles.passwordInputWrapper,
                      {
                        backgroundColor: theme.textInputBackground,
                        borderColor: theme.textInputBorder,
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.passwordInput,
                        { color: theme.textInputText },
                      ]}
                      placeholder="Create a password"
                      placeholderTextColor={theme.textInputPlaceholder}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color={theme.textSecondary} />
                      ) : (
                        <Eye size={20} color={theme.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: theme.buttonBackground },
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleSignUp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Sign Up</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text
                    style={[styles.footerText, { color: theme.textSecondary }]}
                  >
                    Already have an account?{' '}
                  </Text>
                  <Link href="/login" style={styles.link}>
                    <Text
                      style={[styles.linkText, { color: theme.tabBarFocused }]}
                    >
                      Login
                    </Text>
                  </Link>
                </View>

                <View
                  style={[
                    styles.appInfo,
                    {
                      borderTopColor:
                        scheme === 'dark'
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <Text
                    style={[styles.appInfoText, { color: theme.textSecondary }]}
                  >
                    FlowerSandbox
                  </Text>
                </View>
              </View>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
    zIndex: 2,
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
    marginBottom: 8,
    textAlign: 'center',
    color: '#333333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333333',
  },
  eyeButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  footerText: {
    color: '#555555',
    fontSize: 16,
  },
  link: {
    padding: 0,
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  infoText: {
    color: '#166534',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  appInfoText: {
    color: '#999999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
