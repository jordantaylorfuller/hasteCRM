import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge, badgeVariants } from "./badge";

describe("Badge", () => {
  it("renders badge with default variant", () => {
    render(<Badge>Default Badge</Badge>);
    
    const badge = screen.getByText("Default Badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-primary");
  });

  it("renders badge with secondary variant", () => {
    render(<Badge variant="secondary">Secondary Badge</Badge>);
    
    const badge = screen.getByText("Secondary Badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-secondary");
  });

  it("renders badge with destructive variant", () => {
    render(<Badge variant="destructive">Destructive Badge</Badge>);
    
    const badge = screen.getByText("Destructive Badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-destructive");
  });

  it("renders badge with outline variant", () => {
    render(<Badge variant="outline">Outline Badge</Badge>);
    
    const badge = screen.getByText("Outline Badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("border");
  });

  it("applies custom className", () => {
    render(<Badge className="custom-class">Custom Badge</Badge>);
    
    const badge = screen.getByText("Custom Badge");
    expect(badge).toHaveClass("custom-class");
  });

  it("passes through additional props", () => {
    render(<Badge data-testid="test-badge">Test Badge</Badge>);
    
    const badge = screen.getByTestId("test-badge");
    expect(badge).toBeInTheDocument();
  });

  it("renders with complex children", () => {
    render(
      <Badge>
        <span>Count: </span>
        <strong>5</strong>
      </Badge>
    );
    
    expect(screen.getByText("Count:")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("badge variants function returns correct classes", () => {
    const defaultClasses = badgeVariants({ variant: "default" });
    expect(defaultClasses).toContain("bg-primary");

    const secondaryClasses = badgeVariants({ variant: "secondary" });
    expect(secondaryClasses).toContain("bg-secondary");

    const destructiveClasses = badgeVariants({ variant: "destructive" });
    expect(destructiveClasses).toContain("bg-destructive");

    const outlineClasses = badgeVariants({ variant: "outline" });
    expect(outlineClasses).toContain("border");
  });
});