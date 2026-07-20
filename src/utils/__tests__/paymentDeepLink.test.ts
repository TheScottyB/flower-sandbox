import { describe, expect, it } from 'vitest';
import { decidePaymentReturn } from '@/src/utils/paymentDeepLink';

describe('decidePaymentReturn', () => {
  it('routes a subscription return to the screen WITHOUT asserting success', () => {
    // A forged deep link must not be able to declare a payment successful; the
    // screen re-verifies real subscription status instead.
    const decision = decidePaymentReturn('subscription', {
      session_id: 'cs_fake',
    });
    expect(decision).toEqual({ type: 'subscription-return' });
    // The decision never carries a success flag derived from the URL.
    expect(JSON.stringify(decision)).not.toContain('success');
  });

  it('routes a donation-success return to the donation screen', () => {
    expect(
      decidePaymentReturn('donation-success', { session_id: 'cs_1' }),
    ).toEqual({
      type: 'donation-success',
    });
  });

  it('treats canceled=true on the subscription path as a subscription cancel', () => {
    expect(decidePaymentReturn('subscription', { canceled: 'true' })).toEqual({
      type: 'canceled-subscription',
    });
  });

  it('treats canceled=true elsewhere as a generic cancel', () => {
    expect(decidePaymentReturn('', { canceled: 'true' })).toEqual({
      type: 'canceled-other',
    });
  });

  it('ignores links with no session_id and no cancel flag', () => {
    expect(decidePaymentReturn('subscription', {})).toEqual({ type: 'none' });
    expect(decidePaymentReturn(null, null)).toEqual({ type: 'none' });
  });
});
