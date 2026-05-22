const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

function loadConfig() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    });
  }

  let appJson = {};
  const appJsonPath = path.resolve(process.cwd(), 'app.json');
  if (fs.existsSync(appJsonPath)) {
    try {
      appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    } catch (e) {
      console.warn('Warning: Failed to parse app.json:', e.message);
    }
  }

  let easJson = {};
  const easJsonPath = path.resolve(process.cwd(), 'eas.json');
  if (fs.existsSync(easJsonPath)) {
    try {
      easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    } catch (e) {
      console.warn('Warning: Failed to parse eas.json:', e.message);
    }
  }

  const expo = appJson.expo ?? appJson;
  const submitIos = easJson.submit?.production?.ios ?? {};

  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID || process.env.ASC_ISSUER_ID || submitIos.ascApiKeyIssuerId;
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID || process.env.ASC_KEY_ID || submitIos.ascApiKeyId;
  
  let privateKey = process.env.APP_STORE_CONNECT_PRIVATE_KEY || process.env.ASC_PRIVATE_KEY;
  let privateKeyPath = process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH || process.env.ASC_PRIVATE_KEY_PATH || process.env.ASC_KEY_PATH || submitIos.ascApiKeyPath;

  if (!privateKey && privateKeyPath) {
    if (fs.existsSync(privateKeyPath)) {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    } else {
      const resolvedPath = path.resolve(process.cwd(), privateKeyPath);
      if (fs.existsSync(resolvedPath)) {
        privateKey = fs.readFileSync(resolvedPath, 'utf8');
      }
    }
  }

  const appId = process.env.APP_STORE_CONNECT_APP_ID || process.env.ASC_APP_ID || submitIos.ascAppId;
  const versionString = process.env.APP_STORE_VERSION || expo.version || '1.0.0';
  const slug = expo.slug || 'unknown';
  const appName = expo.name || slug;

  return {
    issuerId,
    keyId,
    privateKey,
    appId,
    versionString,
    slug,
    appName
  };
}

const config = loadConfig();

if (!config.issuerId || !config.keyId || !config.privateKey || !config.appId) {
  console.error('\x1b[31mError: Missing App Store Connect API credentials or App ID.\x1b[0m');
  console.error('Please configure APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_PRIVATE_KEY_PATH, and APP_STORE_CONNECT_APP_ID.');
  process.exit(1);
}

const base64UrlEncode = (str) => {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

function generateJwt() {
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.issuerId,
    exp: Math.floor(Date.now() / 1000) + 900,
    aud: 'appstoreconnect-v1'
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: 'ieee-p1363'
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function apiRequest(method, endpoint, data = null) {
  const token = generateJwt();
  const options = {
    hostname: 'api.appstoreconnect.apple.com',
    port: 443,
    path: endpoint,
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MetadataDiagnostic/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let json = null;
        if (body) {
          try { json = JSON.parse(body); } catch(e) { json = body; }
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json || body)}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  try {
    console.log(`\n--- FETCHING APP PRICE POINTS FOR APP ID: ${config.appId} (USA) ---`);
    const res = await apiRequest('GET', `/v1/apps/${config.appId}/appPricePoints?filter[territory]=USA`);
    console.log(`Total price points returned: ${res.data.length}`);
    const freePt = res.data.find(p => p.attributes.customerPrice === '0.0');
    if (freePt) {
      console.log('Found Free Price Point:', JSON.stringify(freePt, null, 2));
    } else {
      console.log('No Free Price Point found in response!');
      console.log('First 5 price points:', JSON.stringify(res.data.slice(0, 5), null, 2));
    }
  } catch (error) {
    console.error('Error in main:', error);
  }
}

main();
