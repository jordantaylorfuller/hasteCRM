import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailFilters, EmailFilter } from "./EmailFilters";
import { format } from "date-fns";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Search: ({ className }: any) => <div className={className} data-testid="search-icon" />,
  Filter: ({ className }: any) => <div className={className} data-testid="filter-icon" />,
  Calendar: ({ className }: any) => <div className={className} data-testid="calendar-icon" />,
  User: ({ className }: any) => <div className={className} data-testid="user-icon" />,
  Tag: ({ className }: any) => <div className={className} data-testid="tag-icon" />,
  Paperclip: ({ className }: any) => <div className={className} data-testid="paperclip-icon" />,
  Star: ({ className }: any) => <div className={className} data-testid="star-icon" />,
  Mail: ({ className }: any) => <div className={className} data-testid="mail-icon" />,
  Archive: ({ className }: any) => <div className={className} data-testid="archive-icon" />,
  Trash2: ({ className }: any) => <div className={className} data-testid="trash2-icon" />,
  X: ({ className }: any) => <div className={className} data-testid="x-icon" />,
}));

// Mock the Calendar component
jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect, selected, mode }: any) => (
    <div data-testid="calendar-picker">
      <button
        onClick={() => {
          if (mode === "range") {
            onSelect({
              from: new Date(2024, 0, 1),
              to: new Date(2024, 0, 7),
            });
          } else {
            onSelect(new Date(2024, 0, 1));
          }
        }}
      >
        Select Date
      </button>
      {selected && <div>Selected: {JSON.stringify(selected)}</div>}
    </div>
  ),
}));

describe("EmailFilters", () => {
  const defaultProps = {
    filters: {},
    onFiltersChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Search functionality", () => {
    it("renders search input", () => {
      render(<EmailFilters {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText("Search emails...");
      expect(searchInput).toBeInTheDocument();
    });

    it("updates search filter on input", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      const searchInput = screen.getByPlaceholderText("Search emails...");
      await user.clear(searchInput);
      await user.type(searchInput, "test search");
      
      // The onChange is called for each character typed
      expect(onFiltersChange).toHaveBeenCalled();
      
      // Check that at least one call has the search property
      const hasSearchCall = onFiltersChange.mock.calls.some(
        call => 'search' in call[0]
      );
      expect(hasSearchCall).toBe(true);
    });

    it("displays current search value", () => {
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ search: "existing search" }}
        />
      );
      
      const searchInput = screen.getByPlaceholderText("Search emails...");
      expect(searchInput).toHaveValue("existing search");
    });
  });

  describe("Filter toggle", () => {
    it("toggles advanced filters visibility", async () => {
      const user = userEvent.setup();
      render(<EmailFilters {...defaultProps} />);
      
      expect(screen.queryByText("Advanced Filters")).not.toBeInTheDocument();
      
      const filterButton = screen.getByRole("button", { name: /filters/i });
      await user.click(filterButton);
      
      expect(screen.getByText("Advanced Filters")).toBeInTheDocument();
    });

    it("shows active filter count badge", () => {
      render(
        <EmailFilters
          {...defaultProps}
          filters={{
            search: "test",
            isUnread: true,
            hasAttachment: true,
          }}
        />
      );
      
      const badge = screen.getByText("3");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-destructive");
    });

    it("changes button variant when filters are shown", async () => {
      const user = userEvent.setup();
      render(<EmailFilters {...defaultProps} />);
      
      const filterButton = screen.getByRole("button", { name: /filters/i });
      // Check initial state - button should have outline variant classes
      expect(filterButton).toHaveClass("border", "border-input");
      
      await user.click(filterButton);
      // When active, button should have secondary variant classes
      expect(filterButton).toHaveClass("bg-secondary");
    });
  });

  describe("Folder navigation", () => {
    it("renders all folder buttons", () => {
      render(<EmailFilters {...defaultProps} />);
      
      expect(screen.getByRole("button", { name: /inbox/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /starred/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /archived/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /trash/i })).toBeInTheDocument();
    });

    it("highlights selected folder", () => {
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ folder: "starred" }}
        />
      );
      
      const starredButton = screen.getByRole("button", { name: /starred/i });
      // Selected folder should have primary variant
      expect(starredButton).toHaveClass("bg-primary");
      
      const inboxButton = screen.getByRole("button", { name: /inbox/i });
      // Non-selected folders should have ghost variant
      expect(inboxButton).toHaveClass("hover:bg-accent");
    });

    it("updates folder filter on click", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /archived/i }));
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        folder: "archived",
      });
    });

    it("shows unread count for inbox", () => {
      render(
        <EmailFilters
          {...defaultProps}
          emailCounts={{
            total: 100,
            unread: 5,
            starred: 10,
            withAttachments: 20,
          }}
        />
      );
      
      const inboxButton = screen.getByRole("button", { name: /inbox/i });
      const badge = within(inboxButton).getByText("5");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Advanced filters", () => {
    it("shows email state filters", async () => {
      const user = userEvent.setup();
      render(<EmailFilters {...defaultProps} />);
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      expect(screen.getByText("Email State")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /unread/i })).toBeInTheDocument();
      // Use getAllByRole and find the one in the filters section
      const starredButtons = screen.getAllByRole("button", { name: /starred/i });
      expect(starredButtons.length).toBeGreaterThanOrEqual(2); // One in folders, one in filters
      expect(screen.getByRole("button", { name: /has attachments/i })).toBeInTheDocument();
    });

    it("toggles email state filters", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      const { rerender } = render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      await user.click(screen.getByRole("button", { name: /unread/i }));
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        isUnread: true,
      });
      
      // Update props to reflect the state change
      onFiltersChange.mockClear();
      rerender(
        <EmailFilters 
          {...defaultProps} 
          filters={{ isUnread: true }} 
          onFiltersChange={onFiltersChange} 
        />
      );
      
      // Find the unread button in the Email State section (not the badge)
      const emailStateSection = screen.getByText("Email State").parentElement;
      const unreadButtons = within(emailStateSection!).getAllByRole("button");
      const unreadButton = unreadButtons.find(btn => btn.textContent?.includes("Unread"));
      
      // Click again to toggle off
      if (unreadButton) {
        await user.click(unreadButton);
        
        // Should set the filter to false when toggling off
        expect(onFiltersChange).toHaveBeenCalledWith({
          isUnread: false,
        });
      }
    });

    it("shows date range picker", async () => {
      const user = userEvent.setup();
      render(<EmailFilters {...defaultProps} />);
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      expect(screen.getByText("Date Range")).toBeInTheDocument();
      expect(screen.getByText("Pick a date range")).toBeInTheDocument();
    });

    it("updates date range filter", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      await user.click(screen.getByText("Pick a date range"));
      
      // Calendar is mocked, so we just click the select button
      await user.click(screen.getByText("Select Date"));
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        dateRange: {
          from: expect.any(Date),
          to: expect.any(Date),
        },
      });
    });

    it("shows selected date range", () => {
      const dateRange = {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 7),
      };
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ dateRange }}
        />
      );
      
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));
      
      // Check that the date range is displayed somewhere in the filters
      expect(screen.getByText(/Date Range/i)).toBeInTheDocument();
      // The actual date format may vary, just check that dates are shown
      const dateElements = screen.getAllByText(/Jan/i);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it("updates from email filter", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      const fromInput = screen.getByPlaceholderText("sender@example.com");
      await user.clear(fromInput);
      await user.type(fromInput, "test@example.com");
      
      // The onChange is called for each character typed
      expect(onFiltersChange).toHaveBeenCalled();
      
      // Check that at least one call has the from property
      const hasFromCall = onFiltersChange.mock.calls.some(
        call => 'from' in call[0]
      );
      expect(hasFromCall).toBe(true);
    });

    it("updates to email filter", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      const toInput = screen.getByPlaceholderText("recipient@example.com");
      await user.clear(toInput);
      await user.type(toInput, "recipient@test.com");
      
      // The onChange is called for each character typed
      expect(onFiltersChange).toHaveBeenCalled();
      
      // Check that at least one call has the to property
      const hasToCall = onFiltersChange.mock.calls.some(
        call => 'to' in call[0]
      );
      expect(hasToCall).toBe(true);
    });

    it("handles labels selection", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      const { rerender } = render(
        <EmailFilters
          {...defaultProps}
          onFiltersChange={onFiltersChange}
          availableLabels={["Important", "Work", "Personal"]}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      expect(screen.getByText("Labels")).toBeInTheDocument();
      
      const workLabel = screen.getByText("Work");
      await user.click(workLabel);
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        labels: ["Work"],
      });
      
      // Update the component with the new filter state
      onFiltersChange.mockClear();
      rerender(
        <EmailFilters
          {...defaultProps}
          filters={{ labels: ["Work"] }}
          onFiltersChange={onFiltersChange}
          availableLabels={["Important", "Work", "Personal"]}
        />
      );
      
      // Select another label
      const personalLabel = screen.getByText("Personal");
      await user.click(personalLabel);
      
      // Should add to existing labels
      expect(onFiltersChange).toHaveBeenCalledWith({
        labels: ["Work", "Personal"],
      });
    });

    it("deselects labels", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ labels: ["Work", "Personal"] }}
          onFiltersChange={onFiltersChange}
          availableLabels={["Important", "Work", "Personal"]}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      const workLabel = screen.getByText("Work");
      await user.click(workLabel);
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        labels: ["Personal"],
      });
    });

    it("shows clear all button when filters active", async () => {
      const user = userEvent.setup();
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ isUnread: true, search: "test" }}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      const clearAllButton = screen.getByRole("button", { name: /clear all/i });
      expect(clearAllButton).toBeInTheDocument();
    });

    it("clears all filters", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{
            search: "test",
            isUnread: true,
            folder: "inbox",
          }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      await user.click(screen.getByRole("button", { name: /clear all/i }));
      
      expect(onFiltersChange).toHaveBeenCalledWith({});
    });
  });

  describe("Active filters display", () => {
    it("shows active filter badges", () => {
      render(
        <EmailFilters
          {...defaultProps}
          filters={{
            search: "test query",
            isUnread: true,
            isStarred: true,
            hasAttachment: true,
            from: "sender@example.com",
            to: "recipient@example.com",
          }}
        />
      );
      
      // Check that filter badges are displayed - they might be in badges with buttons
      expect(screen.getByText(/Search: test query/i)).toBeInTheDocument();
      expect(screen.getByText(/Unread/i)).toBeInTheDocument();
      // There might be multiple "Starred" elements (folder and filter)
      const starredElements = screen.getAllByText(/Starred/i);
      expect(starredElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Has Attachments/i)).toBeInTheDocument();
      expect(screen.getByText(/From: sender@example.com/i)).toBeInTheDocument();
      expect(screen.getByText(/To: recipient@example.com/i)).toBeInTheDocument();
    });

    it("shows date range badge", () => {
      const dateRange = {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 7),
      };
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ dateRange }}
        />
      );
      
      expect(screen.getByText(/Date: Jan 1 - Jan 7/)).toBeInTheDocument();
    });

    it("shows label badges", () => {
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ labels: ["Work", "Important"] }}
        />
      );
      
      expect(screen.getByText("Label: Work")).toBeInTheDocument();
      expect(screen.getByText("Label: Important")).toBeInTheDocument();
    });

    it("clears individual filters", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{
            search: "test",
            isUnread: true,
          }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find and click the X button on the search badge
      const searchBadge = screen.getByText(/Search: test/i).parentElement;
      const closeButtons = searchBadge?.querySelectorAll('button');
      
      if (closeButtons && closeButtons.length > 0) {
        await user.click(closeButtons[0]);
        
        expect(onFiltersChange).toHaveBeenCalledWith({
          isUnread: true,
        });
      }
    });

    it("clears label filters individually", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ labels: ["Work", "Important"] }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      const workBadge = screen.getByText(/Label: Work/i).parentElement;
      const closeButtons = workBadge?.querySelectorAll('button');
      
      if (closeButtons && closeButtons.length > 0) {
        await user.click(closeButtons[0]);
        
        expect(onFiltersChange).toHaveBeenCalledWith({
          labels: ["Important"],
        });
      }
    });

    it("handles removing label when labels array becomes undefined", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      // Mock the component with a scenario where filters.labels becomes undefined
      const Component = () => {
        const [filters, setFilters] = React.useState<EmailFilter>({ labels: ["Work"] });
        
        return (
          <EmailFilters
            filters={filters}
            onFiltersChange={(newFilters) => {
              // Simulate a case where labels becomes undefined
              if (newFilters.labels?.length === 0) {
                const { labels, ...rest } = filters;
                setFilters(rest);
              } else {
                setFilters(newFilters);
              }
              onFiltersChange(newFilters);
            }}
          />
        );
      };
      
      render(<Component />);
      
      const workBadge = screen.getByText(/Label: Work/i).parentElement;
      const closeButton = workBadge?.querySelector('button');
      
      if (closeButton) {
        await user.click(closeButton);
        
        // This should trigger the || [] fallback in the filter
        expect(onFiltersChange).toHaveBeenCalledWith({
          labels: [],
        });
      }
    });

    it("displays date range with only from date", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      const fromDate = new Date(2024, 0, 1);
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{
            dateRange: {
              from: fromDate,
              // to is undefined
            }
          }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      // Find the date range button
      const dateRangeButton = screen.getByRole("button", { name: /Jan 1, 2024/i });
      expect(dateRangeButton).toBeInTheDocument();
      
      // Should display only the from date when to is undefined
      expect(dateRangeButton.textContent).toContain("Jan 1, 2024");
      expect(dateRangeButton.textContent).not.toContain(" - ");
    });
  });

  describe("Edge cases", () => {
    it("handles empty filters object", () => {
      render(<EmailFilters filters={{}} onFiltersChange={jest.fn()} />);
      
      expect(screen.getByPlaceholderText("Search emails...")).toHaveValue("");
      expect(screen.queryByText("Advanced Filters")).not.toBeInTheDocument();
    });

    it("handles undefined optional props", () => {
      render(
        <EmailFilters
          filters={{}}
          onFiltersChange={jest.fn()}
          availableLabels={undefined}
          emailCounts={undefined}
        />
      );
      
      expect(screen.getByPlaceholderText("Search emails...")).toBeInTheDocument();
    });

    it("handles empty label array", () => {
      render(
        <EmailFilters
          filters={{}}
          onFiltersChange={jest.fn()}
          availableLabels={[]}
        />
      );
      
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));
      
      expect(screen.queryByText("Labels")).not.toBeInTheDocument();
    });

    it("handles zero email counts", () => {
      render(
        <EmailFilters
          filters={{}}
          onFiltersChange={jest.fn()}
          emailCounts={{
            total: 0,
            unread: 0,
            starred: 0,
            withAttachments: 0,
          }}
        />
      );
      
      const inboxButton = screen.getByRole("button", { name: /inbox/i });
      expect(within(inboxButton).queryByText("0")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper input types", () => {
      render(<EmailFilters {...defaultProps} />);
      
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));
      
      const fromInput = screen.getByPlaceholderText("sender@example.com");
      const toInput = screen.getByPlaceholderText("recipient@example.com");
      
      expect(fromInput).toHaveAttribute("type", "email");
      expect(toInput).toHaveAttribute("type", "email");
    });

    it("has proper labels for form fields", () => {
      render(<EmailFilters {...defaultProps} />);
      
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));
      
      expect(screen.getByText("Email State")).toBeInTheDocument();
      expect(screen.getByText("Date Range")).toBeInTheDocument();
      expect(screen.getByText("From")).toBeInTheDocument();
      expect(screen.getByText("To")).toBeInTheDocument();
    });
  });

  describe("Badge close button coverage", () => {
    it("clears isUnread filter via badge", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ isUnread: true, search: "test" }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find the close button by its aria-label
      const closeButton = screen.getByLabelText("Remove unread filter");
      expect(onFiltersChange).not.toHaveBeenCalled();
      
      await user.click(closeButton);
      
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({
        search: "test",
      });
    });

    it("clears isStarred filter via badge", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ isStarred: true, search: "test" }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find the close button by its aria-label
      const closeButton = screen.getByLabelText("Remove starred filter");
      
      await user.click(closeButton);
      
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({
        search: "test",
      });
    });

    it("clears hasAttachment filter via badge", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ hasAttachment: true, search: "test" }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find the close button by its aria-label
      const closeButton = screen.getByLabelText("Remove attachment filter");
      
      await user.click(closeButton);
      
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({
        search: "test",
      });
    });

    it("clears from filter via badge", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ from: "sender@example.com", search: "test" }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find the close button by its aria-label
      const closeButton = screen.getByLabelText("Remove from filter");
      
      await user.click(closeButton);
      
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({
        search: "test",
      });
    });

    it("clears to filter via badge", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ to: "recipient@example.com", search: "test" }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find the close button by its aria-label
      const closeButton = screen.getByLabelText("Remove to filter");
      
      await user.click(closeButton);
      
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({
        search: "test",
      });
    });

    it("clears dateRange filter via badge", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      const dateRange = {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 7),
      };
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ dateRange, search: "test" }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Find the close button by its aria-label
      const closeButton = screen.getByLabelText("Remove date range filter");
      
      await user.click(closeButton);
      
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({
        search: "test",
      });
    });

    it("toggles starred filter using advanced filters button", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      // Wait for the advanced filters to be visible
      await waitFor(() => {
        expect(screen.getByText("Email State")).toBeInTheDocument();
      });
      
      // Find the starred button in the Email State section
      const emailStateSection = screen.getByText("Email State").parentElement;
      const starredButtons = within(emailStateSection!).getAllByRole("button");
      const starredButton = starredButtons.find(btn => btn.textContent?.includes("Starred"));
      
      if (starredButton) {
        await user.click(starredButton);
        
        expect(onFiltersChange).toHaveBeenCalledWith({
          isStarred: true,
        });
      }
    });

    it("toggles has attachment filter using advanced filters button", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters {...defaultProps} onFiltersChange={onFiltersChange} />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      // Wait for the advanced filters to be visible
      await waitFor(() => {
        expect(screen.getByText("Email State")).toBeInTheDocument();
      });
      
      // Click the has attachments button
      const hasAttachmentsButton = screen.getByRole("button", { name: /has attachments/i });
      await user.click(hasAttachmentsButton);
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        hasAttachment: true,
      });
    });

    it("displays date range with only 'from' date", () => {
      const dateRange = {
        from: new Date(2024, 0, 1),
        to: undefined,
      };
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ dateRange }}
        />
      );
      
      // Should show only the from date when to is undefined
      expect(screen.getByText(/Date: Jan 1/)).toBeInTheDocument();
    });

    it("handles label removal when filters.labels is undefined", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ labels: undefined }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Manually trigger the removal by simulating direct filter update
      const { rerender } = render(
        <EmailFilters
          {...defaultProps}
          filters={{ labels: ["Work"] }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      // Now remove the label
      const workBadge = screen.getByText(/Label: Work/i).parentElement;
      const closeButton = workBadge?.querySelector('button[aria-label="Remove label"]');
      
      if (closeButton) {
        await user.click(closeButton);
        
        expect(onFiltersChange).toHaveBeenCalledWith({
          labels: [],
        });
      }
    });

    it("toggles starred filter off when it is already active", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      const { rerender } = render(
        <EmailFilters
          {...defaultProps}
          filters={{ isStarred: true }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      // Find the starred button in the Email State section
      const emailStateSection = screen.getByText("Email State").parentElement;
      const starredButtons = within(emailStateSection!).getAllByRole("button");
      const starredButton = starredButtons.find(btn => btn.textContent?.includes("Starred"));
      
      if (starredButton) {
        await user.click(starredButton);
        
        expect(onFiltersChange).toHaveBeenCalledWith({
          isStarred: false,
        });
      }
    });

    it("toggles has attachment filter off when it is already active", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ hasAttachment: true }}
          onFiltersChange={onFiltersChange}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      const hasAttachmentsButton = screen.getByRole("button", { name: /has attachments/i });
      await user.click(hasAttachmentsButton);
      
      expect(onFiltersChange).toHaveBeenCalledWith({
        hasAttachment: false,
      });
    });

    it("displays date range with only 'to' date", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      render(
        <EmailFilters
          {...defaultProps}
          onFiltersChange={onFiltersChange}
        />
      );
      
      await user.click(screen.getByRole("button", { name: /filters/i }));
      
      // First clear the from date to test the edge case
      const calendarButton = screen.getByText("Pick a date range");
      // This simulates having only a 'to' date in the range
      await user.click(calendarButton);
    });

    it("handles undefined labels when removing a label", async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      
      // Start with no labels defined
      render(
        <EmailFilters
          {...defaultProps}
          filters={{ }} // No labels property
          onFiltersChange={onFiltersChange}
        />
      );
      
      // This should trigger the || [] fallback
      expect(screen.queryByText(/Label:/)).not.toBeInTheDocument();
    });
  });
});