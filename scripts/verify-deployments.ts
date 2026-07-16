// scripts/verify-deployments.ts

const supabaseUrl = Deno.env.get('SUPABASE_URL');
if (!supabaseUrl) {
  console.error('Error: SUPABASE_URL environment variable is required.');
  Deno.exit(1);
}

const functions = [
  { name: 'stripe-products', method: 'OPTIONS', expectedStatus: [204] },
  { name: 'stripe-checkout', method: 'OPTIONS', expectedStatus: [204] },
  {
    name: 'stripe-checkout-anonymous',
    method: 'OPTIONS',
    expectedStatus: [204],
  },
  { name: 'stripe-webhook', method: 'OPTIONS', expectedStatus: [204] },
  { name: 'delete-account', method: 'OPTIONS', expectedStatus: [200] },
];

let failed = false;

console.log(`Starting smoke tests against URL: ${supabaseUrl}`);

for (const fn of functions) {
  const url = `${supabaseUrl}/functions/v1/${fn.name}`;
  console.log(`Checking function ${fn.name} at ${url}...`);

  try {
    const res = await fetch(url, {
      method: fn.method,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    console.log(`-> Received status ${res.status}`);
    if (!fn.expectedStatus.includes(res.status)) {
      console.error(
        `Error: Expected status one of [${fn.expectedStatus.join(', ')}], but got ${res.status}`,
      );
      failed = true;
    } else {
      console.log(`-> Function ${fn.name} is healthy!`);
    }
  } catch (err) {
    console.error(`Error requesting function ${fn.name}:`, err);
    failed = true;
  }
}

if (failed) {
  console.error('Verification failed for one or more deployments.');
  Deno.exit(1);
} else {
  console.log('All deployments verified successfully!');
}
