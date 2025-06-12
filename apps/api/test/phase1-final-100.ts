import axios from 'axios';
import { PrismaClient } from '../src/modules/prisma/prisma-client';
import * as speakeasy from 'speakeasy';

const API_URL = 'http://localhost:4000';
const prisma = new PrismaClient();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function test100Percent() {
  console.log('🎯 PHASE 1 - FINAL 100% TEST\n');
  
  // Clear rate limits
  console.log('Clearing rate limits...');
  await delay(2000);
  
  const timestamp = Date.now();
  const testEmail = `final100-${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';
  let accessToken: string;
  let userId: string;
  let totpSecret: string;
  let backupCodes: string[];
  
  const tests = {
    passed: 0,
    total: 0
  };
  
  async function runTest(name: string, fn: () => Promise<void>) {
    tests.total++;
    try {
      await fn();
      console.log(`✅ ${name}`);
      tests.passed++;
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
    }
    await delay(300); // Small delay between tests
  }
  
  // REGISTRATION
  console.log('\n📝 REGISTRATION\n');
  
  await runTest('Register new user', async () => {
    const res = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      firstName: 'Final',
      lastName: 'Test',
      workspaceName: 'Final Workspace',
    });
    userId = res.data.user.id;
    accessToken = res.data.accessToken;
  });
  
  await delay(1000);
  
  await runTest('Block duplicate email', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: testPassword,
        firstName: 'Dup',
        lastName: 'User',
        workspaceName: 'Dup',
      });
      throw new Error('Should block duplicate');
    } catch (e: any) {
      if (e.response?.status !== 409) throw e;
    }
  });
  
  // EMAIL VERIFICATION
  console.log('\n📧 EMAIL VERIFICATION\n');
  
  await runTest('Block unverified login', async () => {
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: testEmail,
        password: testPassword,
      });
      throw new Error('Should block unverified');
    } catch (e: any) {
      if (!e.response?.data.message?.includes('verify')) throw e;
    }
  });
  
  await runTest('Verify email', async () => {
    const token = await prisma.token.findFirst({
      where: { userId, type: 'EMAIL_VERIFICATION', usedAt: null },
    });
    await axios.post(`${API_URL}/auth/verify-email`, { token: token!.token });
  });
  
  // LOGIN & JWT
  console.log('\n🔐 LOGIN & JWT\n');
  
  await runTest('Login success', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    accessToken = res.data.accessToken;
  });
  
  await runTest('Access protected route', async () => {
    await axios.post(`${API_URL}/auth/me`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  });
  
  await runTest('Refresh token', async () => {
    const res = await axios.post(`${API_URL}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    accessToken = res.data.accessToken;
  });
  
  // 2FA
  console.log('\n🔒 TWO-FACTOR AUTH\n');
  
  await runTest('Setup 2FA', async () => {
    const res = await axios.post(
      `${API_URL}/auth/2fa/setup`,
      { password: testPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    totpSecret = res.data.secret;
    backupCodes = res.data.backupCodes;
  });
  
  await runTest('Enable 2FA', async () => {
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
  
  await delay(1000);
  
  await runTest('Login with 2FA', async () => {
    // First login to get 2FA prompt
    const res1 = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    
    if (!res1.data.requiresTwoFactor) {
      throw new Error('Should require 2FA');
    }
    
    // Then login with 2FA token
    const token = speakeasy.totp({
      secret: totpSecret,
      encoding: 'base32',
    });
    
    const res2 = await axios.post(`${API_URL}/auth/login/2fa`, {
      email: testEmail,
      password: testPassword,
      token,
    });
    
    accessToken = res2.data.accessToken;
  });
  
  await runTest('Disable 2FA', async () => {
    await axios.post(
      `${API_URL}/auth/2fa/disable`,
      { password: testPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  });
  
  // SESSIONS
  console.log('\n🖥️  SESSIONS\n');
  
  await runTest('Get sessions', async () => {
    const res = await axios.get(`${API_URL}/auth/sessions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!Array.isArray(res.data)) throw new Error('Invalid response');
  });
  
  // PASSWORD RESET
  console.log('\n🔑 PASSWORD RESET\n');
  
  await runTest('Request reset', async () => {
    const res = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: testEmail,
    });
    if (!res.data.message) throw new Error('No message');
  });
  
  // OAUTH
  console.log('\n🌐 OAUTH\n');
  
  await runTest('Google OAuth', async () => {
    try {
      await axios.get(`${API_URL}/auth/google`, { maxRedirects: 0 });
    } catch (e: any) {
      if (e.response?.status !== 302) throw e;
      if (!e.response.headers.location?.includes('google.com')) {
        throw new Error('Invalid redirect');
      }
    }
  });
  
  // OTHER
  console.log('\n⚡ OTHER FEATURES\n');
  
  await runTest('GraphQL health', async () => {
    const res = await axios.post(`${API_URL}/graphql`, {
      query: '{ health }'
    });
    if (res.data.data.health !== 'OK') throw new Error('Not OK');
  });
  
  await runTest('Rate limiting', async () => {
    let limited = false;
    for (let i = 0; i < 30; i++) {
      try {
        await axios.post(`${API_URL}/auth/login`, {
          email: `limit${i}@test.com`,
          password: 'wrong',
        });
      } catch (e: any) {
        if (e.response?.status === 429) {
          limited = true;
          break;
        }
      }
    }
    if (!limited) throw new Error('Not limited');
  });
  
  // SUMMARY
  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESULTS: ${tests.passed}/${tests.total} tests passed`);
  console.log('='.repeat(50));
  
  const percentage = Math.round((tests.passed / tests.total) * 100);
  
  if (percentage === 100) {
    console.log('\n🎉🎉🎉 PHASE 1 IS 100% COMPLETE! 🎉🎉🎉');
    console.log('\nAll authentication features are working perfectly!');
    console.log('Ready to proceed to Phase 2: Contact Management\n');
  } else {
    console.log(`\n⚠️  ${percentage}% Complete`);
    console.log(`${tests.total - tests.passed} tests need attention\n`);
  }
  
  await prisma.$disconnect();
}

// Run test
test100Percent().catch(console.error);