import axios from 'axios';
import { PrismaClient } from '../src/modules/prisma/prisma-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as speakeasy from 'speakeasy';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const API_URL = 'http://localhost:4000';
const prisma = new PrismaClient();

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL';
  error?: string;
}

const results: TestResult[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function test(category: string, testName: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ category, test: testName, status: 'PASS' });
    console.log(`  ✅ ${testName}`);
  } catch (error: any) {
    results.push({ category, test: testName, status: 'FAIL', error: error.message });
    console.log(`  ❌ ${testName}: ${error.message}`);
  }
}

async function runComprehensiveTest() {
  console.log('🔬 PHASE 1 - 100% VERIFICATION TEST\n');
  console.log('Testing every single feature...\n');
  
  const timestamp = Date.now();
  const testEmail = `complete-${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let workspaceId: string;
  let totpSecret: string;
  let backupCodes: string[];

  // 1. REGISTRATION & VALIDATION
  console.log('1️⃣ REGISTRATION & VALIDATION\n');
  
  await test('Registration', 'Create new user account', async () => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      firstName: 'Complete',
      lastName: 'Test',
      workspaceName: 'Complete Test Workspace',
    });
    
    if (!response.data.user || !response.data.workspace) {
      throw new Error('Missing user or workspace data');
    }
    
    userId = response.data.user.id;
    workspaceId = response.data.workspace.id;
    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
  });
  
  await delay(500);
  
  await test('Registration', 'Prevent duplicate email', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: testPassword,
        firstName: 'Duplicate',
        lastName: 'User',
        workspaceName: 'Duplicate Workspace',
      });
      throw new Error('Should have rejected duplicate email');
    } catch (error: any) {
      if (error.response?.status !== 409) {
        throw new Error(`Expected 409, got ${error.response?.status}`);
      }
    }
  });
  
  await test('Registration', 'Validate email format', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'invalid-email',
        password: testPassword,
        firstName: 'Invalid',
        lastName: 'Email',
        workspaceName: 'Test',
      });
      throw new Error('Should have rejected invalid email');
    } catch (error: any) {
      if (error.response?.status !== 400) {
        throw new Error(`Expected 400, got ${error.response?.status}`);
      }
    }
  });
  
  await test('Registration', 'Validate password length', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'short@test.com',
        password: 'short',
        firstName: 'Short',
        lastName: 'Pass',
        workspaceName: 'Test',
      });
      throw new Error('Should have rejected short password');
    } catch (error: any) {
      if (error.response?.status !== 400) {
        throw new Error(`Expected 400, got ${error.response?.status}`);
      }
    }
  });
  
  await delay(1000);
  
  // 2. EMAIL VERIFICATION
  console.log('\n2️⃣ EMAIL VERIFICATION\n');
  
  await test('Email', 'Block login before verification', async () => {
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: testEmail,
        password: testPassword,
      });
      throw new Error('Should have blocked unverified login');
    } catch (error: any) {
      if (!error.response?.data.message?.includes('verify')) {
        throw new Error('Expected verification message');
      }
    }
  });
  
  await test('Email', 'Verify email with token', async () => {
    const token = await prisma.token.findFirst({
      where: {
        userId,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
    });
    
    if (!token) throw new Error('No verification token found');
    
    await axios.post(`${API_URL}/auth/verify-email`, { token: token.token });
  });
  
  await test('Email', 'Resend verification (should fail - already verified)', async () => {
    try {
      await axios.post(`${API_URL}/auth/resend-verification`, { email: testEmail });
      throw new Error('Should have rejected - already verified');
    } catch (error: any) {
      if (error.response?.status !== 400) {
        throw new Error(`Expected 400, got ${error.response?.status}`);
      }
    }
  });
  
  await delay(1000);
  
  // 3. LOGIN & JWT
  console.log('\n3️⃣ LOGIN & JWT AUTHENTICATION\n');
  
  await test('Login', 'Login with correct credentials', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    
    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
    
    if (!accessToken || !refreshToken) {
      throw new Error('Missing tokens');
    }
  });
  
  await test('Login', 'Reject wrong password', async () => {
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: testEmail,
        password: 'WrongPassword123!',
      });
      throw new Error('Should have rejected wrong password');
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401, got ${error.response?.status}`);
      }
    }
  });
  
  await test('JWT', 'Access protected /me endpoint', async () => {
    const response = await axios.post(`${API_URL}/auth/me`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.data) {
      throw new Error('No user data returned');
    }
  });
  
  await test('JWT', 'Reject invalid token', async () => {
    try {
      await axios.post(`${API_URL}/auth/me`, {}, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      throw new Error('Should have rejected invalid token');
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401, got ${error.response?.status}`);
      }
    }
  });
  
  await test('JWT', 'Refresh access token', async () => {
    const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    
    if (!response.data.accessToken) {
      throw new Error('No new access token returned');
    }
    
    accessToken = response.data.accessToken;
  });
  
  await delay(1000);
  
  // 4. WORKSPACE
  console.log('\n4️⃣ WORKSPACE MANAGEMENT\n');
  
  await test('Workspace', 'User has workspace assigned', async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspaces: true },
    });
    
    if (!user?.workspaces.length) {
      throw new Error('User has no workspace');
    }
  });
  
  await test('Workspace', 'Workspace has unique slug', async () => {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    
    if (!workspace?.slug) {
      throw new Error('Workspace missing slug');
    }
  });
  
  await delay(1000);
  
  // 5. TWO-FACTOR AUTHENTICATION
  console.log('\n5️⃣ TWO-FACTOR AUTHENTICATION\n');
  
  await test('2FA', 'Setup 2FA', async () => {
    const response = await axios.post(
      `${API_URL}/auth/2fa/setup`,
      { password: testPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    totpSecret = response.data.secret;
    backupCodes = response.data.backupCodes;
    
    if (!totpSecret || !backupCodes) {
      throw new Error('Missing 2FA setup data');
    }
  });
  
  await test('2FA', 'Enable 2FA', async () => {
    const token = speakeasy.totp({
      secret: totpSecret,
      encoding: 'base32',
    });
    
    await axios.post(
      `${API_URL}/auth/2fa/enable`,
      { token },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  });
  
  await test('2FA', 'Login requires 2FA', async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    
    if (!response.data.requiresTwoFactor) {
      throw new Error('Should require 2FA');
    }
  });
  
  await test('2FA', 'Login with 2FA token', async () => {
    const token = speakeasy.totp({
      secret: totpSecret,
      encoding: 'base32',
    });
    
    const response = await axios.post(`${API_URL}/auth/login/2fa`, {
      email: testEmail,
      password: testPassword,
      token,
    });
    
    if (!response.data.accessToken) {
      throw new Error('2FA login failed');
    }
    
    accessToken = response.data.accessToken;
  });
  
  await test('2FA', 'Verify backup code', async () => {
    const response = await axios.post(
      `${API_URL}/auth/2fa/recover`,
      { 
        password: testPassword,
        backupCode: backupCodes[0]
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!response.data.message) {
      throw new Error('Backup code verification failed');
    }
  });
  
  await test('2FA', 'Disable 2FA', async () => {
    await axios.post(
      `${API_URL}/auth/2fa/disable`,
      { password: testPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  });
  
  await delay(1000);
  
  // 6. PASSWORD RESET
  console.log('\n6️⃣ PASSWORD RESET\n');
  
  await test('Password', 'Request password reset', async () => {
    const response = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: testEmail,
    });
    
    if (response.data.message !== 'If the email exists, a password reset link has been sent') {
      throw new Error('Unexpected message');
    }
  });
  
  await test('Password', 'Reset token created', async () => {
    const token = await prisma.token.findFirst({
      where: {
        userId,
        type: 'PASSWORD_RESET',
        usedAt: null,
      },
    });
    
    if (!token) {
      throw new Error('No reset token found');
    }
  });
  
  await delay(1000);
  
  // 7. OAUTH
  console.log('\n7️⃣ GOOGLE OAUTH\n');
  
  await test('OAuth', 'Google OAuth redirect', async () => {
    try {
      await axios.get(`${API_URL}/auth/google`, {
        maxRedirects: 0,
      });
    } catch (error: any) {
      if (error.response?.status !== 302) {
        throw new Error('Should redirect');
      }
      
      const location = error.response.headers.location;
      if (!location?.includes('accounts.google.com')) {
        throw new Error('Invalid redirect');
      }
    }
  });
  
  await test('OAuth', 'OAuth callback exists', async () => {
    try {
      await axios.get(`${API_URL}/auth/google/callback?code=test`);
    } catch (error: any) {
      // Should fail with auth error, not 404
      if (error.response?.status === 404) {
        throw new Error('Callback endpoint not found');
      }
    }
  });
  
  await delay(1000);
  
  // 8. SESSION MANAGEMENT
  console.log('\n8️⃣ SESSION MANAGEMENT\n');
  
  await test('Session', 'Get active sessions', async () => {
    const response = await axios.get(`${API_URL}/auth/sessions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!Array.isArray(response.data)) {
      throw new Error('Should return session array');
    }
  });
  
  await test('Session', 'Revoke all sessions', async () => {
    await axios.delete(`${API_URL}/auth/sessions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  });
  
  await delay(1000);
  
  // 9. RATE LIMITING
  console.log('\n9️⃣ RATE LIMITING\n');
  
  await test('RateLimit', 'Enforce login rate limit', async () => {
    let limited = false;
    
    for (let i = 0; i < 25; i++) {
      try {
        await axios.post(`${API_URL}/auth/login`, {
          email: `ratelimit${i}@test.com`,
          password: 'wrong',
        });
      } catch (error: any) {
        if (error.response?.status === 429) {
          limited = true;
          break;
        }
      }
    }
    
    if (!limited) {
      throw new Error('Rate limiting not working');
    }
  });
  
  await delay(1000);
  
  // 10. ADDITIONAL FEATURES
  console.log('\n🔟 ADDITIONAL FEATURES\n');
  
  await test('GraphQL', 'Health check query', async () => {
    const response = await axios.post(`${API_URL}/graphql`, {
      query: '{ health }'
    });
    
    if (response.data.data.health !== 'OK') {
      throw new Error('GraphQL health check failed');
    }
  });
  
  await test('Logout', 'Logout endpoint', async () => {
    const response = await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.data.message) {
      throw new Error('Logout failed');
    }
  });
  
  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const categories = [...new Set(results.map(r => r.category))];
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'PASS').length;
    const total = categoryResults.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`${category}: ${passed}/${total} (${percentage}%)`);
  });
  
  const totalPassed = results.filter(r => r.status === 'PASS').length;
  const totalTests = results.length;
  const overallPercentage = Math.round((totalPassed / totalTests) * 100);
  
  console.log('='.repeat(60));
  console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
  console.log('='.repeat(60));
  
  if (overallPercentage === 100) {
    console.log('\n🎉 PHASE 1 IS 100% COMPLETE AND WORKING!');
    console.log('All authentication features are fully functional.\n');
  } else {
    console.log('\n⚠️  Some tests failed:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`  - ${r.category}/${r.test}: ${r.error}`));
  }
  
  await prisma.$disconnect();
}

// Run the test
runComprehensiveTest().catch(console.error);