import { render, screen } from "@testing-library/react";
import { DealCard } from "./DealCard";
import { DndContext } from "@dnd-kit/core";

// Mock @dnd-kit/sortable
jest.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
  }),
}));

const mockDeal = {
  id: "deal-1",
  title: "Enterprise Software Deal",
  value: 50000,
  currency: "USD",
  probability: 75,
  closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  stageEnteredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  daysInStage: 5,
  owner: {
    id: "owner-1",
    firstName: "Sarah",
    lastName: "Johnson",
    avatarUrl: "https://example.com/avatar.jpg",
  },
  company: {
    id: "company-1",
    name: "Tech Corp International",
    logoUrl: "https://example.com/logo.jpg",
  },
  contacts: [
    {
      id: "contact-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@techcorp.com",
    },
    {
      id: "contact-2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@techcorp.com",
    },
  ],
  _count: {
    activities: 12,
    tasks: 3,
    notes: 5,
    emails: 8,
  },
};

const renderDealCard = (deal = mockDeal, isDragging = false) => {
  return render(
    <DndContext>
      <DealCard deal={deal} isDragging={isDragging} />
    </DndContext>,
  );
};

describe("DealCard", () => {
  it("renders deal information correctly", () => {
    renderDealCard();

    // Title
    expect(screen.getByText("Enterprise Software Deal")).toBeInTheDocument();

    // Value
    expect(screen.getByText("$50,000")).toBeInTheDocument();

    // Company
    expect(screen.getByText("Tech Corp International")).toBeInTheDocument();

    // Owner
    expect(screen.getByText("Sarah Johnson")).toBeInTheDocument();

    // Days in stage
    expect(screen.getByText("5d")).toBeInTheDocument();
  });

  it("shows multiple contacts correctly", () => {
    renderDealCard();

    expect(screen.getByText("2 contacts")).toBeInTheDocument();
  });

  it("shows single contact name when only one contact", () => {
    const singleContactDeal = {
      ...mockDeal,
      contacts: [mockDeal.contacts[0]],
    };

    renderDealCard(singleContactDeal);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("formats currency correctly for different values", () => {
    const dealWithLargeValue = {
      ...mockDeal,
      value: 1500000,
    };

    renderDealCard(dealWithLargeValue);

    expect(screen.getByText("$1,500,000")).toBeInTheDocument();
  });

  it("shows close date relative to now", () => {
    renderDealCard();

    // The exact text depends on timing, but it should contain "Close"
    expect(screen.getByText(/Close/)).toBeInTheDocument();
  });

  it("shows stalled badge when deal is in stage for more than 30 days", () => {
    const stalledDeal = {
      ...mockDeal,
      daysInStage: 45,
      stageEnteredAt: new Date(
        Date.now() - 45 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };

    renderDealCard(stalledDeal);

    expect(screen.getByText("Stalled")).toBeInTheDocument();
  });

  it("does not show stalled badge for deals under 30 days", () => {
    renderDealCard();

    expect(screen.queryByText("Stalled")).not.toBeInTheDocument();
  });

  it("shows activity indicators with correct counts", () => {
    renderDealCard();

    expect(screen.getByText("8")).toBeInTheDocument(); // emails
    expect(screen.getByText("12")).toBeInTheDocument(); // activities
    expect(screen.getByText("3")).toBeInTheDocument(); // tasks
  });

  it("hides activity indicators when count is zero", () => {
    const dealWithNoActivities = {
      ...mockDeal,
      _count: {
        activities: 0,
        tasks: 0,
        notes: 0,
        emails: 0,
      },
    };

    renderDealCard(dealWithNoActivities);

    // Should not show any count badges
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders owner initials when avatar URL is not available", () => {
    const dealWithoutAvatar = {
      ...mockDeal,
      owner: {
        ...mockDeal.owner,
        avatarUrl: undefined,
      },
    };

    renderDealCard(dealWithoutAvatar);

    expect(screen.getByText("SJ")).toBeInTheDocument();
  });

  it("applies dragging styles when isDragging is true", () => {
    const { container } = renderDealCard(mockDeal, true);

    const cardWrapper = container.firstChild as HTMLElement;
    expect(cardWrapper.style.opacity).toBe("0.5");
  });

  it("handles deal without company", () => {
    const dealWithoutCompany = {
      ...mockDeal,
      company: undefined,
    };

    renderDealCard(dealWithoutCompany);

    expect(
      screen.queryByText("Tech Corp International"),
    ).not.toBeInTheDocument();
  });

  it("handles deal without close date", () => {
    const dealWithoutCloseDate = {
      ...mockDeal,
      closeDate: undefined,
    };

    renderDealCard(dealWithoutCloseDate);

    expect(screen.queryByText(/Close/)).not.toBeInTheDocument();
  });

  it("handles deal without contacts", () => {
    const dealWithoutContacts = {
      ...mockDeal,
      contacts: [],
    };

    renderDealCard(dealWithoutContacts);

    expect(screen.queryByText(/contacts/)).not.toBeInTheDocument();
  });

  it("formats different currencies correctly", () => {
    const euroDeal = {
      ...mockDeal,
      currency: "EUR",
      value: 42000,
    };

    renderDealCard(euroDeal);

    // The exact format depends on locale, but it should include the amount
    const currencyElement = screen.getByText(/42,000/);
    expect(currencyElement).toBeInTheDocument();
  });

  it("truncates long deal titles", () => {
    const longTitleDeal = {
      ...mockDeal,
      title:
        "This is a very long deal title that should be truncated to fit within the card boundaries without breaking the layout",
    };

    renderDealCard(longTitleDeal);

    const titleElement = screen.getByText(longTitleDeal.title);
    expect(titleElement).toHaveClass("line-clamp-2");
  });

  it("truncates long company names", () => {
    const longCompanyDeal = {
      ...mockDeal,
      company: {
        ...mockDeal.company!,
        name: "Very Long Company Name That Goes On And On International Corporation Ltd.",
      },
    };

    renderDealCard(longCompanyDeal);

    const companyElement = screen.getByText(longCompanyDeal.company.name);
    expect(companyElement).toHaveClass("truncate");
  });

  it("has correct hover styles", () => {
    const { container } = renderDealCard();

    // Card component uses different classes, check for the actual Card element
    const card = container.querySelector('[class*="rounded-lg border"]');
    expect(card).toHaveClass("hover:shadow-md", "transition-shadow");
  });

  it("has cursor-move class for drag functionality", () => {
    const { container } = renderDealCard();

    // Card component uses different classes, check for the actual Card element
    const card = container.querySelector('[class*="rounded-lg border"]');
    expect(card).toHaveClass("cursor-move");
  });
});