import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";

// Mock Next.js Link component
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

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error from component");
  }
  return <div>Component rendered successfully</div>;
};

// Component with controlled error state
const ControlledErrorComponent = () => {
  const [shouldThrow, setShouldThrow] = React.useState(false);

  return (
    <>
      {shouldThrow && <ThrowError shouldThrow={true} />}
      {!shouldThrow && (
        <div>
          <div>Component rendered successfully</div>
          <button onClick={() => setShouldThrow(true)}>Trigger Error</button>
        </div>
      )}
    </>
  );
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid polluting test output
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("Component rendered successfully"),
    ).toBeInTheDocument();
  });

  it("should catch error and display error UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We're sorry for the inconvenience. An unexpected error has occurred.",
      ),
    ).toBeInTheDocument();
  });

  it("should display custom fallback when provided", () => {
    const CustomFallback = <div>Custom error fallback</div>;

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error fallback")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("should display error details in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("Error details (Development only)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Test error from component/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it("should not display error details in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(
      screen.queryByText("Error details (Development only)"),
    ).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it("should reset when Try again button is clicked", () => {
    // This component will throw an error on first render
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // First render should show error
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click try again
    const tryAgainButton = screen.getByText("Try again");
    fireEvent.click(tryAgainButton);

    // After reset, error boundary should try to render children again
    // But since we're still passing shouldThrow=true, it will error again
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should render homepage link", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const homepageLink = screen.getByText("Go to homepage").closest("a");
    expect(homepageLink).toHaveAttribute("href", "/");
  });

  it("should log error to console", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalledWith(
      "ErrorBoundary caught an error:",
      expect.any(Error),
      expect.any(Object),
    );
  });

  it("should render AlertCircle icon", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const iconContainer = screen
      .getByText("Something went wrong")
      .previousElementSibling?.querySelector("svg");
    expect(iconContainer).toBeInTheDocument();
  });

  it("should handle multiple errors in sequence", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // First error
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Try again - still errors
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Rerender with a working component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    // Still shows error until we click Try again
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click Try again with fixed component
    fireEvent.click(screen.getByText("Try again"));

    // Should now show the working component
    expect(
      screen.getByText("Component rendered successfully"),
    ).toBeInTheDocument();
  });

  it("should show component stack in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Click to expand details
    const detailsElement = screen
      .getByText("Error details (Development only)")
      .closest("details");
    expect(detailsElement).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
