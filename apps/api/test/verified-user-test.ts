import axios from "axios";
import * as speakeasy from "speakeasy";
import { PrismaClient } from "../../../packages/database/node_modules/.prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const API_URL = "http://localhost:4000";
const prisma = new PrismaClient();

async function createVerifiedUser() {
  const email = `verified-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  // Register user
  console.log("📝 Registering user...");
  const regResponse = await axios.post(`${API_URL}/auth/register`, {
    email,
    password,
    firstName: "Test",
    lastName: "User",
    workspaceName: "Test Workspace",
  });

  // Manually verify user in database (simulating email click)
  console.log("✉️ Verifying email...");
  await prisma.user.update({
    where: { email },
    data: { status: "ACTIVE" },
  });

  return { email, password, ...regResponse.data };
}

async function testAllFeatures() {
  console.log("🚀 Testing Phase 1 Features with Verified User\n");

  try {
    // Create and verify user
    const { email, password } = await createVerifiedUser();

    // 1. Test Login
    console.log("✅ Testing login...");
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });

    let { accessToken, refreshToken } = loginResponse.data;
    console.log("  ✓ Login successful");

    // 2. Test Protected Route
    console.log("✅ Testing protected route...");
    await axios.post(
      `${API_URL}/auth/me`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    console.log("  ✓ Protected route access successful");

    // 3. Test Token Refresh
    console.log("✅ Testing token refresh...");
    const refreshResponse = await axios.post(
      `${API_URL}/auth/refresh`,
      {},
      {
        headers: { Authorization: `Bearer ${refreshToken}` },
      },
    );
    accessToken = refreshResponse.data.accessToken;
    console.log("  ✓ Token refresh successful");

    // 4. Test 2FA Setup
    console.log("✅ Testing 2FA setup...");
    const tfaResponse = await axios.post(
      `${API_URL}/auth/2fa/setup`,
      { password },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const { secret, backupCodes } = tfaResponse.data;
    console.log("  ✓ 2FA setup successful");
    console.log(`  ✓ Generated ${backupCodes.length} backup codes`);

    // 5. Test 2FA Enable
    console.log("✅ Testing 2FA enable...");
    const token = speakeasy.totp({
      secret,
      encoding: "base32",
    });

    await axios.post(
      `${API_URL}/auth/2fa/enable`,
      { token },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    console.log("  ✓ 2FA enabled successfully");

    // 6. Test Login with 2FA
    console.log("✅ Testing login with 2FA...");
    const tfaLoginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });

    if (tfaLoginResponse.data.requiresTwoFactor) {
      console.log("  ✓ 2FA challenge received");

      // Verify with TOTP
      const newToken = speakeasy.totp({
        secret,
        encoding: "base32",
      });

      const verifyResponse = await axios.post(`${API_URL}/auth/2fa/verify`, {
        email,
        token: newToken,
      });

      console.log("  ✓ 2FA verification successful");
    }

    // 7. Test Password Reset
    console.log("✅ Testing password reset request...");
    await axios.post(`${API_URL}/auth/forgot-password`, { email });
    console.log("  ✓ Password reset email sent");

    // 8. Test Email Verification Resend
    console.log("✅ Testing verification email resend...");
    await axios.post(`${API_URL}/auth/resend-verification`, { email });
    console.log("  ✓ Verification email resent");

    // 9. Test Session Management
    console.log("✅ Testing session management...");
    const sessionsResponse = await axios.get(`${API_URL}/auth/sessions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log(`  ✓ Retrieved ${sessionsResponse.data.length} sessions`);

    // 10. Test Logout
    console.log("✅ Testing logout...");
    await axios.post(
      `${API_URL}/auth/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    console.log("  ✓ Logout successful");

    console.log("\n✨ All tests passed!");
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.error("   Make sure all routes are properly registered");
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testAllFeatures().catch(console.error);
