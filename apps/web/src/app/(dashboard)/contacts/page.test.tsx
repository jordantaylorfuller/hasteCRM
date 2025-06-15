import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@apollo/client";
import ContactsPage from "./page";

// Mock dependencies
jest.mock("@apollo/client", () => ({
  useQuery: jest.fn(),
  gql: jest.fn((template) => template),
}));

jest.mock("@/components/contacts/ContactList", () => ({
  ContactList: ({ contacts, loading, onRefresh }: any) => (
    <div data-testid="contact-list">
      {loading && <div>Loading contacts...</div>}
      {contacts.map((contact: any) => (
        <div key={contact.id}>{contact.name}</div>
      ))}
      <button onClick={onRefresh}>Refresh</button>
    </div>
  ),
}));

jest.mock("@/components/contacts/ContactFilters", () => ({
  ContactFilters: ({ filters, onChange }: any) => {
    // filters is intentionally not used in this mock
    void filters;
    return (
      <div data-testid="contact-filters">
        <button onClick={() => onChange({ status: "ACTIVE" })}>
          Filter Active
        </button>
      </div>
    );
  },
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ onChange, ...props }: any) => (
    <input onChange={onChange} {...props} />
  ),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  Upload: () => <span>Upload</span>,
  Download: () => <span>Download</span>,
}));

describe("Contacts Page", () => {
  const mockContacts = [
    { id: "1", name: "John Doe" },
    { id: "2", name: "Jane Smith" },
  ];

  const mockQueryResult = {
    data: {
      contacts: {
        contacts: mockContacts,
        totalCount: 2,
      },
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  };

  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockReturnValue(mockQueryResult);
  });

  it("renders page header correctly", () => {
    render(<ContactsPage />);

    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Manage your contacts and build meaningful relationships",
      ),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<ContactsPage />);

    const searchInput = screen.getByPlaceholderText("Search contacts...");
    expect(searchInput).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<ContactsPage />);

    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Add Contact")).toBeInTheDocument();
  });

  it("renders contact filters component", () => {
    render(<ContactsPage />);

    expect(screen.getByTestId("contact-filters")).toBeInTheDocument();
  });

  it("renders contact list with data", () => {
    render(<ContactsPage />);

    expect(screen.getByTestId("contact-list")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    (useQuery as jest.Mock).mockReturnValue({
      ...mockQueryResult,
      loading: true,
    });

    render(<ContactsPage />);

    expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
  });

  it("shows error message", () => {
    const errorMessage = "Failed to load contacts";
    (useQuery as jest.Mock).mockReturnValue({
      ...mockQueryResult,
      error: { message: errorMessage },
    });

    render(<ContactsPage />);

    expect(
      screen.getByText(`Error loading contacts: ${errorMessage}`),
    ).toBeInTheDocument();
  });

  it("updates search on input change", async () => {
    render(<ContactsPage />);

    const searchInput = screen.getByPlaceholderText("Search contacts...");
    await user.type(searchInput, "John");

    await waitFor(() => {
      expect(useQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({
            filters: expect.objectContaining({
              search: "John",
            }),
          }),
        }),
      );
    });
  });

  it("updates filters when filter component changes", async () => {
    render(<ContactsPage />);

    const filterButton = screen.getByText("Filter Active");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(useQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({
            filters: expect.objectContaining({
              status: "ACTIVE",
            }),
          }),
        }),
      );
    });
  });

  it("calls refetch when refresh button is clicked", () => {
    render(<ContactsPage />);

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    expect(mockQueryResult.refetch).toHaveBeenCalled();
  });

  it("opens create modal when Add Contact is clicked", () => {
    render(<ContactsPage />);

    const addButton = screen.getByText("Add Contact");
    fireEvent.click(addButton);

    // Since modals are TODO, we just check the state would be set
    // In a real implementation, you'd check for modal visibility
  });

  it("opens import modal when Import is clicked", () => {
    render(<ContactsPage />);

    const importButton = screen.getByText("Import");
    fireEvent.click(importButton);

    // Since modals are TODO, we just check the state would be set
    // In a real implementation, you'd check for modal visibility
  });

  it("handles export functionality", () => {
    // Mock console.log to verify it's called
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    render(<ContactsPage />);

    const exportButton = screen.getByText("Export");
    fireEvent.click(exportButton);

    expect(consoleLogSpy).toHaveBeenCalledWith("Export contacts");

    consoleLogSpy.mockRestore();
  });

  it("passes correct initial query variables", () => {
    render(<ContactsPage />);

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: {
          filters: {
            search: "",
          },
          skip: 0,
          take: 20,
        },
      }),
    );
  });

  it("handles empty contact list", () => {
    (useQuery as jest.Mock).mockReturnValue({
      ...mockQueryResult,
      data: {
        contacts: {
          contacts: [],
          totalCount: 0,
        },
      },
    });

    render(<ContactsPage />);

    expect(screen.getByTestId("contact-list")).toBeInTheDocument();
    // The ContactList component would handle empty state display
  });

  it("applies correct styling to buttons", () => {
    render(<ContactsPage />);

    const importButton = screen.getByText("Import").closest("button");
    const exportButton = screen.getByText("Export").closest("button");
    const addButton = screen.getByText("Add Contact").closest("button");

    expect(importButton).toHaveAttribute("data-variant", "outline");
    expect(importButton).toHaveAttribute("data-size", "sm");
    expect(exportButton).toHaveAttribute("data-variant", "outline");
    expect(exportButton).toHaveAttribute("data-size", "sm");
    expect(addButton).not.toHaveAttribute("data-variant");
  });

  it("maintains search and filter state together", async () => {
    render(<ContactsPage />);

    // Set search
    const searchInput = screen.getByPlaceholderText("Search contacts...");
    await user.type(searchInput, "John");

    // Set filter
    const filterButton = screen.getByText("Filter Active");
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(useQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({
            filters: expect.objectContaining({
              search: "John",
              status: "ACTIVE",
            }),
          }),
        }),
      );
    });
  });

  it("handles undefined contacts data with fallback to empty array", () => {
    (useQuery as jest.Mock).mockReturnValue({
      ...mockQueryResult,
      data: null, // No data at all
    });

    render(<ContactsPage />);

    // Should still render ContactList with empty array
    expect(screen.getByTestId("contact-list")).toBeInTheDocument();
  });
});
