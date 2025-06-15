import React from "react";
import { render, screen } from "@testing-library/react";
import { ContactList } from "./ContactList";
import { Contact } from "@/types/contact";

// Mock the ContactCard component
jest.mock("./ContactCard", () => ({
  ContactCard: ({
    contact,
    onUpdate,
  }: {
    contact: Contact;
    onUpdate: () => void;
  }) => (
    <div data-testid={`contact-${contact.id}`}>
      <div>
        {contact.firstName} {contact.lastName}
      </div>
      <div>{contact.email}</div>
      {contact.company && <div>{contact.company.name}</div>}
      <button onClick={onUpdate}>Update</button>
    </div>
  ),
}));

// Mock the Skeleton component
jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe("ContactList", () => {
  const mockContacts: Contact[] = [
    {
      id: "1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
      company: {
        id: "1",
        name: "Acme Corp",
        industry: null,
        website: null,
        size: null,
      },
      title: "CEO",
      tags: [{ id: "tag1", name: "VIP", color: "#000" }],
      notes: [],
      customFields: {},
      lastContactDate: null,
      source: null,
      workspaceId: "workspace1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "+0987654321",
      company: {
        id: "2",
        name: "Tech Inc",
        industry: null,
        website: null,
        size: null,
      },
      title: "CTO",
      tags: [],
      notes: [],
      customFields: {},
      lastContactDate: null,
      source: null,
      workspaceId: "workspace1",
      createdAt: "2024-01-02T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    },
  ];

  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state", () => {
    render(
      <ContactList contacts={[]} loading={true} onRefresh={mockOnRefresh} />,
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(6);
  });

  it("renders empty state when no contacts", () => {
    render(
      <ContactList contacts={[]} loading={false} onRefresh={mockOnRefresh} />,
    );

    expect(screen.getByText("No contacts")).toBeInTheDocument();
    expect(
      screen.getByText("Get started by creating a new contact."),
    ).toBeInTheDocument();
  });

  it("renders contact list", () => {
    render(
      <ContactList
        contacts={mockContacts}
        loading={false}
        onRefresh={mockOnRefresh}
      />,
    );

    expect(screen.getByTestId("contact-1")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();

    expect(screen.getByTestId("contact-2")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Tech Inc")).toBeInTheDocument();
  });

  it("passes onRefresh callback to ContactCard", () => {
    render(
      <ContactList
        contacts={mockContacts}
        loading={false}
        onRefresh={mockOnRefresh}
      />,
    );

    const updateButtons = screen.getAllByText("Update");
    expect(updateButtons).toHaveLength(2);

    // Click update button on first contact
    updateButtons[0].click();
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders correct grid layout", () => {
    const { container } = render(
      <ContactList
        contacts={mockContacts}
        loading={false}
        onRefresh={mockOnRefresh}
      />,
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("gap-4", "md:grid-cols-2", "lg:grid-cols-3");
  });
});
