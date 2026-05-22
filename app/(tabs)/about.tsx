import { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export default function AboutScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#FFEBCD', '#FFF8E1']} style={styles.background} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* App info card */}
        <View style={styles.card}>
          <Text style={styles.title}>FlowerSandbox</Text>
          <Text style={styles.description}>
            A peaceful little garden where you can plant and grow beautiful flowers. Subscribe for
            premium colors, rare varieties, and a larger garden.
          </Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        {/* Account card — only shown when signed in */}
        {!loadingUser && user && (
          <View style={styles.card}>
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
        )}

        {!loadingUser && !user && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Text style={styles.description}>Sign in to manage your subscription and account.</Text>
            <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/login')}>
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
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
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1A1A1A',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1A1A1A',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
    marginBottom: 8,
  },
  version: {
    fontSize: 13,
    color: '#999999',
    marginTop: 8,
  },
  emailRow: {
    marginBottom: 20,
  },
  emailLabel: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginBottom: 20,
  },
  dangerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteHint: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
