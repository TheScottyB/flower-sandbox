import { describe, expect, it } from 'vitest';
import { isEntitledStatus } from '@/src/stripe-config';

describe('isEntitledStatus', () => {
  it('treats active as entitled', () => {
    expect(isEntitledStatus('active')).toBe(true);
  });

  it('treats trialing as entitled (paying customer in trial)', () => {
    expect(isEntitledStatus('trialing')).toBe(true);
  });

  it('treats past_due as entitled (still live during dunning)', () => {
    expect(isEntitledStatus('past_due')).toBe(true);
  });

  it('does not treat canceled as entitled', () => {
    expect(isEntitledStatus('canceled')).toBe(false);
  });

  it('does not treat not_started as entitled', () => {
    expect(isEntitledStatus('not_started')).toBe(false);
  });

  it('handles null/undefined safely', () => {
    expect(isEntitledStatus(null)).toBe(false);
    expect(isEntitledStatus(undefined)).toBe(false);
  });
});
