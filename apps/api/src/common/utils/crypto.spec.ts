import { hashPassword, comparePassword, generateRandomToken } from "./crypto";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

// Mock bcrypt
jest.mock("bcrypt");

// Mock crypto
jest.mock("crypto");

describe("Crypto Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hashPassword", () => {
    it("should hash a valid password", async () => {
      const password = "mySecurePassword123";
      const hashedPassword = "hashed_password_123";
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });

    it("should throw error for empty password", async () => {
      await expect(hashPassword("")).rejects.toThrow(
        "Password cannot be empty",
      );
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it("should throw error for null password", async () => {
      await expect(hashPassword(null as any)).rejects.toThrow(
        "Password cannot be empty",
      );
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it("should throw error for undefined password", async () => {
      await expect(hashPassword(undefined as any)).rejects.toThrow(
        "Password cannot be empty",
      );
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it("should handle bcrypt errors", async () => {
      const password = "password123";
      const error = new Error("Bcrypt error");
      (bcrypt.hash as jest.Mock).mockRejectedValue(error);

      await expect(hashPassword(password)).rejects.toThrow("Bcrypt error");
    });
  });

  describe("comparePassword", () => {
    it("should return true for matching password", async () => {
      const password = "myPassword";
      const hash = "hashed_password";
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it("should return false for non-matching password", async () => {
      const password = "wrongPassword";
      const hash = "hashed_password";
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await comparePassword(password, hash);

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it("should handle empty password", async () => {
      const hash = "hashed_password";
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await comparePassword("", hash);

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith("", hash);
    });

    it("should handle empty hash", async () => {
      const password = "password";
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await comparePassword(password, "");

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, "");
    });

    it("should handle bcrypt errors", async () => {
      const password = "password";
      const hash = "hash";
      const error = new Error("Compare error");
      (bcrypt.compare as jest.Mock).mockRejectedValue(error);

      await expect(comparePassword(password, hash)).rejects.toThrow(
        "Compare error",
      );
    });
  });

  describe("generateRandomToken", () => {
    beforeEach(() => {
      const mockBuffer = {
        toString: jest.fn().mockReturnValue("random_token_hex"),
      };
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockBuffer);
    });

    it("should generate token with default length", () => {
      const result = generateRandomToken();

      expect(result).toBe("random_token_hex");
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it("should generate token with custom length", () => {
      const result = generateRandomToken(16);

      expect(result).toBe("random_token_hex");
      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
    });

    it("should generate token with zero length", () => {
      const result = generateRandomToken(0);

      expect(result).toBe("random_token_hex");
      expect(crypto.randomBytes).toHaveBeenCalledWith(0);
    });

    it("should generate token with large length", () => {
      const result = generateRandomToken(256);

      expect(result).toBe("random_token_hex");
      expect(crypto.randomBytes).toHaveBeenCalledWith(256);
    });

    it("should handle crypto errors", () => {
      const error = new Error("Crypto error");
      (crypto.randomBytes as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => generateRandomToken()).toThrow("Crypto error");
    });
  });
});
