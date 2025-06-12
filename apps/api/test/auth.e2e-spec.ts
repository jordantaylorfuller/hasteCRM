import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("/auth/register (POST)", () => {
    it("should register a new user", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("workspace");
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.workspace.name).toBe(testUser.workspaceName);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it("should not register duplicate email", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser)
        .expect(409);

      expect(response.body.message).toBe("User with this email already exists");
    });

    it("should validate required fields", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({})
        .expect(400);
    });
  });

  describe("/auth/login (POST)", () => {
    it("should login with valid credentials", async () => {
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

    it("should not login with invalid password", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123",
        })
        .expect(401);

      expect(response.body.message).toBe("Invalid credentials");
    });

    it("should not login with non-existent email", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.message).toBe("Invalid credentials");
    });
  });

  describe("/auth/me (POST)", () => {
    it("should return current user with valid token", async () => {
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
  });

  describe("/auth/refresh (POST)", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Authorization", `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });
  });

  describe("/auth/logout (POST)", () => {
    it("should logout successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe("Logged out successfully");
    });
  });

  describe("/auth/google (GET)", () => {
    it("should redirect to Google OAuth", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/google")
        .expect(302);

      expect(response.headers.location).toContain("accounts.google.com");
      expect(response.headers.location).toContain("client_id=");
    });
  });

  describe("GraphQL Health Check", () => {
    it("should return OK from health query", async () => {
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
