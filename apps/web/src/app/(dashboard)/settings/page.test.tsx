import React from "react";
import { render, screen } from "@testing-library/react";
import SettingsPage from "./page";

describe("Settings Page", () => {
  it("renders page title", () => {
    render(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders coming soon message", () => {
    render(<SettingsPage />);

    expect(
      screen.getByText("Settings feature coming soon..."),
    ).toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    render(<SettingsPage />);

    const container = screen.getByText("Settings").parentElement;
    expect(container).toHaveClass("p-6");

    const title = screen.getByText("Settings");
    expect(title).toHaveClass("text-2xl", "font-bold", "mb-4");

    const message = screen.getByText("Settings feature coming soon...");
    expect(message).toHaveClass("text-gray-500");
  });

  it("renders within the expected structure", () => {
    const { container } = render(<SettingsPage />);

    const mainDiv = container.firstChild;
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv?.childNodes).toHaveLength(2); // title and message
  });
});
