/**
 * Polyfills for React Native compatibility
 * This file must be imported before any other imports in the entry point
 */

// URL and URLSearchParams polyfills for React Native
import 'react-native-url-polyfill/auto';

// Web Streams polyfill for Supabase in React Native
import 'web-streams-polyfill/ponyfill/es6';

// Log that polyfills have been initialized
console.log('Polyfills initialized');

// Export a dummy function to ensure the file is not tree-shaken
export const ensurePolyfills = () => {
  // Just to verify URL is properly polyfilled
  try {
    const url = new URL('https://example.com');
    console.log('URL polyfill is working correctly:', url.origin);
  } catch (error) {
    console.error('URL polyfill error:', error);
  }
};

