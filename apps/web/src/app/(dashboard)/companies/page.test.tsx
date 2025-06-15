import React from "react";
import { render, screen } from "@testing-library/react";
import CompaniesPage from "./page";

describe("Companies Page", () => {
  it("renders page title", () => {
    render(<CompaniesPage />);

    expect(screen.getByText("Companies")).toBeInTheDocument();
  });

  it("renders coming soon message", () => {
    render(<CompaniesPage />);

    expect(
      screen.getByText("Companies feature coming soon..."),
    ).toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    render(<CompaniesPage />);

    const container = screen.getByText("Companies").parentElement;
    expect(container).toHaveClass("p-6");

    const title = screen.getByText("Companies");
    expect(title).toHaveClass("text-2xl", "font-bold", "mb-4");

    const message = screen.getByText("Companies feature coming soon...");
    expect(message).toHaveClass("text-gray-500");
  });

  it("renders within the expected structure", () => {
    const { container } = render(<CompaniesPage />);

    const mainDiv = container.firstChild;
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv?.childNodes).toHaveLength(2); // title and message
  });
});
