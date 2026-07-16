const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'production';
const useTestCatalog = appEnv === 'development' || appEnv === 'test';

export const products = {
  sandbox: {
    id: useTestCatalog ? 'prod_Ta0G1DesriQyUx' : 'prod_S6e967ZpzPhGdd', // "A nice sandbox to play in" product
    name: 'A nice sandbox to play in',
    description: 'Get access to our sandbox environment',
    price: '$1.00/month',
    priceId: useTestCatalog ? 'price_1Ta0GlDesriQyUxdBSihLO58' : 'price_1RCQr6DesriQyUxd0aR0MNGG', // Sandbox subscription price ID
    mode: 'subscription' as const,
  },
  donation: {
    id: 'prod_S6eB9eAVlOPA2N', // "Donation to the cause" product
    name: 'Donation to the cause',
    description: 'Support our project with a one-time donation',
    price: 'Suggested: $4.20 (or custom amount)',
    priceId: 'price_1RCQskDesriQyUxdWlqf7eQZ', // Donation payment price ID
    mode: 'payment' as const,
  },
} as const;
