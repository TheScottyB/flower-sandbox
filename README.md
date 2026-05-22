# FlowerSandbox - Premium Subscription App

A premium mobile application built with Expo and React Native, featuring Stripe integration for subscriptions and payments.

## Features

- 🔐 User authentication with Supabase
- 💳 Subscription management with Stripe
- 💸 One-time donation payments
- 🎨 Modern UI with animations and haptic feedback
- 📱 Cross-platform (iOS, Android, Web) support

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Expo CLI
- Supabase account
- Stripe account

### Installation

1. Clone the repository
```bash
git clone https://github.com/TheScottyB/flower-sandbox.git
cd flower-sandbox
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with the following variables:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Update the Stripe configuration in `src/stripe-config.ts` with your live product and price IDs from the Stripe dashboard.

## Environment Variables Management

This project uses EAS (Expo Application Services) for building and deploying with specific environment configurations.

### Environment Profiles

We have configured the following build environments in `eas.json`:

- **Development**: For local testing and development builds
- **Preview**: For internal testing with ad-hoc distribution
- **Production**: For App Store releases
- **Development-simulator**: For simulator testing

### Environment Variable Types

- **Public Variables** (in eas.json):
  - Prefixed with `EXPO_PUBLIC_`
  - Examples: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_APP_ENV`

- **Secret Variables** (using EAS secrets):
  - Set with `eas env:create`
  - Example: `SUPABASE_PROJECT_ID`

### Managing Environment Variables

```bash
# Set a secret variable
eas env:create --scope project --name VARIABLE_NAME --type string

# Pull variables for local development
eas env:pull --environment development

# Build with specific environment
eas build --platform ios --profile preview

# Publish updates with consistent environment
eas update --environment development
```

See `.env.template` for documentation on all environment variables used in this project.

### Running the App

```bash
# Start the development server
npm run dev

# Build for web
npm run build:web
```

## Deployment

### iOS App Store

1. Configure your app in `app.json`:
   - Update the bundleIdentifier
   - Add required permissions
   - Configure the splash screen and icons

2. Build the app:
```bash
eas build --platform ios
```

3. Submit to the App Store:
```bash
eas submit --platform ios
```

### Using EAS Workflows

This project supports automating builds, submissions, and updates using EAS Workflows. For detailed information, see the [EAS Workflows documentation](./EAS_WORKFLOWS.md).

Examples:
```bash
# Run iOS production build workflow
eas workflow:run build-ios-production.yml

# Run test and build workflow
eas workflow:run test-and-build.yml
```

## Supabase Edge Functions

This project uses Supabase Edge Functions for handling Stripe checkout and webhooks:

- `stripe-checkout`: Creates a checkout session for authenticated users
- `stripe-checkout-anonymous`: Creates a checkout session for one-time payments without requiring authentication
- `stripe-webhook`: Handles Stripe webhook events

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Expo](https://expo.dev/)
- [Supabase](https://supabase.io/)
- [Stripe](https://stripe.com/)
- [React Native](https://reactnative.dev/)