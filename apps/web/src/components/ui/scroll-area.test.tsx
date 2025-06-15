import React from "react";
import { render, screen } from "@testing-library/react";
import { ScrollArea, ScrollBar } from "./scroll-area";

// Mock Radix UI scroll area
jest.mock("@radix-ui/react-scroll-area", () => ({
  Root: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  Viewport: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  ScrollAreaScrollbar: ({
    children,
    className,
    orientation,
    ...props
  }: any) => (
    <div className={className} data-orientation={orientation} {...props}>
      {children}
    </div>
  ),
  ScrollAreaThumb: ({ className, ...props }: any) => (
    <div className={className} {...props} />
  ),
  Corner: ({ className, ...props }: any) => (
    <div className={className} {...props} />
  ),
}));

describe("ScrollArea", () => {
  it("renders scroll area with content", () => {
    render(
      <ScrollArea>
        <div>Scrollable content</div>
      </ScrollArea>,
    );

    expect(screen.getByText("Scrollable content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <ScrollArea className="custom-scroll h-[200px]">
        <div>Content</div>
      </ScrollArea>,
    );

    const scrollArea = screen.getByText("Content").parentElement?.parentElement;
    expect(scrollArea).toHaveClass("custom-scroll", "h-[200px]");
  });

  it("renders with default styles", () => {
    render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );

    const scrollArea = screen.getByText("Content").parentElement?.parentElement;
    expect(scrollArea).toHaveClass("relative", "overflow-hidden");
  });

  it("renders viewport with proper styles", () => {
    render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );

    const viewport = screen.getByText("Content").parentElement;
    expect(viewport).toHaveClass("h-full", "w-full", "rounded-[inherit]");
  });

  it("renders scrollbars", () => {
    const { container } = render(
      <ScrollArea>
        <div>Long content that requires scrolling</div>
      </ScrollArea>,
    );

    // Check for vertical scrollbar
    const verticalScrollbar = container.querySelector(
      '[data-orientation="vertical"]',
    );
    expect(verticalScrollbar).toBeInTheDocument();

    // Note: Horizontal scrollbar may not always be rendered depending on content
  });
});

describe("ScrollBar", () => {
  it("renders vertical scrollbar with default styles", () => {
    const { container } = render(<ScrollBar orientation="vertical" />);

    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(scrollbar).toBeInTheDocument();
    expect(scrollbar).toHaveClass("h-full", "w-2.5");
  });

  it("renders horizontal scrollbar with default styles", () => {
    const { container } = render(<ScrollBar orientation="horizontal" />);

    const scrollbar = container.querySelector(
      '[data-orientation="horizontal"]',
    );
    expect(scrollbar).toBeInTheDocument();
    expect(scrollbar).toHaveClass("h-2.5", "flex-col");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ScrollBar orientation="vertical" className="custom-scrollbar" />,
    );

    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(scrollbar).toHaveClass("custom-scrollbar");
  });

  it("renders with default orientation when not specified", () => {
    const { container } = render(<ScrollBar />);

    // Should default to vertical
    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(scrollbar).toBeInTheDocument();
  });

  it("renders scrollbar thumb", () => {
    const { container } = render(<ScrollBar orientation="vertical" />);

    // The thumb should be rendered inside the scrollbar
    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    const thumb = scrollbar?.querySelector(".bg-border");
    expect(thumb).toBeInTheDocument();
  });
});
