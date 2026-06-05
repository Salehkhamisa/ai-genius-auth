const db = require('./db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Load env variables
require('dotenv').config();

const baseUrl = `http://localhost:${process.env.PORT || 5000}`;

// Helper function to decode cookies header from login response
function getCookieHeader(responseHeaders) {
  const cookieHeader = responseHeaders.get('set-cookie');
  if (!cookieHeader) return null;
  // Extract refreshToken=... part
  const match = cookieHeader.match(/refreshToken=([^;]+)/);
  return match ? `refreshToken=${match[1]}` : null;
}

async function runTests() {
  console.log('==================================================');
  console.log(' STARTING AI-GENIUS AUTH & RBAC INTEGRATION TESTS');
  console.log('==================================================\n');

  // 1. Initialise and Seed Database
  console.log('[STEP 1] Initializing Database...');
  await db.init();
  console.log('Database Initialized.\n');

  // We will run HTTP requests against the local server
  // Note: Node.js 18+ has native fetch. If not available, we can mock or output error.
  if (typeof fetch === 'undefined') {
    console.error('Fetch API is not supported in this Node version. Please use Node.js 18+ to run this verification script.');
    process.exit(1);
  }

  let testCount = 0;
  let passedCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ [PASS] ${message}`);
    } else {
      console.log(`  ✗ [FAIL] ${message}`);
    }
  }

  try {
    // --- TEST CASE 1: FREE USER LIMITS ---
    console.log('[TEST CASE 1] Logging in as Free User...');
    const loginFreeRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'free@aigenius.com', password: 'Free123!' })
    });
    
    const freeData = await loginFreeRes.json();
    assert(loginFreeRes.status === 200, 'Free user login yields HTTP 200');
    assert(freeData.success === true, 'Free user login success is true');
    assert(freeData.user.role === 'Free_User', 'Role is Free_User');
    
    const freeToken = freeData.accessToken;
    const freeCookie = getCookieHeader(loginFreeRes.headers);
    assert(freeCookie !== null, 'Refresh Token cookie is present in headers');

    // Access Free Model (Should pass)
    const freeModelRes = await fetch(`${baseUrl}/api/ai/free-model`, {
      headers: { 'Authorization': `Bearer ${freeToken}` }
    });
    const freeModelData = await freeModelRes.json();
    assert(freeModelRes.status === 200 && freeModelData.success === true, 'Free User CAN access GET /api/ai/free-model');

    // Access Premium Model (Should fail 403)
    const premModelResFreeUser = await fetch(`${baseUrl}/api/ai/premium-model`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${freeToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: 'Test' })
    });
    assert(premModelResFreeUser.status === 403, 'Free User is DENIED access (403) to POST /api/ai/premium-model');

    // Access Purge Cache (Should fail 403)
    const purgeCacheResFreeUser = await fetch(`${baseUrl}/api/ai/purge-cache`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${freeToken}` }
    });
    assert(purgeCacheResFreeUser.status === 403, 'Free User is DENIED access (403) to DELETE /api/ai/purge-cache');
    console.log('');


    // --- TEST CASE 2: PREMIUM USER ACCESS ---
    console.log('[TEST CASE 2] Logging in as Premium User...');
    const loginPremRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'premium@aigenius.com', password: 'Premium123!' })
    });
    
    const premData = await loginPremRes.json();
    assert(loginPremRes.status === 200, 'Premium user login yields HTTP 200');
    assert(premData.user.role === 'Premium_User', 'Role is Premium_User');
    
    const premToken = premData.accessToken;
    const premCookie = getCookieHeader(loginPremRes.headers);

    // Access Free Model (Should pass)
    const freeModelResPrem = await fetch(`${baseUrl}/api/ai/free-model`, {
      headers: { 'Authorization': `Bearer ${premToken}` }
    });
    assert(freeModelResPrem.status === 200, 'Premium User CAN access GET /api/ai/free-model');

    // Access Premium Model (Should pass)
    const premModelResPremUser = await fetch(`${baseUrl}/api/ai/premium-model`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${premToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: 'Test Premium Prompt' })
    });
    assert(premModelResPremUser.status === 200, 'Premium User CAN access POST /api/ai/premium-model');

    // Access Purge Cache (Should fail 403)
    const purgeCacheResPremUser = await fetch(`${baseUrl}/api/ai/purge-cache`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${premToken}` }
    });
    assert(purgeCacheResPremUser.status === 403, 'Premium User is DENIED access (403) to DELETE /api/ai/purge-cache');
    console.log('');


    // --- TEST CASE 3: ADMIN ACCESS ---
    console.log('[TEST CASE 3] Logging in as Admin...');
    const loginAdminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@aigenius.com', password: 'Admin123!' })
    });
    
    const adminData = await loginAdminRes.json();
    assert(loginAdminRes.status === 200, 'Admin login yields HTTP 200');
    assert(adminData.user.role === 'Admin', 'Role is Admin');
    
    const adminToken = adminData.accessToken;
    const adminCookie = getCookieHeader(loginAdminRes.headers);

    // Access Purge Cache (Should pass)
    const purgeCacheResAdmin = await fetch(`${baseUrl}/api/ai/purge-cache`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(purgeCacheResAdmin.status === 200, 'Admin CAN access DELETE /api/ai/purge-cache');
    console.log('');


    // --- TEST CASE 4: TOKEN LIFECYCLE (SILENT REFRESH) ---
    console.log('[TEST CASE 4] Testing Silent Refresh Token...');
    // We send the cookie captured from the Free User login
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': freeCookie }
    });
    
    const refreshData = await refreshRes.json();
    assert(refreshRes.status === 200, 'Refresh endpoint yields HTTP 200');
    assert(refreshData.success === true, 'Refresh response success is true');
    assert(typeof refreshData.accessToken === 'string', 'Fresh Access Token is returned');
    
    const newAccessToken = refreshData.accessToken;
    // Check that we can make a query with the new Access Token
    const verifyNewTokenRes = await fetch(`${baseUrl}/api/ai/free-model`, {
      headers: { 'Authorization': `Bearer ${newAccessToken}` }
    });
    assert(verifyNewTokenRes.status === 200, 'New Access Token works on protected resources');
    console.log('');


    // --- TEST CASE 5: LOGOUT & REVOCATION ---
    console.log('[TEST CASE 5] Testing Logout...');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': freeCookie }
    });
    
    assert(logoutRes.status === 200, 'Logout yields HTTP 200');
    
    // Try refreshing again with the logged-out cookie (should fail because revoked from database)
    const refreshPostLogoutRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': freeCookie }
    });
    assert(refreshPostLogoutRes.status === 401, 'Revoked Refresh Token is rejected on subsequent calls (401)');
    console.log('');


    // --- SUMMARY ---
    console.log('==================================================');
    console.log(` INTEGRATION TESTS RUN COMPLETE: ${passedCount}/${testCount} PASSED`);
    console.log('==================================================');

    if (passedCount === testCount) {
      console.log(' All security layers, token lifecycles, and RBAC endpoints verified perfectly!');
      process.exit(0);
    } else {
      console.error(' Some test assertions failed.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Network request failed. Make sure the Express server is running on http://localhost:5000 before executing the tests.');
    console.error(error);
    process.exit(1);
  }
}

runTests();
