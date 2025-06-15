import React from "react";
import { render } from "@testing-library/react";
import RootLayout from "./layout";

// Mock the CSS import
jest.mock("./globals.css", () => ({}));

// Mock AuthProvider
jest.mock("@/lib/auth-context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

// Mock ErrorBoundary
jest.mock("@/components/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

describe("RootLayout", () => {
  it("renders children within providers", () => {
    const { container, getByTestId, getByText } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>,
    );

    // Check HTML structure
    expect(container.querySelector("html")).toBeInTheDocument();
    expect(container.querySelector("html")).toHaveAttribute("lang", "en");
    expect(container.querySelector("body")).toBeInTheDocument();

    // Check providers are rendered
    expect(getByTestId("error-boundary")).toBeInTheDocument();
    expect(getByTestId("auth-provider")).toBeInTheDocument();

    // Check children are rendered
    expect(getByText("Test Content")).toBeInTheDocument();
  });

  it("has correct nesting order", () => {
    const { container } = render(
      <RootLayout>
        <div data-testid="child">Test Content</div>
      </RootLayout>,
    );

    const html = container.querySelector("html");
    const body = html?.querySelector("body");
    const errorBoundary = body?.querySelector('[data-testid="error-boundary"]');
    const authProvider = errorBoundary?.querySelector(
      '[data-testid="auth-provider"]',
    );
    const child = authProvider?.querySelector('[data-testid="child"]');

    expect(html).toBeInTheDocument();
    expect(body).toBeInTheDocument();
    expect(errorBoundary).toBeInTheDocument();
    expect(authProvider).toBeInTheDocument();
    expect(child).toBeInTheDocument();
  });

  it("exports metadata", () => {
    // Import the actual module to check metadata export
    const layoutModule = require("./layout");

    expect(layoutModule.metadata).toBeDefined();
    expect(layoutModule.metadata.title).toBe("hasteCRM");
    expect(layoutModule.metadata.description).toBe("AI-powered CRM platform");
  });
});
