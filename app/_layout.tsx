// Import polyfills first to ensure they're loaded before any other code
import '@/src/utils/polyfills';

import * as Linking from 'expo-linking';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ThemeProvider, useThemeMode } from '@/src/hooks/useThemeColors';
import { decidePaymentReturn } from '@/src/utils/paymentDeepLink';

function ThemeAwareStatusBar() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const _segments = useSegments();

  // Handle deep links including payment returns
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        // Validate before parsing (throws on invalid URLs). Do NOT log the raw
        // URL or its params — they can carry session ids / auth tokens.
        new URL(event.url);

        const parsedUrl = Linking.parse(event.url);
        const decision = decidePaymentReturn(
          parsedUrl.path,
          parsedUrl.queryParams,
        );

        switch (decision.type) {
          case 'subscription-return':
            // Never assert success from an untrusted deep link; the screen
            // re-verifies real subscription status before celebrating.
            router.replace('/subscription');
            break;
          case 'donation-success':
            router.replace('/donation-success');
            break;
          case 'canceled-subscription':
            router.replace({
              pathname: '/subscription',
              params: { success: 'false' },
            });
            break;
          case 'canceled-other':
            router.replace('/');
            break;
          case 'none':
            break;
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
        // Handle invalid URLs gracefully, don't crash
        router.replace('/');
      }
    };

    // Set up the deep link handler
    if (Platform.OS !== 'web') {
      // Listen for incoming links when the app is running
      const subscription = Linking.addEventListener('url', handleDeepLink);

      // Handle links that opened the app
      Linking.getInitialURL().then((url) => {
        if (url) {
          handleDeepLink({ url });
        }
      });

      return () => {
        // Clean up the event listener
        subscription.remove();
      };
    }
  }, []);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <ThemeAwareStatusBar />
    </ThemeProvider>
  );
}
