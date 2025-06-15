import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactFilters } from "./ContactFilters";
import {
  ContactFiltersInput,
  ContactStatus,
  ContactSource,
} from "@/types/contact";

// Create a custom mock context for testing
// let _mockSelectState: Record<string, any> = {};

// Mock the Select components to work with the test expectations
jest.mock("@/components/ui/select", () => {
  const React = require("react");

  // Create a stateful select component that properly manages open/close state
  const Select = ({ children, value, onValueChange }: any) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // Pass down all props to children
    return (
      <div data-testid="select-wrapper">
        {React.Children.map(children, (child: any) => {
          if (React.isValidElement(child)) {
            // Pass the onValueChange to SelectContent/SelectItem through context
            if (
              child.type &&
              (child.type as any).displayName === "SelectTrigger"
            ) {
              return React.cloneElement(child, {
                value,
                isOpen,
                setIsOpen,
              } as any);
            } else if (
              child.type &&
              (child.type as any).displayName === "SelectContent"
            ) {
              return React.cloneElement(child, {
                isOpen,
                onValueChange,
                setIsOpen,
              } as any);
            }
          }
          return child;
        })}
      </div>
    );
  };

  Select.displayName = "Select";

  return {
    Select,
    SelectTrigger: Object.assign(
      ({ _children, id, value, isOpen, setIsOpen }: any) => {
        // Map values to display text
        const displayMap: Record<string, string> = {
          ACTIVE: "Active",
          INACTIVE: "Inactive",
          ARCHIVED: "Archived",
          MANUAL: "Manual",
          IMPORT: "Import",
          API: "API",
          GMAIL: "Gmail",
          WEBHOOK: "Webhook",
          ENRICHMENT: "Enrichment",
          all: "All",
        };

        return (
          <button
            id={id}
            aria-label={id === "status" ? "Status" : "Source"}
            onClick={() => setIsOpen && setIsOpen(!isOpen)}
            data-value={value}
          >
            {displayMap[value] || value || "All"}
          </button>
        );
      },
      { displayName: "SelectTrigger" },
    ),

    SelectContent: Object.assign(
      ({ children, isOpen, onValueChange, setIsOpen }: any) => {
        if (!isOpen) return null;

        return (
          <div role="listbox">
            {React.Children.map(children, (child: any) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  onValueChange,
                  setIsOpen,
                } as any);
              }
              return child;
            })}
          </div>
        );
      },
      { displayName: "SelectContent" },
    ),

    SelectItem: ({ value, children, onValueChange, setIsOpen }: any) => (
      <div
        role="option"
        aria-selected="false"
        onClick={() => {
          if (onValueChange) {
            onValueChange(value);
            // Close the select after selection
            if (setIsOpen) setIsOpen(false);
          }
        }}
        data-value={value}
      >
        {children}
      </div>
    ),

    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  };
});

const mockOnChange = jest.fn();

const defaultFilters: ContactFiltersInput = {};

describe("ContactFilters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders filters button", () => {
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    expect(
      screen.getByRole("button", { name: /filters/i }),
    ).toBeInTheDocument();
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
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens popover when button is clicked", async () => {
    const user = userEvent.setup();
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    expect(
      screen.getByText("Filter contacts by various criteria"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
  });

  it("handles status filter selection", async () => {
    const user = userEvent.setup();
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    // Open popover
    await user.click(screen.getByRole("button", { name: /filters/i }));

    // Click on status select trigger to open options
    const statusSelect = screen.getByLabelText("Status");
    await user.click(statusSelect);

    // Select Active status
    const activeOption = screen.getByRole("option", { name: "Active" });
    await user.click(activeOption);

    // Apply filters
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({
      status: ContactStatus.ACTIVE,
    });
  });

  it("handles source filter selection", async () => {
    const user = userEvent.setup();
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    // Open popover
    await user.click(screen.getByRole("button", { name: /filters/i }));

    // Click on source select trigger to open options
    const sourceSelect = screen.getByLabelText("Source");
    await user.click(sourceSelect);

    // Select Gmail source
    const gmailOption = screen.getByRole("option", { name: "Gmail" });
    await user.click(gmailOption);

    // Apply filters
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({
      source: ContactSource.GMAIL,
    });
  });

  it("handles multiple filter selections", async () => {
    const user = userEvent.setup();
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

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
    // Select components show the selected value as text
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("resets all filters when reset button is clicked", async () => {
    const activeFilters: ContactFiltersInput = {
      status: ContactStatus.ACTIVE,
      source: ContactSource.GMAIL,
    };

    const user = userEvent.setup();
    render(<ContactFilters filters={activeFilters} onChange={mockOnChange} />);

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("closes popover after applying filters", async () => {
    const user = userEvent.setup();
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    await user.click(screen.getByRole("button", { name: /filters/i }));
    expect(
      screen.getByText("Filter contacts by various criteria"),
    ).toBeInTheDocument();

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
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

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
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByLabelText("Status"));

    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Inactive" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Archived" }),
    ).toBeInTheDocument();
  });

  it("shows all source options in dropdown", async () => {
    const user = userEvent.setup();
    render(<ContactFilters filters={defaultFilters} onChange={mockOnChange} />);

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByLabelText("Source"));

    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Manual" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "API" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gmail" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Webhook" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Enrichment" }),
    ).toBeInTheDocument();
  });

  it("allows clearing individual filter by selecting 'All'", async () => {
    const activeFilters: ContactFiltersInput = {
      status: ContactStatus.ACTIVE,
    };

    const user = userEvent.setup();
    render(<ContactFilters filters={activeFilters} onChange={mockOnChange} />);

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "All" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });
});
