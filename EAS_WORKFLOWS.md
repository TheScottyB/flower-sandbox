# EAS Workflows

This document explains how to use EAS Workflows to automate build, submit, and update processes for this application.

## Available Workflows

### iOS Production Build
Automatically builds the iOS app for production when code is pushed to the main branch.
```
eas workflow:run build-ios-production.yml
```
- **Trigger**: Automatic on push to `main` branch
- **Configuration**: Uses production profile for App Store distribution
- **App ID**: com.djscottyb.flowersandbox (App Store ID: 6772106139)

### Android Production Build
Automatically builds the Android app for production when code is pushed to the main branch.
```
eas workflow:run build-android-production.yml
```

### Submit iOS
Submits the latest completed iOS production build to App Store Connect.
```
eas workflow:run submit-ios.yml
```

### Build and Submit iOS
Runs checks, builds the iOS app, uploads it to App Store Connect, then runs the App Store Connect API review-submission script.
```
eas workflow:run build-and-submit-ios.yml
```

### Test and Build
Runs tests and builds preview versions for both iOS and Android when a pull request is created against the main branch.
```
eas workflow:run test-and-build.yml
```

### Publish Update
Sends an over-the-air update when code is pushed to any branch. The update will be published to a channel that matches the branch name.
```
eas workflow:run publish-update.yml
```

### Update Production
Updates the production app when code is pushed to the production branch.
```
eas workflow:run update-production.yml
```

## Setup Requirements

1. Link your GitHub repository to your EAS project:
   - Navigate to your project's GitHub settings
   - Follow the UI to install the GitHub app
   - Select this GitHub repository and connect it

2. App configuration:
   - Name: "FlowerSandbox"
   - Description: "playinginthesandbox"
   - iOS bundle ID: "com.djscottyb.flowersandbox" (explicit)
   - Android package name: "com.djscottyb.flowersandbox"
   - App ID Prefix: "3X872JR6P3" (Team ID)
   - App Store Connect App ID: "6772106139"
   - Apple ID: "beilsco@gmail.com"

3. All workflow files are configured in the `.eas/workflows/` directory
4. For App Review submission, add the `APP_STORE_CONNECT_*`, `APP_REVIEW_*`, and `APP_STORE_FIRST_IAP_ATTACHED` variables described in [APP_STORE_AUTOMATION.md](./APP_STORE_AUTOMATION.md) to the EAS production environment.

## Running Workflows Manually

You can manually trigger any workflow using the EAS CLI:

```
eas workflow:run <workflow-file.yml>
```

For example:
```
eas workflow:run build-ios-production.yml
```

## Workflow Types Reference

| Type | Description |
|------|-------------|
| `build` | Creates app builds (iOS/Android) |
| `submit` | Submits builds to app stores |
| `update` | Creates and publishes updates to EAS Update |
| `test` | Runs custom test scripts |

## Common Examples

### Building with different profiles
```yaml
build_development:
  name: Build Development
  type: build
  params:
    platform: ios
    profile: development
```

### Submitting to stores
```yaml
submit_ios:
  name: Submit iOS
  needs: build
  type: submit
  params:
    platform: ios
    profile: production
```

### Publishing updates
```yaml
update:
  name: Update Production
  type: update
  params:
    channel: production
    message: "Bug fixes and performance improvements"
```

### Running custom scripts
```yaml
test:
  name: Run Tests
  type: test
  script: |
    npm ci
    npm test
```
