# App Store Automation

This repo now has a scripted path for iOS build upload and App Review submission.

## What the script does

`pnpm run app-store:release` performs:

1. Local `typecheck` and Jest.
2. `eas build --platform ios --profile production --auto-submit --non-interactive --wait`.
3. App Store Connect API lookup or creation of the iOS App Store version.
4. App Store Connect build processing polling.
5. Build attachment to the App Store version.
6. App Review detail create/update when env values are supplied.
7. Review submission creation, version item attachment, and final submit.

To only run the App Store Connect review-submission step after a build is already uploaded:

```bash
pnpm run app-store:submit-review
```

To upload a build but stop before final App Review submission:

```bash
pnpm run app-store:release -- --skip-review-submit
```

## Required local environment

Set these in `.env` or your shell before running the App Store Connect step:

```bash
APP_STORE_CONNECT_KEY_ID=...
APP_STORE_CONNECT_ISSUER_ID=...
APP_STORE_CONNECT_PRIVATE_KEY_PATH=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
APP_STORE_CONNECT_APP_ID=6772106139
APP_STORE_FIRST_IAP_ATTACHED=1

APP_REVIEW_CONTACT_FIRST_NAME=...
APP_REVIEW_CONTACT_LAST_NAME=...
APP_REVIEW_CONTACT_EMAIL=...
APP_REVIEW_CONTACT_PHONE=...
APP_REVIEW_DEMO_ACCOUNT_REQUIRED=false
APP_REVIEW_NOTES="Test the iOS subscription flow from the Premium Subscription screen and use Restore Purchases to validate restore behavior."
```

Use `APP_STORE_CONNECT_PRIVATE_KEY` instead of `APP_STORE_CONNECT_PRIVATE_KEY_PATH` if the private key is injected directly by CI.

## EAS workflows

Manual EAS workflow commands:

```bash
pnpm exec eas workflow:run build-ios-production.yml
pnpm exec eas workflow:run submit-ios.yml
pnpm exec eas workflow:run build-and-submit-ios.yml
```

`build-and-submit-ios.yml` runs checks, creates an iOS production build, uploads it to App Store Connect, then runs the review-submission script.

For that workflow to complete, add the App Store Connect env vars above to the EAS production environment as secrets/sensitive values. Do not commit `.p8` keys.

## First subscription/IAP guard

This app uses `com.djscottyb.flowersandbox.premium.monthly`. Apple requires the first subscription or IAP for an app to be submitted with a new app version. The public review submission API does not expose a relationship for attaching that first IAP/subscription to the version.

Before running the final review submission for the first time:

1. Complete the subscription price, localization, and App Review screenshot in App Store Connect.
2. Attach the subscription to the app version in the version page's In-App Purchases and Subscriptions section.
3. Set `APP_STORE_FIRST_IAP_ATTACHED=1`.

After the first IAP/subscription is approved, future app version submissions can run without that one-time browser step.
