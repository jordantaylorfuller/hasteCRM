import { Test, TestingModule } from "@nestjs/testing";
import { GoogleStrategy } from "./google.strategy";
import { AuthService } from "../auth.service";
import { ConfigService } from "@nestjs/config";

describe("GoogleStrategy", () => {
  let strategy: GoogleStrategy;
  let _authService: AuthService;

  const mockAuthService = {
    validateOAuthUser: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === "GOOGLE_CLIENT_ID") return "test-client-id";
      if (key === "GOOGLE_CLIENT_SECRET") return "test-client-secret";
      if (key === "GOOGLE_CALLBACK_URL")
        return "http://localhost/auth/google/callback";
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
    _authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validate", () => {
    const mockAccessToken = "mock-access-token";
    const mockRefreshToken = "mock-refresh-token";
    const mockProfile = {
      id: "google-123",
      name: {
        givenName: "John",
        familyName: "Doe",
      },
      emails: [{ value: "john.doe@example.com", verified: true }],
      photos: [{ value: "https://example.com/photo.jpg" }],
    };

    it("should validate OAuth user successfully", async () => {
      const expectedUser = {
        id: "user-123",
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      mockAuthService.validateOAuthUser.mockResolvedValue(expectedUser);

      const done = jest.fn();
      await strategy.validate(
        mockAccessToken,
        mockRefreshToken,
        mockProfile,
        done,
      );

      expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith({
        googleId: "google-123",
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
        avatar: "https://example.com/photo.jpg",
      });

      expect(done).toHaveBeenCalledWith(null, expectedUser);
    });

    it("should handle errors during validation", async () => {
      const error = new Error("Validation failed");
      mockAuthService.validateOAuthUser.mockRejectedValue(error);

      const done = jest.fn();
      await strategy.validate(
        mockAccessToken,
        mockRefreshToken,
        mockProfile,
        done,
      );

      expect(done).toHaveBeenCalledWith(error, null);
    });

    it("should handle profile without photos", async () => {
      const profileWithoutPhotos = {
        ...mockProfile,
        photos: [],
      };

      const expectedUser = {
        id: "user-123",
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      mockAuthService.validateOAuthUser.mockResolvedValue(expectedUser);

      const done = jest.fn();
      await strategy.validate(
        mockAccessToken,
        mockRefreshToken,
        profileWithoutPhotos,
        done,
      );

      expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith({
        googleId: "google-123",
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
        avatar: undefined,
      });

      expect(done).toHaveBeenCalledWith(null, expectedUser);
    });

    it("should use first email from profile", async () => {
      const profileWithMultipleEmails = {
        ...mockProfile,
        emails: [
          { value: "primary@example.com", verified: true },
          { value: "secondary@example.com", verified: false },
        ],
      };

      const expectedUser = {
        id: "user-123",
        email: "primary@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      mockAuthService.validateOAuthUser.mockResolvedValue(expectedUser);

      const done = jest.fn();
      await strategy.validate(
        mockAccessToken,
        mockRefreshToken,
        profileWithMultipleEmails,
        done,
      );

      expect(mockAuthService.validateOAuthUser).toHaveBeenCalledWith({
        googleId: "google-123",
        email: "primary@example.com",
        firstName: "John",
        lastName: "Doe",
        avatar: "https://example.com/photo.jpg",
      });

      expect(done).toHaveBeenCalledWith(null, expectedUser);
    });
  });
});
