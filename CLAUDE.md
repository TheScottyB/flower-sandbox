# CLAUDE.md - Project Guide for Agentic Assistants

## Package Manager
- This project uses **pnpm** (pinned via `packageManager` field)
- Run `pnpm install` to install dependencies
- Node version pinned via Volta (`volta` field in package.json)

## Commands
- `pnpm run dev` - Start the development server
- `pnpm run dev:go` - Start development server with Go optimization
- `pnpm run test` - Run tests with watch mode
- `pnpm run test -- --testNamePattern="pattern"` - Run single test
- `pnpm run lint` - Run linting

## Build & Deployment Commands
- `pnpm run build:ios` - Build iOS app (default profile)
- `pnpm run build:preview` - Build iOS app with preview profile
- `pnpm run build:production` - Build iOS app with production profile
- `pnpm run update:preview` - Update preview branch
- `pnpm run update:production` - Update production branch

## Code Style Guidelines
- **Formatting**: Prettier with 2 spaces, no tabs, single quotes
- **Imports**: Group imports (React, Expo, local files)
- **Types**: TypeScript strict mode; explicit typing for state/props
- **Naming**: Use descriptive names; PascalCase for components, camelCase for variables/functions
- **Error Handling**: Try/catch with specific error messages and logging
- **Component Structure**: Functional components with hooks
- **File Organization**: Expo Router file-based routing under `/app`
- **Styling**: StyleSheet.create for styles; group related styles
- **Path Aliases**: Use `@/` alias for imports from project root

## Environment & Architecture
- Project: **FlowerSandbox** — built with Expo SDK 56 and expo-router
- Supabase for backend, Stripe for payments
- EAS Workflow automation for builds and deployments
