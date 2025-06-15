import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";

describe("Card components", () => {
  describe("Card", () => {
    it("renders card with default styles", () => {
      render(<Card>Card content</Card>);

      const card = screen.getByText("Card content");
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass("rounded-lg", "border", "bg-card");
    });

    it("applies custom className", () => {
      render(<Card className="custom-card">Card content</Card>);

      const card = screen.getByText("Card content");
      expect(card).toHaveClass("custom-card");
    });

    it("passes through additional props", () => {
      render(<Card data-testid="test-card">Card content</Card>);

      const card = screen.getByTestId("test-card");
      expect(card).toBeInTheDocument();
    });
  });

  describe("CardHeader", () => {
    it("renders header with default styles", () => {
      render(<CardHeader>Header content</CardHeader>);

      const header = screen.getByText("Header content");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("flex", "flex-col", "space-y-1.5", "p-6");
    });

    it("applies custom className", () => {
      render(<CardHeader className="custom-header">Header content</CardHeader>);

      const header = screen.getByText("Header content");
      expect(header).toHaveClass("custom-header");
    });
  });

  describe("CardFooter", () => {
    it("renders footer with default styles", () => {
      render(<CardFooter>Footer content</CardFooter>);

      const footer = screen.getByText("Footer content");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass("flex", "items-center", "p-6", "pt-0");
    });

    it("applies custom className", () => {
      render(<CardFooter className="custom-footer">Footer content</CardFooter>);

      const footer = screen.getByText("Footer content");
      expect(footer).toHaveClass("custom-footer");
    });
  });

  describe("CardTitle", () => {
    it("renders title with default styles", () => {
      render(<CardTitle>Card Title</CardTitle>);

      const title = screen.getByText("Card Title");
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe("H3");
      expect(title).toHaveClass("text-2xl", "font-semibold");
    });

    it("applies custom className", () => {
      render(<CardTitle className="custom-title">Card Title</CardTitle>);

      const title = screen.getByText("Card Title");
      expect(title).toHaveClass("custom-title");
    });
  });

  describe("CardDescription", () => {
    it("renders description with default styles", () => {
      render(<CardDescription>Card description text</CardDescription>);

      const description = screen.getByText("Card description text");
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe("P");
      expect(description).toHaveClass("text-sm", "text-muted-foreground");
    });

    it("applies custom className", () => {
      render(
        <CardDescription className="custom-desc">Description</CardDescription>,
      );

      const description = screen.getByText("Description");
      expect(description).toHaveClass("custom-desc");
    });
  });

  describe("CardContent", () => {
    it("renders content with default styles", () => {
      render(<CardContent>Card body content</CardContent>);

      const content = screen.getByText("Card body content");
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass("p-6", "pt-0");
    });

    it("applies custom className", () => {
      render(<CardContent className="custom-content">Content</CardContent>);

      const content = screen.getByText("Content");
      expect(content).toHaveClass("custom-content");
    });
  });

  describe("Complete card composition", () => {
    it("renders a complete card with all components", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test card</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>,
      );

      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("This is a test card")).toBeInTheDocument();
      expect(screen.getByText("Card content goes here")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });
  });
});
