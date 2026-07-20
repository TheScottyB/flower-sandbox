import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );
}

/**
 * Auth options for the Supabase client. Extracted (and platform-parameterised)
 * so the web-vs-native session-detection decision is unit-testable.
 */
export function buildAuthOptions(platformOS: string) {
  return {
    // Persist sessions across app restarts on native (canonical Expo + Supabase
    // pattern). Without this, users sign out on every cold launch.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, Supabase must parse the tokens the confirmation/OAuth redirect
    // leaves in the URL, establish the session, and clear them from the address
    // bar + history (otherwise they linger and can be replayed from a shared
    // machine). Native has no URL bar, so leave detection off there.
    detectSessionInUrl: platformOS === 'web',
  };
}

// Lazy-initialise the client on first property access so module-evaluation
// time (cold start) doesn't pay the createClient setup cost. Real-world saving
// is small (~5-15ms) but free given the Proxy keeps the supabase.X API
// identical for all callers.
let _client: SupabaseClient | undefined;
function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: buildAuthOptions(Platform.OS),
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    return Reflect.get(getClient(), prop, getClient());
  },
});
