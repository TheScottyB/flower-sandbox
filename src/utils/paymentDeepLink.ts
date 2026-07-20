/**
 * Pure decision logic for incoming payment deep links.
 *
 * A deep link is attacker-controllable (any app/page can invoke the custom
 * scheme), so it must never be trusted to *declare* a payment successful. This
 * maps a parsed link to a navigation intent only; the subscription screen then
 * re-verifies real entitlement before showing any "subscribed" UI.
 */
export type PaymentDeepLink =
  | { type: 'subscription-return' }
  | { type: 'donation-success' }
  | { type: 'canceled-subscription' }
  | { type: 'canceled-other' }
  | { type: 'none' };

export function decidePaymentReturn(
  path: string | null | undefined,
  queryParams: Record<string, unknown> | null | undefined,
): PaymentDeepLink {
  const p = path ?? '';
  const q = queryParams ?? {};

  if (q.canceled === 'true') {
    return p.includes('subscription')
      ? { type: 'canceled-subscription' }
      : { type: 'canceled-other' };
  }

  if (q.session_id) {
    if (p.includes('subscription')) return { type: 'subscription-return' };
    if (p.includes('donation-success')) return { type: 'donation-success' };
  }

  return { type: 'none' };
}
