import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { Eye, EyeOff, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
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

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!password) {
      setError('Password is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!validateForm()) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setLoading(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        // Login successful
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.replace('/');
      }
    } catch (_err) {
      setError('An unexpected error occurred. Please try again later.');
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

  return (
    <SafeAreaView style={styles.safeArea}>
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

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
                    Welcome Back
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: theme.textSecondary }]}
                  >
                    Sign in to continue
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

                  <View style={styles.inputContainer}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: theme.textSecondary },
                      ]}
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
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: theme.textSecondary },
                      ]}
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
                        ref={passwordRef}
                        style={[
                          styles.passwordInput,
                          { color: theme.textInputText },
                        ]}
                        placeholder="Enter your password"
                        placeholderTextColor={theme.textInputPlaceholder}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
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
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>Sign In</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.forgotPassword}>
                    <Text
                      style={[
                        styles.forgotPasswordText,
                        { color: theme.tabBarFocused },
                      ]}
                    >
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View
                      style={[
                        styles.dividerLine,
                        {
                          backgroundColor:
                            scheme === 'dark'
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.dividerText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      OR
                    </Text>
                    <View
                      style={[
                        styles.dividerLine,
                        {
                          backgroundColor:
                            scheme === 'dark'
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.footer}>
                    <Text
                      style={[
                        styles.footerText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Don't have an account?{' '}
                    </Text>
                    <Link href="/signup" style={styles.link}>
                      <Text
                        style={[
                          styles.linkText,
                          { color: theme.tabBarFocused },
                        ]}
                      >
                        Sign up
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
                      style={[
                        styles.appInfoText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      FlowerSandbox
                    </Text>
                  </View>
                </View>
              </BlurView>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
    zIndex: 2,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
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
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
  },
  forgotPasswordText: {
    color: '#3182CE',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  dividerText: {
    color: '#A0AEC0',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
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
