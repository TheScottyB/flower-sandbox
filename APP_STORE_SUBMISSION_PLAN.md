# App Store Submission Plan - FlowerSandbox

## Prerequisites
- [x] Apple Developer Account (beilsco@gmail.com)
- [x] Team ID: 3X872JR6P3
- [x] Bundle ID registered: com.djscottyb.flowersandbox
- [x] App Store Connect app record created (ID: 6772106139)
- [x] ascAppId added to eas.json submit block

## 0. Create the App Store Connect App Record (current blocker)
1. Go to https://appstoreconnect.apple.com → My Apps → **+**
2. Fill in:
   - Platform: iOS
   - Name: FlowerSandbox
   - Primary language: English (U.S.)
   - Bundle ID: com.djscottyb.flowersandbox
   - SKU: FLOWERSANDBOX2026
3. ~~Save. Copy the numeric App ID from the URL.~~ **Done** — App ID: 6772106139
4. ~~Add it to `eas.json` under `submit.production.ios.ascAppId`.~~ **Done**
5. ~~Create the IAP subscription product.~~ **Done**
   - Product ID: `com.djscottyb.flowersandbox.premium.monthly`
   - Subscription Group ID: 22106738
   - Status: Missing Metadata — **still required before submission:**
     - Add a price tier (ASC → subscription → Subscription Prices)
     - Add English localization: Display Name + Description
       (ASC → subscription → Subscription Localizations → Create)

## 1. App Store Connect Setup
1. Login to App Store Connect (https://appstoreconnect.apple.com)
2. Confirm app information:
   - App Name: "FlowerSandbox"
   - Bundle ID: com.djscottyb.flowersandbox
   - SKU: FLOWERSANDBOX2026

## 2. Required Assets
- [ ] App Icon (1024x1024px PNG)
- [ ] Screenshots:
  - **Required**: iPhone 6.9" Display (iPhone 16 Pro Max): 1320x2868px
  - **Required**: iPad Pro 13" Display: 2064x2752px
  - *Optional*: iPhone 6.5" (1284x2778px) — only required if 6.9" screenshots are not provided
- [ ] App Preview Videos (optional)
- [ ] App Privacy Details
  - Data Collection Practices
  - Privacy Policy URL

## 3. App Store Listing Content
- [ ] App Description
- [ ] Keywords
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Copyright Information
- [ ] Contact Information
- [ ] Age Rating Documentation
- [ ] Price and Availability

## 4. Technical Requirements
- [x] Encryption Declaration (set in app.json: ITSAppUsesNonExemptEncryption = false)
- [x] No push notification entitlements (removed — not implemented)
- [x] IAP subscription product created (com.djscottyb.flowersandbox.premium.monthly)
- [ ] IAP subscription price tier set
- [ ] IAP subscription English localization added (display name + description)
- [ ] iOS sandbox purchase + restore tested on a real device

## 5. Build Submission Steps

> **Prerequisite**: complete Step 0 (ASC app record + ascAppId in eas.json) before submitting. For the scripted path, also see [APP_STORE_AUTOMATION.md](./APP_STORE_AUTOMATION.md).

1. Create production build:
   ```bash
   # Manual
   eas build --platform ios --profile production

   # Automated workflow
   eas workflow:run build-ios-production.yml
   ```

2. Submit build to App Store (only after ASC app record exists):
   ```bash
   # Manual — prompts for build ID
   eas submit --platform ios --profile production

   # Scripted build upload + App Review submission
   pnpm run app-store:release

   # EAS workflow equivalent
   eas workflow:run build-and-submit-ios.yml
   ```

3. Monitor build processing in App Store Connect

## 6. App Review Preparation
- [ ] Test Account Credentials (Apple Sandbox account for reviewer)
  - Username: (to be created in App Store Connect → Users & Access → Sandbox)
  - Password: (to be created)
- [ ] Demo Instructions
  - How to access all features
  - Test StoreKit subscription flow (iOS)
  - Test donation flow (web only — not available on iOS)

## 7. Post-Submission Plan
1. Monitor App Review Status
2. Prepare for Potential Rejection
   - Common reasons:
     - Missing privacy declarations
     - Incomplete functionality
     - Poor performance
3. Launch Preparation
   - Marketing materials
   - Support system ready
   - Analytics tracking set up

## 8. Important Compliance Notes
1. Subscription Requirements:
   - Clear terms and conditions
   - Transparent pricing
   - Easy cancellation process
2. Privacy Requirements:
   - Clear data usage explanation
   - User data protection measures
   - GDPR/CCPA compliance

## Timeline
1. Day 1: Asset Preparation
   - Create screenshots
   - Finalize app icon
   - Write app description

2. Day 2: Store Listing Setup
   - Complete App Store Connect information
   - Configure pricing
   - Set up privacy details

3. Day 3: Technical Submission
   - Generate production build
   - Submit to App Store
   - Provide test account

4. Days 4-7: Review Period
   - Monitor submission status
   - Be ready for expedited responses

## Command Reference
```bash
# Production build (manual)
eas build --platform ios --profile production

# Submit to App Store (manual, after ASC app record exists)
eas submit --platform ios --profile production

# Trigger build via automated workflow (push to main)
git push origin main

# Trigger build+submit via automated workflow (push to release)
git push origin release

# Check build status
eas build:list

# View build logs
eas build:view

# View workflow status
eas workflow:list

# Deploy Supabase edge functions
supabase functions deploy delete-account --project-ref srtlalaecgejgghwwfmk
```

## Contact Information
- Apple Developer Support: https://developer.apple.com/contact/
- App Review Team Contact: https://developer.apple.com/app-store/review/
- Your Apple Team ID: 3X872JR6P3

## Emergency Checklist
If app is rejected:
1. Read rejection reason carefully
2. Address all points in the rejection
3. Document changes made
4. Resubmit with detailed notes
5. Request expedited review if necessary

Remember: Keep all credentials and access tokens secure and never include them in the app's source code.
