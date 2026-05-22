/**
 * Polyfills for React Native compatibility.
 * Must be imported (for side effects) before any other module that touches
 * URL/URLSearchParams or web streams.
 */

import 'react-native-url-polyfill/auto';
import 'web-streams-polyfill/ponyfill/es6';
