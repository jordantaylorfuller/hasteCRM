import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactFilters } from "./ContactFilters";
import {
  ContactFiltersInput,
  ContactStatus,
  ContactSource,
} from "@/types/contact";

const mockOnChange = jest.fn();

const defaultFilters: ContactFiltersInput = {};

describe("ContactFilters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders filters button", () => {
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("shows active filters count when filters are applied", () => {
    const activeFilters: ContactFiltersInput = {
      status: ContactStatus.ACTIVE,
      source: ContactSource.GMAIL,
    };

    render(<ContactFilters filters={activeFilters} onChange={mockOnChange} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show count badge when no filters are active", () => {
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens popover when button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    expect(screen.getByText("Filter contacts by various criteria")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
  });

  it("handles status filter selection", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    // Open popover
    await user.click(screen.getByRole("button", { name: /filters/i }));

    // Click on status select
    const statusSelect = screen.getByLabelText("Status");
    await user.click(statusSelect);

    // Select Active status
    await user.click(screen.getByRole("option", { name: "Active" }));

    // Apply filters
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({
      status: ContactStatus.ACTIVE,
    });
  });

  it("handles source filter selection", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    // Open popover
    await user.click(screen.getByRole("button", { name: /filters/i }));

    // Click on source select
    const sourceSelect = screen.getByLabelText("Source");
    await user.click(sourceSelect);

    // Select Gmail source
    await user.click(screen.getByRole("option", { name: "Gmail" }));

    // Apply filters
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({
      source: ContactSource.GMAIL,
    });
  });

  it("handles multiple filter selections", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    // Open popover
    await user.click(screen.getByRole("button", { name: /filters/i }));

    // Select status
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "Inactive" }));

    // Select source
    await user.click(screen.getByLabelText("Source"));
    await user.click(screen.getByRole("option", { name: "Import" }));

    // Apply filters
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({
      status: ContactStatus.INACTIVE,
      source: ContactSource.IMPORT,
    });
  });

  it("preserves existing filter values when popover is opened", async () => {
    const existingFilters: ContactFiltersInput = {
      status: ContactStatus.ACTIVE,
      source: ContactSource.MANUAL,
    };

    const user = userEvent.setup();
    render(
      <ContactFilters filters={existingFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));

    // Check that the selects show the current values
    expect(screen.getByDisplayValue("Active")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Manual")).toBeInTheDocument();
  });

  it("resets all filters when reset button is clicked", async () => {
    const activeFilters: ContactFiltersInput = {
      status: ContactStatus.ACTIVE,
      source: ContactSource.GMAIL,
    };

    const user = userEvent.setup();
    render(
      <ContactFilters filters={activeFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("closes popover after applying filters", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByText("Filter contacts by various criteria")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply" }));

    // Popover should be closed
    await waitFor(() => {
      expect(
        screen.queryByText("Filter contacts by various criteria"),
      ).not.toBeInTheDocument();
    });
  });

  it("closes popover after reset", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    // Popover should be closed
    await waitFor(() => {
      expect(
        screen.queryByText("Filter contacts by various criteria"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows all status options in dropdown", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByLabelText("Status"));

    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inactive" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Archived" })).toBeInTheDocument();
  });

  it("shows all source options in dropdown", async () => {
    const user = userEvent.setup();
    render(
      <ContactFilters filters={defaultFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByLabelText("Source"));

    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Manual" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "API" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gmail" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Webhook" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Enrichment" })).toBeInTheDocument();
  });

  it("allows clearing individual filter by selecting 'All'", async () => {
    const activeFilters: ContactFiltersInput = {
      status: ContactStatus.ACTIVE,
    };

    const user = userEvent.setup();
    render(
      <ContactFilters filters={activeFilters} onChange={mockOnChange} />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "All" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });
});