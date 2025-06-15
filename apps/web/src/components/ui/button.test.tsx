import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "./button";

// Mock the Slot component from Radix UI
jest.mock("@radix-ui/react-slot", () => ({
  Slot: React.forwardRef<HTMLElement, any>(({ children, ...props }, ref) => {
    // Clone the child element with the props
    if (React.isValidElement(children)) {
      return React.cloneElement(children, { ...props, ref });
    }
    return <div {...props} ref={ref}>{children}</div>;
  }),
}));

describe("Button", () => {
  it("renders button with default variant", () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("renders button with secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    
    const button = screen.getByRole("button", { name: "Secondary" });
    expect(button).toHaveClass("bg-secondary", "text-secondary-foreground");
  });

  it("renders button with destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("bg-destructive", "text-destructive-foreground");
  });

  it("renders button with outline variant", () => {
    render(<Button variant="outline">Outline</Button>);
    
    const button = screen.getByRole("button", { name: "Outline" });
    expect(button).toHaveClass("border", "border-input", "bg-background");
  });

  it("renders button with secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    
    const button = screen.getByRole("button", { name: "Secondary" });
    expect(button).toHaveClass("bg-secondary", "text-secondary-foreground");
  });

  it("renders button with ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button).toHaveClass("hover:bg-accent", "hover:text-accent-foreground");
  });

  it("renders button with link variant", () => {
    render(<Button variant="link">Link</Button>);
    
    const button = screen.getByRole("button", { name: "Link" });
    expect(button).toHaveClass("text-primary", "underline-offset-4");
  });

  it("renders different sizes", () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10", "px-4", "py-2");

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9", "px-3");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-11", "px-8");

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10", "w-10");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button).toHaveClass("custom-class");
  });

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Ref Button");
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole("button", { name: "Click me" });
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
  });

  it("renders as child when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole("link", { name: "Link Button" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
    expect(link).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("passes through additional props", () => {
    render(
      <Button type="submit" form="test-form" data-testid="test-button">
        Submit
      </Button>
    );
    
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("form", "test-form");
    expect(button).toHaveAttribute("data-testid", "test-button");
  });

  it("buttonVariants function returns correct classes", () => {
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "outline" })).toContain("border");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-secondary");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-accent");
    expect(buttonVariants({ variant: "link" })).toContain("text-primary");
    
    expect(buttonVariants({ size: "default" })).toContain("h-10");
    expect(buttonVariants({ size: "sm" })).toContain("h-9");
    expect(buttonVariants({ size: "lg" })).toContain("h-11");
    expect(buttonVariants({ size: "icon" })).toContain("h-10 w-10");
  });

  it("renders with asChild and custom component", () => {
    const CustomLink = React.forwardRef<HTMLAnchorElement, any>((props, ref) => (
      <a ref={ref} {...props} />
    ));
    CustomLink.displayName = "CustomLink";

    render(
      <Button asChild variant="secondary">
        <CustomLink href="/custom">Custom Link</CustomLink>
      </Button>
    );
    
    const link = screen.getByRole("link", { name: "Custom Link" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/custom");
    expect(link).toHaveClass("bg-secondary", "text-secondary-foreground");
  });
});