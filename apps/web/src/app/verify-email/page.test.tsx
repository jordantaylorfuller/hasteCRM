import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import VerifyEmailPage from "./page";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  api: {
    post: jest.fn(),
  },
}));

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => <a href={href}>{children}</a>,
  };
});

// Mock window.alert
const mockAlert = jest.fn();
global.alert = mockAlert;

describe("Verify Email Page", () => {
  const mockRefreshUser = jest.fn();
  const mockUser = {
    id: "1",
    email: "john@example.com",
    status: "PENDING",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
  });

  describe("With verification token", () => {
    beforeEach(() => {
      const mockSearchParams = new URLSearchParams({ token: "valid-token" });
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    });

    it("shows verifying state initially", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      expect(screen.getByText("Verifying your email...")).toBeInTheDocument();
      expect(
        screen.getByText("Please wait while we verify your email address."),
      ).toBeInTheDocument();
    });

    it("shows success state after successful verification", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      render(<VerifyEmailPage />);

      await waitFor(() => {
        expect(screen.getByText("Email verified!")).toBeInTheDocument();
        expect(
          screen.getByText("Your email has been successfully verified."),
        ).toBeInTheDocument();
        expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
      });

      expect(api.post).toHaveBeenCalledWith("/auth/verify-email", {
        token: "valid-token",
      });
      expect(mockRefreshUser).toHaveBeenCalled();
    });

    it("shows error state after failed verification", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      const errorMessage = "Invalid or expired token";
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      render(<VerifyEmailPage />);

      await waitFor(() => {
        expect(screen.getByText("Verification failed")).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(screen.getByText("Back to Login")).toBeInTheDocument();
      });
    });

    it("shows generic error message when no specific error provided", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      render(<VerifyEmailPage />);

      await waitFor(() => {
        // There are two elements with this text - the heading and description
        const failedElements = screen.getAllByText("Verification failed");
        expect(failedElements).toHaveLength(2);
        expect(failedElements[0]).toBeInTheDocument(); // heading
        expect(failedElements[1]).toBeInTheDocument(); // description
      });
    });

    it("renders success icon correctly", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      render(<VerifyEmailPage />);

      await waitFor(() => {
        const successIcon = screen
          .getByText("Email verified!")
          .parentElement?.querySelector("svg");
        expect(successIcon).toBeInTheDocument();
        expect(successIcon?.parentElement).toHaveClass("bg-green-100");
      });
    });

    it("renders error icon correctly", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockRejectedValueOnce(new Error("Failed"));

      render(<VerifyEmailPage />);

      await waitFor(() => {
        // Get the heading element (first occurrence)
        const heading = screen.getAllByText("Verification failed")[0];
        const errorIcon = heading.parentElement?.querySelector("svg");
        expect(errorIcon).toBeInTheDocument();
        expect(errorIcon?.parentElement).toHaveClass("bg-red-100");
      });
    });

    it("links to dashboard after successful verification", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      render(<VerifyEmailPage />);

      await waitFor(() => {
        const dashboardLink = screen.getByText("Go to Dashboard");
        expect(dashboardLink).toHaveAttribute("href", "/dashboard");
      });
    });

    it("links to login after failed verification", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockRejectedValueOnce(new Error("Failed"));

      render(<VerifyEmailPage />);

      await waitFor(() => {
        const loginLink = screen.getByText("Back to Login");
        expect(loginLink).toHaveAttribute("href", "/login");
      });
    });
  });

  describe("Without verification token", () => {
    beforeEach(() => {
      const mockSearchParams = new URLSearchParams();
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    });

    it("shows check email instructions", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      expect(screen.getByText("Check your email")).toBeInTheDocument();
      expect(
        screen.getByText(/We've sent a verification link/),
      ).toBeInTheDocument();
    });

    it("shows resend button for pending users", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      expect(screen.getByText("Didn't receive the email?")).toBeInTheDocument();
      expect(screen.getByText("Resend verification email")).toBeInTheDocument();
    });

    it("handles resend verification email", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      render(<VerifyEmailPage />);

      const resendButton = screen.getByText("Resend verification email");
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/auth/resend-verification");
        expect(mockAlert).toHaveBeenCalledWith(
          "Verification email sent! Please check your inbox.",
        );
      });
    });

    it("shows error when resend fails", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      const errorMessage = "Too many attempts";
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      render(<VerifyEmailPage />);

      const resendButton = screen.getByText("Resend verification email");
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it("shows generic error message for resend failure", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        refreshUser: mockRefreshUser,
      });
      (api.post as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      render(<VerifyEmailPage />);

      const resendButton = screen.getByText("Resend verification email");
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend verification email"),
        ).toBeInTheDocument();
      });
    });

    it("does not show resend button for non-pending users", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { ...mockUser, status: "ACTIVE" },
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      expect(
        screen.queryByText("Resend verification email"),
      ).not.toBeInTheDocument();
    });

    it("does not show resend button when user is not logged in", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      expect(
        screen.queryByText("Resend verification email"),
      ).not.toBeInTheDocument();
    });

    it("links back to login page", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      const loginLink = screen.getByText("Back to login");
      expect(loginLink).toHaveAttribute("href", "/login");
    });

    it("renders email icon correctly", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        refreshUser: mockRefreshUser,
      });

      render(<VerifyEmailPage />);

      const emailIcon = screen
        .getByText("Check your email")
        .parentElement?.querySelector("svg");
      expect(emailIcon).toBeInTheDocument();
      expect(emailIcon?.parentElement).toHaveClass("bg-yellow-100");
    });
  });

  it("does not verify when token is empty", () => {
    const mockSearchParams = new URLSearchParams({ token: "" });
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      refreshUser: mockRefreshUser,
    });

    render(<VerifyEmailPage />);

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
  });
});
