import { describe, expect, it } from 'vitest';
import { buildAuthOptions } from '@/lib/supabase';

describe('buildAuthOptions', () => {
  it('enables detectSessionInUrl on web so redirect tokens are consumed and cleared', () => {
    expect(buildAuthOptions('web').detectSessionInUrl).toBe(true);
  });

  it('disables detectSessionInUrl on native (no URL bar)', () => {
    expect(buildAuthOptions('ios').detectSessionInUrl).toBe(false);
    expect(buildAuthOptions('android').detectSessionInUrl).toBe(false);
  });

  it('always persists the session and auto-refreshes', () => {
    const opts = buildAuthOptions('web');
    expect(opts.persistSession).toBe(true);
    expect(opts.autoRefreshToken).toBe(true);
  });
});
