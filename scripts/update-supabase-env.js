#!/usr/bin/env node

/**
 * Script to update Supabase environment variables
 * 
 * Usage:
 * node scripts/update-supabase-env.js
 * 
 * Required environment variables:
 * - SUPABASE_ACCESS_TOKEN: Your Supabase access token
 * - SUPABASE_PROJECT_ID: Your Supabase project ID
 * 
 * Optional environment variables:
 * - STRIPE_SECRET_KEY: Your Stripe restricted key
 * - STRIPE_WEBHOOK_SECRET: Your Stripe webhook secret
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const ENV_FILE_PATH = path.join(__dirname, '..', '.env.supabase');
const ENV_TEMPLATE_PATH = path.join(__dirname, '..', '.env.supabase.template');
const SUPABASE_SECRET_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_TEST_WEBHOOK_SECRET',
];

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Check if Supabase CLI is installed
 */
function checkSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if required environment variables are set
 */
function checkRequiredVars(envVars) {
  const required = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_ID'];
  const missing = required.filter(v => !envVars[v]);
  
  if (missing.length > 0) {
    console.error(`${colors.red}Error: Missing required environment variables: ${missing.join(', ')}${colors.reset}`);
    console.error(`${colors.yellow}Please set them in your environment or in the .env.supabase file${colors.reset}`);
    return false;
  }
  
  return true;
}

/**
 * Load environment variables from file
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const envVars = {};
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  fileContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) {
      return;
    }
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key.trim()] = value.trim();
    }
  });
  
  return envVars;
}

/**
 * Create a template env file if it doesn't exist
 */
function createEnvTemplate() {
  if (fs.existsSync(ENV_TEMPLATE_PATH)) {
    return;
  }
  
  const template = `# Supabase credentials
SUPABASE_ACCESS_TOKEN=your_access_token
SUPABASE_PROJECT_ID=srtlalaecgejgghwwfmk

# Stripe configuration
STRIPE_SECRET_KEY=rk_live_your_restricted_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

`;
  
  fs.writeFileSync(ENV_TEMPLATE_PATH, template);
  console.log(`${colors.green}Created template file at ${ENV_TEMPLATE_PATH}${colors.reset}`);
}

/**
 * Update Supabase environment variables using the CLI
 */
async function updateSupabaseEnv(envVars) {
  const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID } = envVars;
  const variables = Object.fromEntries(
    SUPABASE_SECRET_KEYS
      .filter((key) => Object.prototype.hasOwnProperty.call(envVars, key))
      .map((key) => [key, envVars[key]])
  );

  if (Object.keys(variables).length === 0) {
    console.log(`${colors.yellow}No supported Supabase secrets found to update.${colors.reset}`);
    return false;
  }
  
  // Login to Supabase CLI if needed
  try {
    execSync('supabase projects list', { 
      stdio: 'ignore',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN }
    });
  } catch (error) {
    try {
      console.log(`${colors.yellow}Logging in to Supabase...${colors.reset}`);
      execSync(`echo ${SUPABASE_ACCESS_TOKEN} | supabase login`, { stdio: 'inherit' });
    } catch (loginError) {
      console.error(`${colors.red}Failed to login to Supabase: ${loginError.message}${colors.reset}`);
      process.exit(1);
    }
  }
  
  // Get current environment variables
  console.log(`${colors.cyan}Fetching current environment variables...${colors.reset}`);
  try {
    const currentEnvOutput = execSync(`supabase secrets list --project-ref ${SUPABASE_PROJECT_ID}`, {
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN }
    });
    
    console.log(`${colors.green}Current environment variables:${colors.reset}`);
    console.log(currentEnvOutput);
  } catch (error) {
    console.error(`${colors.yellow}Could not fetch current environment variables: ${error.message}${colors.reset}`);
  }
  
  // Confirm before updating
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}Do you want to update the environment variables? (y/N) ${colors.reset}`, async (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log(`${colors.yellow}Update canceled.${colors.reset}`);
        rl.close();
        resolve(false);
        return;
      }
      
      // Update each variable
      for (const [key, value] of Object.entries(variables)) {
        try {
          console.log(`${colors.cyan}Setting ${key}...${colors.reset}`);
          
          // Skip empty values
          if (!value) {
            console.log(`${colors.yellow}Skipping ${key} (empty value)${colors.reset}`);
            continue;
          }
          
          execSync('supabase secrets set --project-ref "$SUPABASE_PROJECT_ID" "$SECRET_ASSIGNMENT"', {
            stdio: 'inherit',
            env: {
              ...process.env,
              SUPABASE_ACCESS_TOKEN,
              SUPABASE_PROJECT_ID,
              SECRET_ASSIGNMENT: `${key}=${value}`,
            }
          });
          
          console.log(`${colors.green}Successfully set ${key}${colors.reset}`);
        } catch (error) {
          console.error(`${colors.red}Failed to set ${key}: ${error.message}${colors.reset}`);
        }
      }
      
      console.log(`${colors.green}Environment variables updated successfully!${colors.reset}`);
      rl.close();
      resolve(true);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.cyan}====================================${colors.reset}`);
  console.log(`${colors.cyan}  Supabase Environment Updater     ${colors.reset}`);
  console.log(`${colors.cyan}====================================${colors.reset}`);
  
  // Check Supabase CLI
  if (!checkSupabaseCLI()) {
    console.error(`${colors.red}Error: Supabase CLI is not installed${colors.reset}`);
    console.error(`${colors.yellow}Please install it with: npm install -g supabase${colors.reset}`);
    process.exit(1);
  }
  
  // Create template
  createEnvTemplate();
  
  // Check if .env.supabase exists
  if (!fs.existsSync(ENV_FILE_PATH)) {
    console.log(`${colors.yellow}No .env.supabase file found.${colors.reset}`);
    console.log(`${colors.yellow}Please create one based on the template at ${ENV_TEMPLATE_PATH}${colors.reset}`);
    process.exit(1);
  }
  
  // Load environment variables
  const envVars = {
    ...loadEnvFile(ENV_FILE_PATH),
    ...process.env
  };
  
  // Check required variables
  if (!checkRequiredVars(envVars)) {
    process.exit(1);
  }
  
  // Update Supabase environment variables
  await updateSupabaseEnv(envVars);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
