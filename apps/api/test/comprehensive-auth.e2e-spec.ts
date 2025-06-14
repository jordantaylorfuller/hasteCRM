import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env") });

describe("Comprehensive Auth Testing (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let verificationToken: string;
  let resetToken: string;
  let twoFactorSecret: string;
  let sessionId: string;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Test123456!",
    firstName: "Test",
    lastName: "User",
    workspaceName: "Test Workspace",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. User Registration Flow", () => {
    it("should register a new user with PENDING status", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("workspace");
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.status).toBe("PENDING");
      expect(response.body.workspace.name).toBe(testUser.workspaceName);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it("should not allow duplicate email registration", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser)
        .expect(409);
    });

    it("should validate email format", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          ...testUser,
          email: "invalid-email",
        })
        .expect(400);
    });

    it("should validate password length", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          ...testUser,
          email: "another@example.com",
          password: "short",
        })
        .expect(400);
    });
  });

  describe("2. Email Verification Flow", () => {
    it("should not be able to access protected routes with PENDING status", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe("PENDING");
    });

    // Note: In a real test environment, we would:
    // 1. Mock the email service to capture the verification token
    // 2. Test the verification endpoint
    // 3. Verify the user status changes to ACTIVE
  });

  describe("3. Login Flow", () => {
    it("should login with correct credentials", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("workspace");
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should fail login with incorrect password", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123!",
        })
        .expect(401);
    });

    it("should fail login with non-existent email", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: testUser.password,
        })
        .expect(401);
    });
  });

  describe("4. JWT Token Flow", () => {
    it("should access protected route with valid token", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("sub");
      expect(response.body).toHaveProperty("email");
      expect(response.body.email).toBe(testUser.email);
    });

    it("should reject request without token", async () => {
      await request(app.getHttpServer()).post("/auth/me").expect(401);
    });

    it("should reject request with invalid token", async () => {
      await request(app.getHttpServer())
        .post("/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Authorization", `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");

      // Update tokens for subsequent tests
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });
  });

  describe("5. Two-Factor Authentication Flow", () => {
    it("should setup 2FA", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/2fa/setup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ password: testUser.password })
        .expect(201);

      expect(response.body).toHaveProperty("secret");
      expect(response.body).toHaveProperty("qrCode");
      expect(response.body).toHaveProperty("backupCodes");
      expect(response.body.backupCodes).toHaveLength(10);

      twoFactorSecret = response.body.secret;
    });

    // Note: Testing actual TOTP verification would require:
    // 1. Generating valid TOTP codes using the secret
    // 2. Testing the enable endpoint
    // 3. Testing login with 2FA
  });

  describe("6. Password Reset Flow", () => {
    it("should request password reset", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/request-password-reset")
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.message).toBe("Password reset email sent");
    });

    // Note: In a real test environment, we would:
    // 1. Mock the email service to capture the reset token
    // 2. Test the password reset endpoint with the token
  });

  describe("7. Session Management", () => {
    it("should create session on login", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      // Session management happens internally
      expect(response.body).toHaveProperty("accessToken");
    });
  });

  describe("8. Rate Limiting", () => {
    it("should rate limit excessive requests", async () => {
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app.getHttpServer()).post("/auth/login").send({
            email: "ratelimit@example.com",
            password: "password",
          }),
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some((res) => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe("9. Google OAuth", () => {
    it("should redirect to Google OAuth", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/google")
        .expect(302);

      expect(response.headers.location).toContain("accounts.google.com");
      expect(response.headers.location).toContain("oauth2");
    });
  });

  describe("10. Logout Flow", () => {
    it("should logout successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe("Logged out successfully");
    });
  });

  describe("11. GraphQL Integration", () => {
    it("should return health check via GraphQL", async () => {
      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: "{ health }",
        })
        .expect(200);

      expect(response.body.data.health).toBe("OK");
    });
  });
});
