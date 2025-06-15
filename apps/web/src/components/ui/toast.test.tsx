import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from "./toast";

describe("Toast Components", () => {
  describe("ToastProvider", () => {
    it("renders with default classes", () => {
      render(
        <ToastProvider data-testid="provider">
          <div>Content</div>
        </ToastProvider>,
      );

      const provider = screen.getByTestId("provider");
      expect(provider).toHaveClass(
        "fixed",
        "inset-0",
        "z-100",
        "pointer-events-none",
      );
    });

    it("applies custom className", () => {
      render(
        <ToastProvider className="custom-class" data-testid="provider">
          <div>Content</div>
        </ToastProvider>,
      );

      const provider = screen.getByTestId("provider");
      expect(provider).toHaveClass("custom-class");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <ToastProvider ref={ref}>
          <div>Content</div>
        </ToastProvider>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("passes through additional props", () => {
      render(
        <ToastProvider data-custom="value" data-testid="provider">
          <div>Content</div>
        </ToastProvider>,
      );

      const provider = screen.getByTestId("provider");
      expect(provider).toHaveAttribute("data-custom", "value");
    });
  });

  describe("ToastViewport", () => {
    it("renders with default classes", () => {
      render(<ToastViewport data-testid="viewport" />);

      const viewport = screen.getByTestId("viewport");
      expect(viewport).toHaveClass(
        "fixed",
        "bottom-0",
        "right-0",
        "z-[100]",
        "flex",
        "flex-col-reverse",
      );
    });

    it("applies responsive classes", () => {
      render(<ToastViewport data-testid="viewport" />);

      const viewport = screen.getByTestId("viewport");
      expect(viewport).toHaveClass("sm:bottom-auto", "sm:top-0", "sm:flex-col");
    });

    it("applies custom className", () => {
      render(
        <ToastViewport className="custom-viewport" data-testid="viewport" />,
      );

      const viewport = screen.getByTestId("viewport");
      expect(viewport).toHaveClass("custom-viewport");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ToastViewport ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Toast", () => {
    it("renders with default variant", () => {
      render(<Toast data-testid="toast">Toast content</Toast>);

      const toast = screen.getByTestId("toast");
      expect(toast).toHaveClass("border", "bg-background");
      expect(toast).not.toHaveClass("border-destructive");
    });

    it("renders with destructive variant", () => {
      render(
        <Toast variant="destructive" data-testid="toast">
          Error toast
        </Toast>,
      );

      const toast = screen.getByTestId("toast");
      expect(toast).toHaveClass(
        "border-destructive",
        "bg-destructive",
        "text-destructive-foreground",
      );
    });

    it("applies animation classes", () => {
      render(<Toast data-testid="toast">Animated toast</Toast>);

      const toast = screen.getByTestId("toast");
      expect(toast).toHaveClass("transition-all");
      expect(toast.className).toContain("data-[state=open]:animate-in");
      expect(toast.className).toContain("data-[state=closed]:animate-out");
    });

    it("applies custom className", () => {
      render(
        <Toast className="custom-toast" data-testid="toast">
          Custom toast
        </Toast>,
      );

      const toast = screen.getByTestId("toast");
      expect(toast).toHaveClass("custom-toast");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Toast ref={ref}>Toast content</Toast>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("has pointer-events-auto for interaction", () => {
      render(<Toast data-testid="toast">Interactive toast</Toast>);

      const toast = screen.getByTestId("toast");
      expect(toast).toHaveClass("pointer-events-auto");
    });
  });

  describe("ToastTitle", () => {
    it("renders with default classes", () => {
      render(<ToastTitle data-testid="title">Toast Title</ToastTitle>);

      const title = screen.getByTestId("title");
      expect(title).toHaveClass("text-sm", "font-semibold");
    });

    it("applies custom className", () => {
      render(
        <ToastTitle className="custom-title" data-testid="title">
          Custom Title
        </ToastTitle>,
      );

      const title = screen.getByTestId("title");
      expect(title).toHaveClass("custom-title");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ToastTitle ref={ref}>Title</ToastTitle>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("ToastDescription", () => {
    it("renders with default classes", () => {
      render(
        <ToastDescription data-testid="description">
          Toast description
        </ToastDescription>,
      );

      const description = screen.getByTestId("description");
      expect(description).toHaveClass("text-sm", "opacity-90");
    });

    it("applies custom className", () => {
      render(
        <ToastDescription className="custom-desc" data-testid="description">
          Custom description
        </ToastDescription>,
      );

      const description = screen.getByTestId("description");
      expect(description).toHaveClass("custom-desc");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ToastDescription ref={ref}>Description</ToastDescription>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("ToastClose", () => {
    it("renders as button with close icon", () => {
      render(<ToastClose data-testid="close" />);

      const closeButton = screen.getByTestId("close");
      expect(closeButton.tagName).toBe("BUTTON");

      // Check for SVG close icon
      const svg = closeButton.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass("h-4", "w-4");
    });

    it("has accessibility classes", () => {
      render(<ToastClose data-testid="close" />);

      const closeButton = screen.getByTestId("close");
      expect(closeButton).toHaveClass(
        "absolute",
        "right-2",
        "top-2",
        "rounded-md",
      );
      expect(closeButton.className).toContain("focus:outline-none");
      expect(closeButton.className).toContain("focus:ring-2");
    });

    it("has hover states", () => {
      render(<ToastClose data-testid="close" />);

      const closeButton = screen.getByTestId("close");
      expect(closeButton.className).toContain("hover:text-foreground");
      expect(closeButton.className).toContain("group-hover:opacity-100");
    });

    it("has destructive variant styles", () => {
      render(
        <div className="group destructive">
          <ToastClose data-testid="close" />
        </div>,
      );

      const closeButton = screen.getByTestId("close");
      expect(closeButton.className).toContain(
        "group-[.destructive]:text-red-300",
      );
      expect(closeButton.className).toContain(
        "group-[.destructive]:hover:text-red-50",
      );
    });

    it("applies custom className", () => {
      render(<ToastClose className="custom-close" data-testid="close" />);

      const closeButton = screen.getByTestId("close");
      expect(closeButton).toHaveClass("custom-close");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<ToastClose ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it("handles click events", () => {
      const handleClick = jest.fn();
      render(<ToastClose onClick={handleClick} data-testid="close" />);

      const closeButton = screen.getByTestId("close");
      fireEvent.click(closeButton);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders SVG with correct attributes", () => {
      render(<ToastClose data-testid="close" />);

      const svg = screen.getByTestId("close").querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      expect(svg).toHaveAttribute("fill", "none");
      expect(svg).toHaveAttribute("stroke", "currentColor");
      expect(svg).toHaveAttribute("stroke-width", "2");

      // Check for X icon lines
      const lines = svg?.querySelectorAll("line");
      expect(lines).toHaveLength(2);
    });
  });

  describe("Integration", () => {
    it("renders complete toast with all components", () => {
      render(
        <ToastProvider>
          <ToastViewport>
            <Toast>
              <div className="grid gap-1">
                <ToastTitle>Success</ToastTitle>
                <ToastDescription>Your action was completed</ToastDescription>
              </div>
              <ToastClose />
            </Toast>
          </ToastViewport>
        </ToastProvider>,
      );

      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Your action was completed")).toBeInTheDocument();

      const closeButton = screen.getByRole("button");
      expect(closeButton).toBeInTheDocument();
    });

    it("renders multiple toasts", () => {
      render(
        <ToastProvider>
          <ToastViewport>
            <Toast>
              <ToastTitle>Toast 1</ToastTitle>
            </Toast>
            <Toast variant="destructive">
              <ToastTitle>Toast 2</ToastTitle>
            </Toast>
          </ToastViewport>
        </ToastProvider>,
      );

      expect(screen.getByText("Toast 1")).toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
    });
  });

  describe("displayName", () => {
    it("has correct display names for debugging", () => {
      expect(ToastProvider.displayName).toBe("ToastProvider");
      expect(ToastViewport.displayName).toBe("ToastViewport");
      expect(Toast.displayName).toBe("Toast");
      expect(ToastTitle.displayName).toBe("ToastTitle");
      expect(ToastDescription.displayName).toBe("ToastDescription");
      expect(ToastClose.displayName).toBe("ToastClose");
    });
  });
});
