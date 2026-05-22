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
      'User-Agent': 'AntigravityNodeSubmitScript/1.0'
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
          reject(new Error(`HTTP Error ${res.statusCode} on ${method} ${endpoint}: ${JSON.stringify(json || body)}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function uploadScreenshot(setId, filePath) {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  
  console.log(`Reserving screenshot slot for ${fileName} (${fileSize} bytes)...`);
  const reserveRes = await apiRequest('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: {
        fileName: fileName,
        fileSize: fileSize
      },
      relationships: {
        appScreenshotSet: {
          data: {
            type: 'appScreenshotSets',
            id: setId
          }
        }
      }
    }
  });
  
  const screenshotId = reserveRes.data.id;
  const uploadOps = reserveRes.data.attributes.uploadOperations;
  console.log(`Reserved screenshot ID: ${screenshotId}. Uploading chunks...`);
  
  for (const op of uploadOps) {
    const chunk = fileBuffer.slice(op.offset, op.offset + op.length);
    console.log(`Uploading chunk: offset ${op.offset}, length ${op.length}...`);
    
    const headers = {};
    if (op.requestHeaders) {
      op.requestHeaders.forEach(h => {
        headers[h.name] = h.value;
      });
    }
    
    const uploadRes = await fetch(op.url, {
      method: op.method || 'PUT',
      headers: headers,
      body: chunk
    });
    
    if (!uploadRes.ok) {
      throw new Error(`Failed to upload chunk: HTTP ${uploadRes.status} - ${await uploadRes.text()}`);
    }
  }
  
  console.log(`Upload complete for ${fileName}. Committing screenshot...`);
  const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
  await apiRequest('PATCH', `/v1/appScreenshots/${screenshotId}`, {
    data: {
      type: 'appScreenshots',
      id: screenshotId,
      attributes: {
        sourceFileChecksum: md5,
        uploaded: true
      }
    }
  });
  console.log(`Successfully committed screenshot ${fileName}`);
  return screenshotId;
}

async function pollScreenshots(ids) {
  if (!ids || ids.length === 0) return;
  console.log(`Polling status for ${ids.length} uploaded screenshot(s)...`);
  const pending = new Set(ids);
  const maxAttempts = 60;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Checking screenshot processing status (Attempt ${attempt}/${maxAttempts})...`);
    for (const id of pending) {
      try {
        const res = await apiRequest('GET', `/v1/appScreenshots/${id}`);
        const state = res.data.attributes.assetDeliveryState?.state;
        console.log(`Screenshot ID ${id}: state is ${state}`);
        if (state === 'COMPLETE') {
          pending.delete(id);
        } else if (state === 'FAILED') {
          throw new Error(`Screenshot ID ${id} processing failed on Apple's servers.`);
        }
      } catch (err) {
        console.log(`Warning checking screenshot ${id} (will retry):`, err.message);
      }
    }
    if (pending.size === 0) {
      console.log('All uploaded screenshots are successfully processed and COMPLETE.');
      return;
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error(`Timeout waiting for screenshots to process on Apple's servers.`);
}

// Generate tailored copy and URLs based on the app's slug
function getMetadata(slug) {
  const metadata = {
    copyright: process.env.APP_STORE_COPYRIGHT || '© 2026 Scott Beilfuss',
    supportUrl: process.env.APP_STORE_SUPPORT_URL || `https://thescottybe.github.io/${slug}`,
    marketingUrl: process.env.APP_STORE_MARKETING_URL || `https://thescottybe.github.io/${slug}`,
    privacyPolicyUrl: process.env.APP_STORE_PRIVACY_POLICY_URL || `https://thescottybe.github.io/${slug}/privacy`
  };

  if (slug === 'flower-sandbox') {
    metadata.description = process.env.APP_STORE_DESCRIPTION || "FlowerSandbox is a peaceful, interactive digital garden where you can plant beautiful flowers, customize your garden layout, and relax with serene animations. Nurture your virtual sanctuary, experiment with colorful petals, and enjoy a calming, distraction-free environment designed for mindfulness and relaxation.";
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "garden,flowers,relax,nature,grow,plants,mindfulness,virtual garden,sandbox,calm";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Peaceful Garden Sandbox";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'LIFESTYLE';
  } else if (slug === 'mortgage-flipcard') {
    metadata.description = process.env.APP_STORE_DESCRIPTION || "Mortgage FlipCard is a useful, intuitive, and novel mortgage planning companion built around interactive 3D cards. Easily compare different mortgage scenarios side-by-side. Flip cards to reveal comprehensive financial breakdowns, amortization schedules, and localized climate hazard risk metrics (flood, wildfire, wind) based on the property's zip code. Plan your home purchase smarter with offline-first tools, beautiful custom skins/themes, and advanced AI scenario coaching.";
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "mortgage,calculator,loan,compare,amortization,home,payment,climate,risk,finance";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Compare Scenarios & Hazards";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'FINANCE';
  } else if (slug === 'creative-story-canvas' || slug === 'react-example') {
    metadata.description = process.env.APP_STORE_DESCRIPTION || "Creative Story Canvas is an elegant and powerful writing companion designed for authors, screenwriters, and creative minds. Organize your ideas, structure your plots, and draft your stories on a beautiful, distraction-free interface built for focus. Whether you are outlining your next novel or writing daily micro-fiction, Creative Story Canvas helps you map your creative thoughts visually and bring your stories to life.";
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "writing,story,creative,plot,novel,author,screenplay,editor,notebook";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Creative Writing Companion";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'BOOKS';
  } else {
    // Generics fallback
    metadata.description = process.env.APP_STORE_DESCRIPTION || `${config.appName} is a beautiful and premium companion app designed to elevate your daily productivity and lifestyle.`;
    metadata.keywords = process.env.APP_STORE_KEYWORDS || "utility,companion,helper,premium,lifestyle";
    metadata.subtitle = process.env.APP_STORE_SUBTITLE || "Your Premium Companion";
    metadata.primaryCategory = process.env.APP_STORE_PRIMARY_CATEGORY || 'UTILITIES';
  }

  return metadata;
}

async function main() {
  try {
    const meta = getMetadata(config.slug);
    console.log(`Starting App Store Review Submission process for ${config.appName} (${config.slug}) Version ${config.versionString}...`);
    
    // 1. Check/Get Development App Store Version
    console.log('Fetching App Store versions...');
    const versionsResponse = await apiRequest('GET', `/v1/apps/${config.appId}/appStoreVersions?filter[platform]=IOS`);
    let targetVersion = null;
    
    if (versionsResponse.data && versionsResponse.data.length > 0) {
      targetVersion = versionsResponse.data.find(v => v.attributes.versionString === config.versionString);
      if (targetVersion) {
        console.log(`Found existing PREPARE_FOR_SUBMISSION version ${config.versionString} (ID: ${targetVersion.id})`);
      } else {
        const devVersion = versionsResponse.data[0];
        console.log(`Found development version ${devVersion.attributes.versionString} (ID: ${devVersion.id}). Renaming to ${config.versionString}...`);
        targetVersion = await apiRequest('PATCH', `/v1/appStoreVersions/${devVersion.id}`, {
          data: {
            type: 'appStoreVersions',
            id: devVersion.id,
            attributes: {
              versionString: config.versionString
            }
          }
        }).then(r => r.data);
        console.log(`Successfully renamed version to ${config.versionString}`);
      }
    } else {
      console.log(`No development version found. Creating version ${config.versionString}...`);
      targetVersion = await apiRequest('POST', `/v1/appStoreVersions`, {
        data: {
          type: 'appStoreVersions',
          attributes: {
            platform: 'IOS',
            versionString: config.versionString
          },
          relationships: {
            app: {
              data: {
                type: 'apps',
                id: config.appId
              }
            }
          }
        }
      }).then(r => r.data);
      console.log(`Successfully created App Store Version ${config.versionString} (ID: ${targetVersion.id})`);
    }

    // 2. Poll App Store Connect for Build processing completion
    console.log(`Looking up builds in App Store Connect...`);
    let buildId = null;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!buildId && attempts < maxAttempts) {
      attempts++;
      console.log(`Polling for build... Attempt ${attempts}/${maxAttempts}`);
      
      const buildsResponse = await apiRequest('GET', `/v1/builds?filter[app]=${config.appId}`);
      
      if (buildsResponse.data && buildsResponse.data.length > 0) {
        const build = buildsResponse.data[0];
        console.log(`Found build (Build Number: ${build.attributes.version}, Processing State: ${build.attributes.processingState})`);
        
        if (build.attributes.processingState === 'VALID') {
          buildId = build.id;
          console.log(`Build is processed and ready (ID: ${buildId})`);
        } else if (build.attributes.processingState === 'PROCESSING') {
          console.log('Build is still processing in App Store Connect. Waiting 30 seconds...');
          await new Promise(r => setTimeout(r, 30000));
        } else {
          console.error(`Warning: Build has unexpected processing state: ${build.attributes.processingState}`);
          buildId = build.id;
        }
      } else {
        console.log('No build found yet for this version. Waiting 30 seconds...');
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    if (!buildId) {
      throw new Error(`Timeout waiting for build to appear or finish processing in App Store Connect.`);
    }

    // 3. Attach Build to App Store Version
    console.log(`Checking if build is already attached to version...`);
    let isAttached = false;
    try {
      const existingBuildRes = await apiRequest('GET', `/v1/appStoreVersions/${targetVersion.id}/build`);
      if (existingBuildRes && existingBuildRes.data && existingBuildRes.data.id === buildId) {
        console.log(`Build ${buildId} is already attached to App Store version.`);
        isAttached = true;
      }
    } catch (err) {
      if (!err.message.includes('404')) {
        console.warn('Warning checking existing build attachment:', err.message);
      }
    }

    if (!isAttached) {
      console.log(`Attaching Build ID ${buildId} to App Store Version ID ${targetVersion.id}...`);
      await apiRequest('PATCH', `/v1/appStoreVersions/${targetVersion.id}`, {
        data: {
          type: 'appStoreVersions',
          id: targetVersion.id,
          relationships: {
            build: {
              data: {
                type: 'builds',
                id: buildId
              }
            }
          }
        }
      });
      console.log('Successfully attached build to version.');
    }

    // 3.5. Update Required Metadata & Upload Screenshots
    console.log('--- STARTING METADATA UPDATE & SCREENSHOT UPLOAD FLOW ---');

    // Get Localization
    console.log('Retrieving version localizations...');
    const locsResponse = await apiRequest('GET', `/v1/appStoreVersions/${targetVersion.id}/appStoreVersionLocalizations`);
    let locId = null;
    if (locsResponse.data && locsResponse.data.length > 0) {
      locId = locsResponse.data[0].id;
      console.log(`Found existing version localization ID: ${locId} (${locsResponse.data[0].attributes.locale})`);
    } else {
      console.log('Creating en-US version localization...');
      const createLocResponse = await apiRequest('POST', `/v1/appStoreVersionLocalizations`, {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: {
            locale: 'en-US'
          },
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: targetVersion.id
              }
            }
          }
        }
      });
      locId = createLocResponse.data.id;
      console.log(`Created version localization ID: ${locId}`);
    }

    // Patch Version copyright
    console.log(`Updating version copyright: ${meta.copyright}`);
    await apiRequest('PATCH', `/v1/appStoreVersions/${targetVersion.id}`, {
      data: {
        type: 'appStoreVersions',
        id: targetVersion.id,
        attributes: {
          copyright: meta.copyright
        }
      }
    });

    // Patch Version Localization details (description, supportUrl, keywords)
    console.log('Updating version localization metadata...');
    await apiRequest('PATCH', `/v1/appStoreVersionLocalizations/${locId}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: locId,
        attributes: {
          description: meta.description,
          keywords: meta.keywords,
          supportUrl: meta.supportUrl,
          marketingUrl: meta.marketingUrl
        }
      }
    });

    // Get App Info ID
    console.log('Retrieving app info metadata...');
    const appInfosRes = await apiRequest('GET', `/v1/apps/${config.appId}/appInfos`);
    const appInfoId = appInfosRes.data[0].id;
    console.log(`App Info ID: ${appInfoId}`);

    // Update Primary Category
    console.log(`Setting Primary Category to ${meta.primaryCategory}...`);
    await apiRequest('PATCH', `/v1/appInfos/${appInfoId}`, {
      data: {
        type: 'appInfos',
        id: appInfoId,
        relationships: {
          primaryCategory: {
            data: {
              type: 'appCategories',
              id: meta.primaryCategory
            }
          }
        }
      }
    });

    // Retrieve and Update App Info Localization
    console.log('Retrieving app info localizations...');
    const appInfoLocsRes = await apiRequest('GET', `/v1/appInfos/${appInfoId}/appInfoLocalizations`);
    const appInfoLocId = appInfoLocsRes.data[0].id;
    console.log(`App Info Localization ID: ${appInfoLocId}`);

    console.log(`Updating privacy policy URL to ${meta.privacyPolicyUrl} and subtitle to ${meta.subtitle}...`);
    await apiRequest('PATCH', `/v1/appInfoLocalizations/${appInfoLocId}`, {
      data: {
        type: 'appInfoLocalizations',
        id: appInfoLocId,
        attributes: {
          privacyPolicyUrl: meta.privacyPolicyUrl,
          subtitle: meta.subtitle
        }
      }
    });

    // Set App Pricing to Free dynamically
    console.log('Setting App Pricing to Free...');
    try {
      const pricePointsRes = await apiRequest('GET', `/v1/apps/${config.appId}/appPricePoints?filter[territory]=USA`);
      const freePricePoint = pricePointsRes.data?.find(p => p.attributes?.customerPrice === '0.0');
      if (!freePricePoint) {
        throw new Error('Could not find Free (0.0 USD) Price Point in the Apple API response.');
      }
      console.log(`Found Free Price Point ID: ${freePricePoint.id}`);

      await apiRequest('POST', `/v1/appPriceSchedules`, {
        data: {
          type: 'appPriceSchedules',
          relationships: {
            app: {
              data: {
                type: 'apps',
                id: config.appId
              }
            },
            baseTerritory: {
              data: {
                type: 'territories',
                id: 'USA'
              }
            },
            manualPrices: {
              data: [
                {
                  type: 'appPrices',
                  id: '${temp-free-price}'
                }
              ]
            }
          }
        },
        included: [
          {
            type: 'appPrices',
            id: '${temp-free-price}',
            attributes: {
              startDate: null
            },
            relationships: {
              appPricePoint: {
                data: {
                  type: 'appPricePoints',
                  id: freePricePoint.id
                }
              }
            }
          }
        ]
      });
      console.log('Successfully set App Pricing to Free.');
    } catch (pricingError) {
      console.log(`Warning: Failed to set App Pricing via API: ${pricingError.message}`);
      console.log('If pricing is already set, this warning can be ignored.');
    }

    // Update Content Rights
    console.log('Updating content rights declaration to DOES_NOT_USE_THIRD_PARTY_CONTENT...');
    await apiRequest('PATCH', `/v1/apps/${config.appId}`, {
      data: {
        type: 'apps',
        id: config.appId,
        attributes: {
          contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT'
        }
      }
    });

    // Update Age Rating Declaration
    console.log('Updating age rating declarations questionnaire...');
    await apiRequest('PATCH', `/v1/ageRatingDeclarations/${appInfoId}`, {
      data: {
        type: 'ageRatingDeclarations',
        id: appInfoId,
        attributes: {
          advertising: false,
          alcoholTobaccoOrDrugUseOrReferences: 'NONE',
          contests: 'NONE',
          gambling: false,
          gamblingSimulated: 'NONE',
          gunsOrOtherWeapons: 'NONE',
          healthOrWellnessTopics: false,
          lootBox: false,
          medicalOrTreatmentInformation: 'NONE',
          messagingAndChat: false,
          parentalControls: false,
          profanityOrCrudeHumor: 'NONE',
          ageAssurance: false,
          sexualContentGraphicAndNudity: 'NONE',
          sexualContentOrNudity: 'NONE',
          horrorOrFearThemes: 'NONE',
          matureOrSuggestiveThemes: 'NONE',
          unrestrictedWebAccess: false,
          userGeneratedContent: false,
          violenceCartoonOrFantasy: 'NONE',
          violenceRealisticProlongedGraphicOrSadistic: 'NONE',
          violenceRealistic: 'NONE'
        }
      }
    });

    // Manage Review Detail Contact Info
    console.log('Checking App Store Review Detail contact info...');
    let reviewDetailRes;
    try {
      reviewDetailRes = await apiRequest('GET', `/v1/appStoreVersions/${targetVersion.id}/appStoreReviewDetail`);
    } catch (err) {
      console.log('No existing App Store review detail found.');
    }

    const reviewContactInfo = {
      contactFirstName: process.env.APP_REVIEW_CONTACT_FIRST_NAME || 'Scott',
      contactLastName: process.env.APP_REVIEW_CONTACT_LAST_NAME || 'Beilfuss',
      contactPhone: process.env.APP_REVIEW_CONTACT_PHONE || '+18473099047',
      contactEmail: process.env.APP_REVIEW_CONTACT_EMAIL || 'beilsco@gmail.com',
      demoAccountRequired: ['1', 'true', 'yes'].includes(String(process.env.APP_REVIEW_DEMO_ACCOUNT_REQUIRED || '').toLowerCase())
    };

    if (process.env.APP_REVIEW_DEMO_ACCOUNT_NAME) {
      reviewContactInfo.demoAccountName = process.env.APP_REVIEW_DEMO_ACCOUNT_NAME;
    }
    if (process.env.APP_REVIEW_DEMO_ACCOUNT_PASSWORD) {
      reviewContactInfo.demoAccountPassword = process.env.APP_REVIEW_DEMO_ACCOUNT_PASSWORD;
    }
    if (process.env.APP_REVIEW_NOTES) {
      reviewContactInfo.notes = process.env.APP_REVIEW_NOTES;
    }

    if (reviewDetailRes && reviewDetailRes.data) {
      const reviewDetailId = reviewDetailRes.data.id;
      console.log(`Updating existing App Store review detail (ID: ${reviewDetailId})...`);
      await apiRequest('PATCH', `/v1/appStoreReviewDetails/${reviewDetailId}`, {
        data: {
          type: 'appStoreReviewDetails',
          id: reviewDetailId,
          attributes: reviewContactInfo
        }
      });
    } else {
      console.log('Creating new App Store review detail...');
      await apiRequest('POST', `/v1/appStoreReviewDetails`, {
        data: {
          type: 'appStoreReviewDetails',
          attributes: reviewContactInfo,
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: targetVersion.id
              }
            }
          }
        }
      });
    }

    // Screenshot Sets handling dynamically
    console.log('Fetching app screenshot sets...');
    const setsRes = await apiRequest('GET', `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
    
    let iphone65Set = setsRes.data ? setsRes.data.find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_65') : null;
    if (!iphone65Set) {
      console.log('Creating appScreenshotSet for APP_IPHONE_65...');
      iphone65Set = await apiRequest('POST', '/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: 'APP_IPHONE_65' },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: locId }
            }
          }
        }
      }).then(r => r.data);
    } else {
      console.log(`Found existing APP_IPHONE_65 set (ID: ${iphone65Set.id})`);
    }
    
    let ipad129Set = setsRes.data ? setsRes.data.find(s => s.attributes.screenshotDisplayType === 'APP_IPAD_PRO_3GEN_129') : null;
    if (!ipad129Set) {
      console.log('Creating appScreenshotSet for APP_IPAD_PRO_3GEN_129...');
      ipad129Set = await apiRequest('POST', '/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: 'APP_IPAD_PRO_3GEN_129' },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: locId }
            }
          }
        }
      }).then(r => r.data);
    } else {
      console.log(`Found existing APP_IPAD_PRO_3GEN_129 set (ID: ${ipad129Set.id})`);
    }

    // Define screenshots configuration based on files present in assets
    const iphoneFiles = ['./assets/iphone65.png', './assets/iphone65_back.png'].filter(fs.existsSync);
    const ipadFiles = ['./assets/ipad129.png', './assets/ipad129_back.png'].filter(fs.existsSync);

    const iphoneScreenshots = await apiRequest('GET', `/v1/appScreenshotSets/${iphone65Set.id}/appScreenshots`);
    const ipadScreenshots = await apiRequest('GET', `/v1/appScreenshotSets/${ipad129Set.id}/appScreenshots`);

    const uploadedIds = [];

    // Process iPhone Screenshots
    if (iphoneFiles.length > 0) {
      console.log(`Found iPhone screenshots on disk: ${iphoneFiles.join(', ')}`);
      if (iphoneScreenshots.data && iphoneScreenshots.data.length > 0) {
        console.log('Cleaning old iPhone screenshots...');
        for (const shot of iphoneScreenshots.data) {
          console.log(`Deleting screenshot ID: ${shot.id}`);
          try {
            await apiRequest('DELETE', `/v1/appScreenshots/${shot.id}`);
          } catch (e) {
            console.warn(`Warning: failed to delete screenshot ${shot.id}:`, e.message);
          }
        }
      }
      for (const file of iphoneFiles) {
        const shotId = await uploadScreenshot(iphone65Set.id, file);
        uploadedIds.push(shotId);
      }
    } else {
      console.log('No iPhone screenshots found on disk to upload. Keeping existing ones.');
    }

    // Process iPad Screenshots
    if (ipadFiles.length > 0) {
      console.log(`Found iPad screenshots on disk: ${ipadFiles.join(', ')}`);
      if (ipadScreenshots.data && ipadScreenshots.data.length > 0) {
        console.log('Cleaning old iPad screenshots...');
        for (const shot of ipadScreenshots.data) {
          console.log(`Deleting screenshot ID: ${shot.id}`);
          try {
            await apiRequest('DELETE', `/v1/appScreenshots/${shot.id}`);
          } catch (e) {
            console.warn(`Warning: failed to delete screenshot ${shot.id}:`, e.message);
          }
        }
      }
      for (const file of ipadFiles) {
        const shotId = await uploadScreenshot(ipad129Set.id, file);
        uploadedIds.push(shotId);
      }
    } else {
      console.log('No iPad screenshots found on disk to upload. Keeping existing ones.');
    }

    if (uploadedIds.length > 0) {
      console.log('Waiting for Apple to process uploaded screenshots...');
      await pollScreenshots(uploadedIds);
    }

    console.log('--- METADATA UPDATE & SCREENSHOT UPLOAD FLOW COMPLETE ---');

    // 4. Manage Review Submission Container
    console.log('Checking for active review submission container...');
    const submissionsResponse = await apiRequest('GET', `/v1/apps/${config.appId}/reviewSubmissions`);
    const activeStates = new Set(['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES']);
    const activeSubmissions = (submissionsResponse.data ?? []).filter(s => activeStates.has(s.attributes?.state));
    
    let submissionId = null;
    const readySubmission = activeSubmissions.find(s => s.attributes?.state === 'READY_FOR_REVIEW');
    const waitingOrInReview = activeSubmissions.find(s => s.attributes?.state === 'WAITING_FOR_REVIEW' || s.attributes?.state === 'IN_REVIEW');

    if (waitingOrInReview) {
      console.log(`App version is already submitted or in review (Submission Container ID: ${waitingOrInReview.id}, State: ${waitingOrInReview.attributes.state}).`);
      console.log('\x1b[32mSUCCESS: App is currently waiting for review or in review.\x1b[0m');
      return;
    }

    if (readySubmission) {
      submissionId = readySubmission.id;
      console.log(`Found existing READY_FOR_REVIEW submission container (ID: ${submissionId})`);
    } else {
      console.log('Creating a new review submission container...');
      const createSubResponse = await apiRequest('POST', `/v1/reviewSubmissions`, {
        data: {
          type: 'reviewSubmissions',
          attributes: {
            platform: 'IOS'
          },
          relationships: {
            app: {
              data: {
                type: 'apps',
                id: config.appId
              }
            }
          }
        }
      });
      submissionId = createSubResponse.data.id;
      console.log(`Successfully created review submission container (ID: ${submissionId})`);
    }

    // 5. Add Version Item to Submission Container
    console.log(`Adding App Store Version ID ${targetVersion.id} to review submission container...`);
    const itemsResponse = await apiRequest('GET', `/v1/reviewSubmissions/${submissionId}/items`);
    const isVersionAdded = itemsResponse.data && itemsResponse.data.some(
      item => item.relationships && 
              item.relationships.appStoreVersion && 
              item.relationships.appStoreVersion.data && 
              item.relationships.appStoreVersion.data.id === targetVersion.id
    );

    if (isVersionAdded) {
      console.log('App Store Version is already added to the submission container.');
    } else {
      await apiRequest('POST', `/v1/reviewSubmissionItems`, {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: {
              data: {
                type: 'reviewSubmissions',
                id: submissionId
              }
            },
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: targetVersion.id
              }
            }
          }
        }
      });
      console.log('Successfully added App Store Version to submission container.');
    }

    // 6. Finalize Review Submission (Submit to Apple)
    console.log(`Submitting review submission container ID ${submissionId} to App Store Review...`);
    const finalResponse = await apiRequest('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
      data: {
        type: 'reviewSubmissions',
        id: submissionId,
        attributes: {
          submitted: true
        }
      }
    });
    
    console.log(`\n\x1b[32mSUCCESS: App Store review submission completed successfully!\x1b[0m`);
    console.log(`Submission ID: ${submissionId}`);
    console.log(`Submission State: ${finalResponse.data.attributes.state}`);
    
  } catch (error) {
    console.error('\n\x1b[31mSubmission failed with error:\x1b[0m');
    console.error(error.message);
    if (error.message.includes('409') || error.message.toLowerCase().includes('privacy') || error.message.toLowerCase().includes('data usage') || error.message.includes('APP_DATA_USAGES_REQUIRED')) {
      console.log('\n\x1b[33m💡 TROUBLESHOOTING TIP:\x1b[0m');
      console.log('This error indicates that the App Privacy (Data Usages) questionnaire is not completed or published.');
      console.log('Please log into App Store Connect:');
      console.log('  1. Navigate to: https://appstoreconnect.apple.com');
      console.log(`  2. Select your app "${config.appName}"`);
      console.log('  3. In the left sidebar under "General", select "App Privacy"');
      console.log('  4. Click "Get Started" and complete the questionnaire (declare no data is collected, as this is an offline-first app)');
      console.log('  5. Click "Publish"');
      console.log('Once published, re-run this submission script.');
    }
    process.exit(1);
  }
}

main();
