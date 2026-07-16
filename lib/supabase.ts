import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );
}

// Lazy-initialise the client on first property access so module-evaluation
// time (cold start) doesn't pay the createClient setup cost. Real-world saving
// is small (~5-15ms) but free given the Proxy keeps the supabase.X API
// identical for all callers.
let _client: SupabaseClient | undefined;
function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(supabaseUrl!, supabaseAnonKey!, {
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
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    return Reflect.get(getClient(), prop, getClient());
  },
});
