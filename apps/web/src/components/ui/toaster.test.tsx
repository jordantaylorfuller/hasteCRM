import React from "react";
import { render, screen, act } from "@testing-library/react";
import { Toaster } from "./toaster";
import { toast } from "./use-toast";

// Mock the use-toast hook
jest.mock("./use-toast", () => ({
  useToast: jest.fn(),
  toast: jest.fn(),
}));

const mockUseToast = require("./use-toast").useToast;

describe("Toaster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty when no toasts", () => {
    mockUseToast.mockReturnValue({ toasts: [] });

    const { container } = render(<Toaster />);

    // Should render the provider and viewport but no toasts
    expect(container.querySelector('[class*="fixed"]')).toBeInTheDocument();
  });

  it("renders single toast", () => {
    const mockToast = {
      id: "1",
      title: "Test Toast",
      description: "This is a test toast",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    render(<Toaster />);

    expect(screen.getByText("Test Toast")).toBeInTheDocument();
    expect(screen.getByText("This is a test toast")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    const mockToasts = [
      {
        id: "1",
        title: "First Toast",
        description: "First description",
      },
      {
        id: "2",
        title: "Second Toast",
        description: "Second description",
      },
      {
        id: "3",
        title: "Third Toast",
      },
    ];

    mockUseToast.mockReturnValue({ toasts: mockToasts });

    render(<Toaster />);

    expect(screen.getByText("First Toast")).toBeInTheDocument();
    expect(screen.getByText("First description")).toBeInTheDocument();
    expect(screen.getByText("Second Toast")).toBeInTheDocument();
    expect(screen.getByText("Second description")).toBeInTheDocument();
    expect(screen.getByText("Third Toast")).toBeInTheDocument();
  });

  it("renders toast without description", () => {
    const mockToast = {
      id: "1",
      title: "Title Only Toast",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    render(<Toaster />);

    expect(screen.getByText("Title Only Toast")).toBeInTheDocument();
    // Should not render description element
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("renders toast without title", () => {
    const mockToast = {
      id: "1",
      description: "Description Only Toast",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    render(<Toaster />);

    expect(screen.getByText("Description Only Toast")).toBeInTheDocument();
  });

  it("renders toast with variant", () => {
    const mockToast = {
      id: "1",
      title: "Error Toast",
      variant: "destructive",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    const { container } = render(<Toaster />);

    expect(screen.getByText("Error Toast")).toBeInTheDocument();
    // Toast component should receive the variant prop
    const toast = container.querySelector('[class*="border"]');
    expect(toast).toBeInTheDocument();
  });

  it("renders close button for each toast", () => {
    const mockToasts = [
      { id: "1", title: "Toast 1" },
      { id: "2", title: "Toast 2" },
    ];

    mockUseToast.mockReturnValue({ toasts: mockToasts });

    render(<Toaster />);

    const closeButtons = screen.getAllByRole("button");
    expect(closeButtons).toHaveLength(2);
  });

  it("updates when toasts change", () => {
    const { rerender } = render(<Toaster />);

    // Initially no toasts
    mockUseToast.mockReturnValue({ toasts: [] });
    rerender(<Toaster />);

    expect(screen.queryByText("Dynamic Toast")).not.toBeInTheDocument();

    // Add a toast
    mockUseToast.mockReturnValue({
      toasts: [{ id: "1", title: "Dynamic Toast" }],
    });
    rerender(<Toaster />);

    expect(screen.getByText("Dynamic Toast")).toBeInTheDocument();
  });

  it("handles toast with all props", () => {
    const mockToast = {
      id: "complex-1",
      title: "Complex Toast",
      description: "With all the props",
      variant: "destructive",
      duration: 5000,
      onOpenChange: jest.fn(),
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    render(<Toaster />);

    expect(screen.getByText("Complex Toast")).toBeInTheDocument();
    expect(screen.getByText("With all the props")).toBeInTheDocument();
  });

  it("renders toasts in correct structure", () => {
    const mockToast = {
      id: "1",
      title: "Structured Toast",
      description: "With proper structure",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    const { container } = render(<Toaster />);

    // Check for grid structure
    const gridContainer = container.querySelector(".grid.gap-1");
    expect(gridContainer).toBeInTheDocument();

    // Title and description should be siblings in the grid
    const title = screen.getByText("Structured Toast");
    const description = screen.getByText("With proper structure");
    expect(title.parentElement).toBe(description.parentElement);
  });

  it("passes through additional toast props", () => {
    const onOpenChange = jest.fn();
    const mockToast = {
      id: "1",
      title: "Toast with handler",
      onOpenChange,
      "data-custom": "value",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    const { container } = render(<Toaster />);

    // The Toast component should receive these props
    const toastElement = container.querySelector('[class*="border"]');
    expect(toastElement).toBeInTheDocument();
  });

  it("handles empty title and description gracefully", () => {
    const mockToast = {
      id: "1",
      title: "",
      description: "",
    };

    mockUseToast.mockReturnValue({ toasts: [mockToast] });

    const { container } = render(<Toaster />);

    // Should still render the toast structure
    const gridContainer = container.querySelector(".grid.gap-1");
    expect(gridContainer).toBeInTheDocument();

    // But no title or description elements should be rendered
    const title = gridContainer?.querySelector('[class*="font-semibold"]');
    const description = gridContainer?.querySelector('[class*="opacity-90"]');
    expect(title).not.toBeInTheDocument();
    expect(description).not.toBeInTheDocument();
  });

  it("maintains unique keys for toasts", () => {
    const mockToasts = [
      { id: "unique-1", title: "Toast 1" },
      { id: "unique-2", title: "Toast 2" },
      { id: "unique-3", title: "Toast 3" },
    ];

    mockUseToast.mockReturnValue({ toasts: mockToasts });

    // Should not throw any key warnings
    const spy = jest.spyOn(console, "error");
    render(<Toaster />);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders viewport at the end", () => {
    const mockToasts = [
      { id: "1", title: "Toast 1" },
      { id: "2", title: "Toast 2" },
    ];

    mockUseToast.mockReturnValue({ toasts: mockToasts });

    const { container } = render(<Toaster />);

    // Viewport should be the last child
    const provider = container.firstChild;
    const lastChild = provider?.lastChild;

    // Check it has viewport classes
    expect(lastChild).toHaveClass("fixed", "bottom-0", "right-0");
  });
});
