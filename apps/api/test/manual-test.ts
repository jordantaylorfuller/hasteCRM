import axios from 'axios';
import * as speakeasy from 'speakeasy';

const API_URL = 'http://localhost:4000';
const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';

interface TestResult {
  feature: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: TestResult[] = [];

async function testFeature(name: string, testFn: () => Promise<void>) {
  try {
    await testFn();
    results.push({ feature: name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ feature: name, status: 'FAIL', details: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting Phase 1 Feature Tests...\n');

  let accessToken: string;
  let refreshToken: string;
  let twoFactorSecret: string;

  // 1. Test Registration
  await testFeature('User Registration', async () => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
      workspaceName: 'Test Workspace',
    });
    
    if (!response.data.user || !response.data.workspace) {
      throw new Error('Missing user or workspace data');
    }
    
    if (response.data.user.status !== 'PENDING') {
      throw new Error('User status should be PENDING');
    }
    
    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
  });

  // 2. Test Duplicate Registration Prevention
  await testFeature('Duplicate Registration Prevention', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
        workspaceName: 'Test Workspace',
      });
      throw new Error('Should have rejected duplicate email');
    } catch (error: any) {
      if (error.response?.status !== 409) {
        throw error;
      }
    }
  });

  // 3. Test Login
  await testFeature('User Login', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    
    if (!response.data.accessToken || !response.data.refreshToken) {
      throw new Error('Missing tokens');
    }
    
    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
  });

  // 4. Test Protected Route Access
  await testFeature('Protected Route Access', async () => {
    const response = await axios.post(`${API_URL}/auth/me`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.data.email || response.data.email !== testEmail) {
      throw new Error('Invalid user data returned');
    }
  });

  // 5. Test Token Refresh
  await testFeature('Token Refresh', async () => {
    const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    
    if (!response.data.accessToken || !response.data.refreshToken) {
      throw new Error('Missing new tokens');
    }
    
    accessToken = response.data.accessToken;
  });

  // 6. Test 2FA Setup
  await testFeature('Two-Factor Authentication Setup', async () => {
    const response = await axios.post(`${API_URL}/auth/2fa/setup`, 
      { password: testPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!response.data.secret || !response.data.qrCode || !response.data.backupCodes) {
      throw new Error('Missing 2FA setup data');
    }
    
    if (response.data.backupCodes.length !== 10) {
      throw new Error('Should have 10 backup codes');
    }
    
    twoFactorSecret = response.data.secret;
  });

  // 7. Test 2FA Enable
  await testFeature('Two-Factor Authentication Enable', async () => {
    const token = speakeasy.totp({
      secret: twoFactorSecret,
      encoding: 'base32',
    });
    
    const response = await axios.post(`${API_URL}/auth/2fa/enable`,
      { token },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.message !== 'Two-factor authentication enabled successfully') {
      throw new Error('2FA not enabled');
    }
  });

  // 8. Test Password Reset Request
  await testFeature('Password Reset Request', async () => {
    const response = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: testEmail,
    });
    
    if (response.data.message !== 'Password reset email sent') {
      throw new Error('Password reset request failed');
    }
  });

  // 9. Test Rate Limiting
  await testFeature('Rate Limiting', async () => {
    let rateLimited = false;
    
    // Make 15 rapid requests
    for (let i = 0; i < 15; i++) {
      try {
        await axios.post(`${API_URL}/auth/login`, {
          email: 'ratelimit@test.com',
          password: 'wrong',
        });
      } catch (error: any) {
        if (error.response?.status === 429) {
          rateLimited = true;
          break;
        }
      }
    }
    
    if (!rateLimited) {
      throw new Error('Rate limiting not working');
    }
  });

  // 10. Test Google OAuth Redirect
  await testFeature('Google OAuth Redirect', async () => {
    try {
      await axios.get(`${API_URL}/auth/google`, {
        maxRedirects: 0,
      });
    } catch (error: any) {
      if (error.response?.status !== 302) {
        throw new Error('Should redirect to Google');
      }
      
      const location = error.response.headers.location;
      if (!location || !location.includes('accounts.google.com')) {
        throw new Error('Invalid OAuth redirect');
      }
    }
  });

  // 11. Test GraphQL Health Check
  await testFeature('GraphQL Health Check', async () => {
    const response = await axios.post(`${API_URL}/graphql`, {
      query: '{ health }',
    });
    
    if (response.data.data.health !== 'OK') {
      throw new Error('GraphQL health check failed');
    }
  });

  // 12. Test Logout
  await testFeature('User Logout', async () => {
    const response = await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.data.message !== 'Logged out successfully') {
      throw new Error('Logout failed');
    }
  });

  // 13. Test Access After Logout
  await testFeature('Access Denied After Logout', async () => {
    try {
      await axios.post(`${API_URL}/auth/me`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      throw new Error('Should have been denied access');
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw error;
      }
    }
  });

  // Print Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.feature}: ${r.details}`);
    });
  }
  
  console.log('\n✨ Phase 1 Feature Testing Complete!');
}

// Run the tests
runTests().catch(console.error);