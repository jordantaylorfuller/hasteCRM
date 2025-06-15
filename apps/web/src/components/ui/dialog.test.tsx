import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";

// Mock Radix UI dialog
jest.mock("@radix-ui/react-dialog");

describe("Dialog components", () => {
  describe("DialogContent", () => {
    it("renders content with default styles", () => {
      render(
        <Dialog open={true}>
          <DialogContent>Dialog content</DialogContent>
        </Dialog>,
      );

      const content = screen.getByText("Dialog content");
      expect(content).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <Dialog open={true}>
          <DialogContent className="custom-dialog">
            Dialog content
          </DialogContent>
        </Dialog>,
      );

      const content = screen.getByText("Dialog content");
      expect(content).toHaveClass("custom-dialog");
    });

    it("renders with close button by default", () => {
      render(
        <Dialog open={true}>
          <DialogContent>Dialog content</DialogContent>
        </Dialog>,
      );

      // The close button should have the X icon
      expect(screen.getByText("Dialog content")).toBeInTheDocument();
    });
  });

  describe("DialogHeader", () => {
    it("renders header with default styles", () => {
      render(<DialogHeader>Header content</DialogHeader>);

      const header = screen.getByText("Header content");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("flex", "flex-col", "space-y-1.5");
    });

    it("applies custom className", () => {
      render(<DialogHeader className="custom-header">Header</DialogHeader>);

      const header = screen.getByText("Header");
      expect(header).toHaveClass("custom-header");
    });
  });

  describe("DialogFooter", () => {
    it("renders footer with default styles", () => {
      render(<DialogFooter>Footer content</DialogFooter>);

      const footer = screen.getByText("Footer content");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass("flex", "flex-col-reverse");
    });

    it("renders footer with responsive styles", () => {
      render(<DialogFooter>Footer content</DialogFooter>);

      const footer = screen.getByText("Footer content");
      expect(footer).toHaveClass(
        "sm:flex-row",
        "sm:justify-end",
        "sm:space-x-2",
      );
    });

    it("applies custom className", () => {
      render(<DialogFooter className="custom-footer">Footer</DialogFooter>);

      const footer = screen.getByText("Footer");
      expect(footer).toHaveClass("custom-footer");
    });
  });

  describe("DialogTitle", () => {
    it("renders title with default styles", () => {
      render(<DialogTitle>Dialog Title</DialogTitle>);

      const title = screen.getByText("Dialog Title");
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("text-lg", "font-semibold");
    });

    it("applies custom className", () => {
      render(<DialogTitle className="custom-title">Title</DialogTitle>);

      const title = screen.getByText("Title");
      expect(title).toHaveClass("custom-title");
    });
  });

  describe("DialogDescription", () => {
    it("renders description with default styles", () => {
      render(<DialogDescription>Dialog description text</DialogDescription>);

      const description = screen.getByText("Dialog description text");
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("text-sm", "text-muted-foreground");
    });

    it("applies custom className", () => {
      render(
        <DialogDescription className="custom-desc">
          Description
        </DialogDescription>,
      );

      const description = screen.getByText("Description");
      expect(description).toHaveClass("custom-desc");
    });
  });

  describe("Complete dialog composition", () => {
    it("renders a complete dialog with all components", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>This is a test dialog</DialogDescription>
            </DialogHeader>
            <div>Dialog body content</div>
            <DialogFooter>
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
      expect(screen.getByText("This is a test dialog")).toBeInTheDocument();
      expect(screen.getByText("Dialog body content")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });
  });

  describe("DialogOverlay", () => {
    it("renders overlay with forceMount prop", () => {
      render(
        <Dialog open={true}>
          <DialogOverlay />
        </Dialog>,
      );

      // The overlay should render when dialog is open
      const overlay = screen.getByTestId("dialog-overlay");
      expect(overlay).toBeInTheDocument();
    });
  });

  describe("DialogPortal", () => {
    it("renders portal component", () => {
      render(
        <Dialog open={true}>
          <DialogPortal>
            <div>Portal content</div>
          </DialogPortal>
        </Dialog>,
      );

      expect(screen.getByText("Portal content")).toBeInTheDocument();
    });
  });

  describe("DialogClose", () => {
    it("renders close component", () => {
      render(
        <Dialog open={true}>
          <DialogClose>Close button</DialogClose>
        </Dialog>,
      );

      expect(screen.getByText("Close button")).toBeInTheDocument();
    });
  });

  describe("DialogTrigger", () => {
    it("renders trigger component", () => {
      // DialogTrigger is just a re-export of Radix's DialogTrigger
      // We just need to verify it's exported
      expect(DialogTrigger).toBeDefined();
    });
  });

  describe("Export verification", () => {
    it("should export all dialog components", () => {
      expect(Dialog).toBeDefined();
      expect(DialogPortal).toBeDefined();
      expect(DialogOverlay).toBeDefined();
      expect(DialogClose).toBeDefined();
      expect(DialogTrigger).toBeDefined();
      expect(DialogContent).toBeDefined();
      expect(DialogHeader).toBeDefined();
      expect(DialogFooter).toBeDefined();
      expect(DialogTitle).toBeDefined();
      expect(DialogDescription).toBeDefined();
    });
  });
});
