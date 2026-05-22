# App Store Submission Checklist 2024

## Required Screenshots
- [ ] iPhone 14 Pro Max (6.7"): 1290 x 2796
  - [ ] Home screen
  - [ ] Subscription view
  - [ ] Sandbox play area
  - [ ] Donation screen
- [ ] iPad Pro (if supporting iPad): 2048 x 2732
  - [ ] Same screens as iPhone

## App Store Information
- [ ] App Name: "FlowerSandbox"
- [ ] Subtitle (30 characters max)
- [ ] Privacy Policy URL (need to host PRIVACY_POLICY.md)
- [ ] Terms of Service URL (need to host TERMS_OF_SERVICE.md)
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Keywords (100 characters max)
- [ ] Description (4000 characters max)
- [ ] Price: Free with IAP

## In-App Purchases
- [x] Sandbox Subscription ($1.00/month)
- [x] Donation (Variable amount, suggested $4.20)

## App Review Information
- [ ] Test Account
  - Email: (to be created)
  - Password: (to be created)
- [ ] Test Instructions
  - How to access sandbox
  - How to make donation
  - How to subscribe

## Technical Requirements
- [x] iOS 17 Support
- [x] iPhone Support
- [x] iPad Support
- [x] Dark/Light Mode
- [x] Privacy Declarations
- [x] No Encryption (declared)

## Privacy Requirements
- [x] Privacy Policy
- [x] Data Collection Transparency
- [x] User Data Protection
- [x] Tracking Permission Dialog

## Build Information
- [x] Version: 1.0.0
- [x] Build: 1
- [x] Bundle ID: com.djscottyb.flowersandbox
- [x] SDK: Latest Expo
- [x] Minimum iOS: 17.0

## App Store Connect Setup
- [x] App ID: 6477183822
- [x] Apple Team ID: 3X872JR6P3
- [ ] Age Rating Questionnaire
- [ ] Content Rights Declaration

## Required Actions Before Submission
1. [ ] Host Privacy Policy and Terms online
2. [ ] Create test account
3. [ ] Generate screenshots
4. [ ] Complete app metadata
5. [ ] Fill App Store promotional text
6. [ ] Test complete user flows
7. [ ] Verify all IAPs work
8. [ ] Check app performance
9. [ ] Validate accessibility features

## Final Verification
- [ ] App icon meets requirements (1024x1024)
- [ ] All URLs are live and accessible
- [ ] Test account works
- [ ] No placeholder content
- [ ] All required fields in App Store Connect completed

## Post-Submission Plan
1. [ ] Monitor review status
2. [ ] Prepare marketing materials
3. [ ] Set up customer support
4. [ ] Configure analytics
5. [ ] Plan post-launch updates

## Submission Command
```bash
eas build --platform ios --profile production && eas submit --platform ios
```

Note: Keep this checklist updated as items are completed. Use it as a reference during the submission process.
