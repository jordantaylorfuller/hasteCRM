import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./select";

// Mock Radix UI select
jest.mock("@radix-ui/react-select", () => ({
  Root: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Value: ({ children, placeholder, ...props }: any) => (
    <span {...props}>{children || placeholder}</span>
  ),
  Trigger: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
    <button ref={ref} className={className} {...props}>
      {children}
    </button>
  )),
  Icon: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>{children}</span>
  ),
  Portal: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Content: React.forwardRef(({ children, className, position = "popper", ...props }: any, ref: any) => (
    <div ref={ref} className={className} data-position={position} {...props}>
      {children}
    </div>
  )),
  Label: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  Item: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )),
  ItemText: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ItemIndicator: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>{children}</span>
  ),
  ScrollUpButton: ({ children, className, ...props }: any) => (
    <button className={className} {...props}>{children}</button>
  ),
  ScrollDownButton: ({ children, className, ...props }: any) => (
    <button className={className} {...props}>{children}</button>
  ),
  Separator: ({ className, ...props }: any) => (
    <div className={className} {...props} />
  ),
  Viewport: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Check: ({ className }: any) => <span className={className}>✓</span>,
  ChevronDown: ({ className }: any) => <span className={className}>▼</span>,
  ChevronUp: ({ className }: any) => <span className={className}>▲</span>,
}));

describe("Select components", () => {
  describe("SelectTrigger", () => {
    it("renders trigger with default styles", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      );
      
      const trigger = screen.getByRole("button");
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveClass("flex", "h-10", "w-full", "items-center");
    });

    it("applies custom className", () => {
      render(
        <Select>
          <SelectTrigger className="custom-trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>
      );
      
      const trigger = screen.getByRole("button");
      expect(trigger).toHaveClass("custom-trigger");
    });

    it("renders chevron icon", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </Select>
      );
      
      expect(screen.getByText("▼")).toBeInTheDocument();
    });
  });

  describe("SelectContent", () => {
    it("renders content with default styles", () => {
      const { container } = render(
        <Select>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );
      
      // The mock returns a div with the combined classes
      const content = container.querySelector('[data-position]');
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass("relative", "z-50", "bg-popover");
    });

    it("renders with popper position", () => {
      const { container } = render(
        <Select>
          <SelectContent position="popper">
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const content = container.querySelector('[data-position]');
      expect(content).toHaveAttribute("data-position", "popper");
      expect(content).toHaveClass("data-[state=open]:animate-in");
    });

    it("renders with item-aligned position", () => {
      const { container } = render(
        <Select>
          <SelectContent position="item-aligned">
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const content = container.querySelector('[data-position]');
      expect(content).toHaveAttribute("data-position", "item-aligned");
    });
  });

  describe("SelectLabel", () => {
    it("renders label with default styles", () => {
      render(
        <SelectGroup>
          <SelectLabel>Group Label</SelectLabel>
        </SelectGroup>
      );
      
      const label = screen.getByText("Group Label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveClass("py-1.5", "pl-8", "text-sm", "font-semibold");
    });

    it("applies custom className", () => {
      render(
        <SelectGroup>
          <SelectLabel className="custom-label">Label</SelectLabel>
        </SelectGroup>
      );
      
      const label = screen.getByText("Label");
      expect(label).toHaveClass("custom-label");
    });
  });

  describe("SelectItem", () => {
    it("renders item with default styles", () => {
      render(
        <Select>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const item = screen.getByText("Option 1").parentElement;
      expect(item).toHaveClass("relative", "flex", "w-full", "cursor-default");
    });

    it("renders check indicator", () => {
      render(
        <Select>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );
      
      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <Select>
          <SelectContent>
            <SelectItem value="1" className="custom-item">
              Option 1
            </SelectItem>
          </SelectContent>
        </Select>
      );
      
      const item = screen.getByText("Option 1").parentElement;
      expect(item).toHaveClass("custom-item");
    });
  });

  describe("SelectSeparator", () => {
    it("renders separator with default styles", () => {
      const { container } = render(
        <Select>
          <SelectContent>
            <SelectSeparator />
          </SelectContent>
        </Select>
      );
      
      const separator = container.querySelector('.-mx-1.my-1.h-px.bg-muted');
      expect(separator).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <Select>
          <SelectContent>
            <SelectSeparator className="custom-separator" />
          </SelectContent>
        </Select>
      );
      
      const separator = container.querySelector('.custom-separator');
      expect(separator).toBeInTheDocument();
    });
  });

  describe("ScrollButtons", () => {
    it("renders scroll up button", () => {
      const { container } = render(
        <SelectScrollUpButton />
      );
      
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("▲");
    });

    it("renders scroll down button", () => {
      const { container } = render(
        <SelectScrollDownButton />
      );
      
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("▼");
    });

    it("applies custom className to scroll buttons", () => {
      const { container: upContainer } = render(
        <SelectScrollUpButton className="custom-up" />
      );
      
      const { container: downContainer } = render(
        <SelectScrollDownButton className="custom-down" />
      );
      
      expect(upContainer.querySelector('button')).toHaveClass("custom-up");
      expect(downContainer.querySelector('button')).toHaveClass("custom-down");
    });
  });

  describe("Complete select composition", () => {
    it("renders a complete select with groups", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Vegetables</SelectLabel>
              <SelectItem value="carrot">Carrot</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );
      
      expect(screen.getByText("Select a fruit")).toBeInTheDocument();
      expect(screen.getByText("Fruits")).toBeInTheDocument();
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Banana")).toBeInTheDocument();
      expect(screen.getByText("Vegetables")).toBeInTheDocument();
      expect(screen.getByText("Carrot")).toBeInTheDocument();
    });
  });
});