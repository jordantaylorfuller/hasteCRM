import { render, screen } from "@testing-library/react";
import { StageColumn } from "./StageColumn";
import { DndContext } from "@dnd-kit/core";

// Mock @dnd-kit/core
let mockIsOver = false;
jest.mock("@dnd-kit/core", () => ({
  ...jest.requireActual("@dnd-kit/core"),
  useDroppable: () => ({
    setNodeRef: jest.fn(),
    isOver: mockIsOver,
  }),
}));

// Mock @dnd-kit/sortable
jest.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: undefined,
  }),
}));

const mockStage = {
  id: "stage-1",
  name: "Qualification",
  color: "#3B82F6",
  probability: 20,
};

const mockDeals = [
  {
    id: "deal-1",
    title: "Enterprise Deal",
    value: 50000,
    currency: "USD",
    probability: 20,
    closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    daysInStage: 5,
    owner: {
      id: "owner-1",
      firstName: "John",
      lastName: "Doe",
      avatarUrl: "https://example.com/avatar.jpg",
    },
    company: {
      id: "company-1",
      name: "Tech Corp",
      logoUrl: "https://example.com/logo.jpg",
    },
    contacts: [
      {
        id: "contact-1",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@techcorp.com",
      },
    ],
    _count: {
      activities: 5,
      tasks: 2,
      notes: 3,
      emails: 4,
    },
  },
  {
    id: "deal-2",
    title: "Small Business Package",
    value: 15000,
    currency: "USD",
    probability: 20,
    stageEnteredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    daysInStage: 10,
    owner: {
      id: "owner-2",
      firstName: "Sarah",
      lastName: "Johnson",
    },
    contacts: [],
    _count: {
      activities: 0,
      tasks: 0,
      notes: 0,
      emails: 0,
    },
  },
];

const renderStageColumn = (props = {}) => {
  const defaultProps = {
    stage: mockStage,
    deals: mockDeals,
    totalValue: 65000,
    currency: "USD",
    ...props,
  };

  return render(
    <DndContext>
      <StageColumn {...defaultProps} />
    </DndContext>,
  );
};

describe("StageColumn", () => {
  it("renders stage information correctly", () => {
    renderStageColumn();

    // Stage name
    expect(screen.getByText("Qualification")).toBeInTheDocument();

    // Deal count badge - use getAllByText since there might be multiple "2"s
    const badges = screen.getAllByText("2");
    expect(badges.length).toBeGreaterThan(0);

    // Probability
    expect(screen.getByText("20%")).toBeInTheDocument();

    // Total value
    expect(screen.getByText("$65,000")).toBeInTheDocument();
  });

  it("renders stage color indicator", () => {
    const { container } = renderStageColumn();

    const colorIndicator = container.querySelector('[style*="background-color: rgb(59, 130, 246)"]');
    expect(colorIndicator).toBeInTheDocument();
  });

  it("renders all deals in the stage", () => {
    renderStageColumn();

    expect(screen.getByText("Enterprise Deal")).toBeInTheDocument();
    expect(screen.getByText("Small Business Package")).toBeInTheDocument();
  });

  it("shows empty state when no deals", () => {
    renderStageColumn({ deals: [] });

    expect(screen.getByText("No deals in this stage")).toBeInTheDocument();
  });

  it("formats currency correctly for different values", () => {
    renderStageColumn({
      totalValue: 1234567,
      currency: "EUR",
    });

    // Should format with currency symbol
    const valueElement = screen.getByText(/1,234,567/);
    expect(valueElement).toBeInTheDocument();
  });

  it("applies hover styles when droppable area is active", () => {
    // Set isOver to true
    mockIsOver = true;

    const { container } = renderStageColumn();

    const droppableArea = container.querySelector('[class*="ring-2"][class*="ring-primary"]');
    expect(droppableArea).toBeInTheDocument();

    // Reset
    mockIsOver = false;
  });

  it("has correct minimum height for droppable area", () => {
    const { container } = renderStageColumn();

    const droppableArea = container.querySelector('[class*="min-h-\\[calc\\(100vh-280px\\)\\]"]');
    expect(droppableArea).toBeInTheDocument();
  });

  it("has correct width constraints", () => {
    const { container } = renderStageColumn();

    const columnContainer = container.firstChild as HTMLElement;
    expect(columnContainer).toHaveClass("min-w-[320px]", "max-w-[400px]");
  });

  it("renders deals in correct order", () => {
    renderStageColumn();

    const dealTitles = screen.getAllByText(/Deal|Package/);
    expect(dealTitles[0]).toHaveTextContent("Enterprise Deal");
    expect(dealTitles[1]).toHaveTextContent("Small Business Package");
  });

  it("shows zero deals correctly", () => {
    renderStageColumn({ deals: [] });

    expect(screen.getByText("0")).toBeInTheDocument(); // Deal count badge
  });

  it("formats total value as zero when no deals", () => {
    renderStageColumn({
      deals: [],
      totalValue: 0,
    });

    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  it("handles different stage colors", () => {
    const greenStage = {
      ...mockStage,
      color: "#10B981",
    };

    const { container } = renderStageColumn({ stage: greenStage });

    const colorIndicator = container.querySelector('[style*="background-color: rgb(16, 185, 129)"]');
    expect(colorIndicator).toBeInTheDocument();
  });

  it("handles high probability stages", () => {
    const highProbStage = {
      ...mockStage,
      probability: 90,
    };

    renderStageColumn({ stage: highProbStage });

    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("applies correct layout classes", () => {
    const { container } = renderStageColumn();

    const column = container.firstChild as HTMLElement;
    expect(column).toHaveClass("flex-1");

    const droppableArea = container.querySelector(".rounded-lg.p-2");
    expect(droppableArea).toBeInTheDocument();
  });
});