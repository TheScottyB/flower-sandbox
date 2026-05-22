#!/usr/bin/env node

/**
 * This script verifies that your Stripe configuration is set up correctly.
 * Run with: node scripts/verify-stripe-setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Define the paths to check
const STRIPE_CONFIG_PATH = path.join(__dirname, '..', 'src', 'stripe-config.ts');

console.log(`${colors.cyan}====================================${colors.reset}`);
console.log(`${colors.cyan}  Stripe Live Mode Verification     ${colors.reset}`);
console.log(`${colors.cyan}====================================${colors.reset}`);

// Check if stripe-config.ts exists
if (!fs.existsSync(STRIPE_CONFIG_PATH)) {
  console.log(`${colors.red}❌ stripe-config.ts not found!${colors.reset}`);
  process.exit(1);
}

// Read the config file
const stripeConfig = fs.readFileSync(STRIPE_CONFIG_PATH, 'utf8');

// Extract product IDs
const productIdMatch = stripeConfig.match(/id: ['"]([^'"]+)['"]/g);
const priceIdMatch = stripeConfig.match(/priceId: ['"]([^'"]+)['"]/g);

// Check if placeholder IDs are still in use
function checkForPlaceholders() {
  const placeholders = ['prod_YourLiveProductID', 'price_YourLivePriceID', 
                       'prod_YourLiveDonationID', 'price_YourLiveDonationPriceID'];
  let containsPlaceholders = false;
  
  placeholders.forEach(placeholder => {
    if (stripeConfig.includes(placeholder)) {
      console.log(`${colors.red}❌ Placeholder '${placeholder}' found in stripe-config.ts${colors.reset}`);
      containsPlaceholders = true;
    }
  });
  
  if (!containsPlaceholders) {
    console.log(`${colors.green}✅ No placeholder IDs found in stripe-config.ts${colors.reset}`);
  }
  
  return !containsPlaceholders;
}

// Check if IDs have the correct format
function checkIdFormat() {
  let allValid = true;
  
  if (productIdMatch) {
    productIdMatch.forEach(match => {
      const id = match.match(/['"]([^'"]+)['"]/)[1];
      if (!id.startsWith('prod_')) {
        console.log(`${colors.red}❌ Invalid product ID format: ${id}${colors.reset}`);
        allValid = false;
      }
    });
  } else {
    console.log(`${colors.red}❌ No product IDs found in config${colors.reset}`);
    allValid = false;
  }
  
  if (priceIdMatch) {
    priceIdMatch.forEach(match => {
      const id = match.match(/['"]([^'"]+)['"]/)[1];
      if (!id.startsWith('price_')) {
        console.log(`${colors.red}❌ Invalid price ID format: ${id}${colors.reset}`);
        allValid = false;
      }
    });
  } else {
    console.log(`${colors.red}❌ No price IDs found in config${colors.reset}`);
    allValid = false;
  }
  
  if (allValid) {
    console.log(`${colors.green}✅ All product and price IDs have correct format${colors.reset}`);
  }
  
  return allValid;
}

// Check if we're using live product IDs
function checkLiveMode() {
  if (stripeConfig.includes('price_1RCQr6DesriQyUxd0aR0MNGG') && stripeConfig.includes('price_1RCQskDesriQyUxdWlqf7eQZ')) {
    console.log(`${colors.green}✅ Configuration set to LIVE mode${colors.reset}`);
    return true;
  } else {
    console.log(`${colors.yellow}⚠️ Configuration might not be in LIVE mode${colors.reset}`);
    return false;
  }
}

// Run checks
const noPlaceholders = checkForPlaceholders();
const validFormat = checkIdFormat();
const isLiveMode = checkLiveMode();

// Ask for Stripe secret key to verify
console.log(`\n${colors.cyan}Verify Stripe Secret Key${colors.reset}`);
console.log(`${colors.yellow}⚠️ This will not store or transmit your secret key.${colors.reset}`);

rl.question('Enter the visible prefix of your Stripe server key: ', (keyPrefix) => {
  if (keyPrefix.startsWith('rk_live_')) {
    console.log(`${colors.green}✅ Using a LIVE mode restricted key${colors.reset}`);
  } else if (keyPrefix.startsWith('sk_live_')) {
    console.log(`${colors.yellow}⚠️ Using a LIVE mode secret key. Prefer a restricted key (rk_live_) for Edge Functions.${colors.reset}`);
  } else if (keyPrefix.startsWith('sk_test_')) {
    console.log(`${colors.red}❌ Using a TEST mode secret key. Switch to LIVE mode for production.${colors.reset}`);
  } else if (keyPrefix.startsWith('rk_test_')) {
    console.log(`${colors.red}❌ Using a TEST mode restricted key. Switch to LIVE mode for production.${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Invalid key format. Expected rk_live_ for production Edge Functions.${colors.reset}`);
  }
  
  // Final summary
  console.log(`\n${colors.cyan}====================================${colors.reset}`);
  console.log(`${colors.cyan}  Verification Results               ${colors.reset}`);
  console.log(`${colors.cyan}====================================${colors.reset}`);
  console.log(`Product/Price placeholders removed: ${noPlaceholders ? colors.green + '✅ YES' : colors.red + '❌ NO'}`);
  console.log(`Valid ID formats: ${validFormat ? colors.green + '✅ YES' : colors.red + '❌ NO'}`);
  console.log(`Configuration in LIVE mode: ${isLiveMode ? colors.green + '✅ YES' : colors.yellow + '⚠️ MAYBE'}`);
  console.log(`${colors.reset}`);
  
  if (noPlaceholders && validFormat && isLiveMode && keyPrefix.startsWith('rk_live_')) {
    console.log(`${colors.green}✅ Your Stripe LIVE mode configuration looks good!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ Some issues were found with your Stripe configuration.${colors.reset}`);
    console.log(`${colors.yellow}Please review the results above and fix any issues.${colors.reset}`);
  }
  
  rl.close();
});
