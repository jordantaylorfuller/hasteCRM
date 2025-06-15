import { render, screen } from "@testing-library/react";
import Loading from "./loading";

describe("Loading Page", () => {
  it("should render loading spinner and text", () => {
    render(<Loading />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should have centered layout", () => {
    const { container } = render(<Loading />);

    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass(
      "min-h-screen",
      "flex",
      "items-center",
      "justify-center",
      "bg-gray-50",
    );
  });

  it("should render animated spinner", () => {
    const { container } = render(<Loading />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass(
      "w-8",
      "h-8",
      "border-4",
      "border-blue-600",
      "border-t-transparent",
      "rounded-full",
    );
  });

  it("should have proper text styling", () => {
    render(<Loading />);

    const loadingText = screen.getByText("Loading...");
    expect(loadingText).toHaveClass("mt-4", "text-gray-600");
  });

  it("should center the spinner and text", () => {
    const { container } = render(<Loading />);

    const centerDiv = container.querySelector(".text-center");
    expect(centerDiv).toBeInTheDocument();
  });
});
