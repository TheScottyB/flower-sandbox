import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist sessions across app restarts on native (canonical Expo + Supabase pattern).
    // Without this, users sign out on every cold launch — App Review will see it.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // RN has no URL bar; the default `true` makes Supabase parse `window.location`
    // every navigation, which throws or does nothing on native.
    detectSessionInUrl: false,
  },
});