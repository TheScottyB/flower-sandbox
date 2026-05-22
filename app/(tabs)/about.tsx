import { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, SafeAreaView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Flower } from '@/src/components/Flower';
import { BlurView } from 'expo-blur';

export default function AboutScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingUser(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

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
      const { data: { session } } = await supabase.auth.getSession();
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
        Alert.alert('Error', result.error ?? 'Failed to delete account. Please try again.');
        return;
      }

      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Error deleting account:', err);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const flowerPositions = isWide
    ? [
        { type: 'tulip' as const, size: 80, position: { x: width * 0.08, y: 140 } },
        { type: 'daisy' as const, size: 70, position: { x: width * 0.88, y: 200 } },
        { type: 'rose' as const, size: 75, position: { x: width * 0.12, y: 440 } },
        { type: 'sunflower' as const, size: 85, position: { x: width * 0.84, y: 460 } },
      ]
    : [
        { type: 'tulip' as const, size: 60, position: { x: 25, y: 70 } },
        { type: 'daisy' as const, size: 50, position: { x: width - 65, y: 120 } },
        { type: 'rose' as const, size: 55, position: { x: width - 50, y: 310 } },
        { type: 'sunflower' as const, size: 60, position: { x: 30, y: 230 } },
      ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#FFEBCD', '#FFF8E1']} style={styles.background} />

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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* App info card */}
          <View style={styles.card}>
            <BlurView intensity={80} tint="light" style={styles.cardBlur}>
              <View style={styles.cardInner}>
                <Text style={styles.title}>FlowerSandbox</Text>
                <Text style={styles.description}>
                  A peaceful little garden where you can plant and grow beautiful flowers. Subscribe for
                  premium colors, rare varieties, and a larger garden.
                </Text>
                <Text style={styles.version}>Version 1.0.0</Text>
              </View>
            </BlurView>
          </View>

          {/* Account card — only shown when signed in */}
          {!loadingUser && user && (
            <View style={styles.card}>
              <BlurView intensity={80} tint="light" style={styles.cardBlur}>
                <View style={styles.cardInner}>
                  <Text style={styles.sectionTitle}>Account</Text>

                  <View style={styles.emailRow}>
                    <Text style={styles.emailLabel}>Signed in as</Text>
                    <Text style={styles.emailValue} numberOfLines={1}>{user.email}</Text>
                  </View>

                  <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <Text style={styles.dangerLabel}>Danger Zone</Text>
                  <TouchableOpacity
                    style={[styles.deleteButton, deletingAccount && styles.buttonDisabled]}
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}>
                    {deletingAccount ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.deleteText}>Delete Account</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.deleteHint}>
                    Permanently removes your account and all data. Cannot be undone.
                  </Text>
                </View>
              </BlurView>
            </View>
          )}

          {!loadingUser && !user && (
            <View style={styles.card}>
              <BlurView intensity={80} tint="light" style={styles.cardBlur}>
                <View style={styles.cardInner}>
                  <Text style={styles.sectionTitle}>Account</Text>
                  <Text style={styles.description}>Sign in to manage your subscription and account.</Text>
                  <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/login')}>
                    <Text style={styles.signInText}>Sign In</Text>
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
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.55)',
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
