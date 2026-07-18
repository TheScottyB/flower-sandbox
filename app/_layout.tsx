// Import polyfills first to ensure they're loaded before any other code
import '@/src/utils/polyfills';

import * as Linking from 'expo-linking';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ThemeProvider, useThemeMode } from '@/src/hooks/useThemeColors';

function ThemeAwareStatusBar() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const _segments = useSegments();

  // Handle deep links including payment returns
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);

      try {
        // Verify URL is valid before parsing
        new URL(url); // This will throw if the URL is invalid

        // Parse the URL using Expo Linking
        const parsedUrl = Linking.parse(url);
        console.log('Parsed deep link:', parsedUrl);

        // Handle successful payment return
        if (parsedUrl.queryParams?.session_id) {
          const sessionId = parsedUrl.queryParams.session_id;
          console.log('Payment session ID:', sessionId);

          if (parsedUrl.path?.includes('subscription')) {
            router.replace({
              pathname: '/subscription',
              params: { success: 'true', session_id: sessionId },
            });
          } else if (parsedUrl.path?.includes('donation-success')) {
            router.replace('/donation-success');
          }
        }

        // Handle canceled payment
        if (
          parsedUrl.queryParams &&
          parsedUrl.queryParams.canceled === 'true'
        ) {
          console.log('Payment was canceled');

          if (parsedUrl.path?.includes('subscription')) {
            router.replace({
              pathname: '/subscription',
              params: { success: 'false' },
            });
          } else {
            router.replace('/');
          }
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
