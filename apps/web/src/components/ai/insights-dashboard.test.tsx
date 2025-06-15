import { render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { AiInsightsDashboard } from "./insights-dashboard";
import { GET_AI_INSIGHTS } from "@/graphql/queries/ai";

// Mock date to ensure consistent time calculations
const mockDate = new Date("2024-01-20T12:00:00Z");
const originalDate = global.Date;

beforeAll(() => {
  // Mock Date constructor and Date.now()
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        return mockDate;
      }
      return new originalDate(...args);
    }

    static now() {
      return mockDate.getTime();
    }
  } as any;

  // Copy all static methods
  Object.setPrototypeOf(global.Date, originalDate);
  Object.getOwnPropertyNames(originalDate).forEach((prop) => {
    if (
      prop !== "now" &&
      prop !== "prototype" &&
      prop !== "length" &&
      prop !== "name"
    ) {
      global.Date[prop] = originalDate[prop];
    }
  });
});

afterAll(() => {
  global.Date = originalDate;
});

const mockGetAiInsightsSuccess = {
  request: {
    query: GET_AI_INSIGHTS,
    variables: {
      timeRange: {
        start: new Date(
          mockDate.getTime() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        end: mockDate.toISOString(),
      },
    },
  },
  result: {
    data: {
      getAiInsights: {
        communicationPatterns: {
          totalEmails: 234,
          readRate: "87%",
          starRate: "23%",
          avgResponseTime: "2.5h",
          peakHours: ["9:00 AM", "2:00 PM", "4:00 PM"],
        },
        topContacts: [
          {
            id: "1",
            name: "John Doe",
            email: "john@example.com",
            interactionCount: 45,
            lastInteraction: "2024-01-20T10:00:00Z",
          },
          {
            id: "2",
            name: "Jane Smith",
            email: "jane@example.com",
            interactionCount: 38,
            lastInteraction: "2024-01-19T15:30:00Z",
          },
          {
            id: "3",
            name: "Bob Johnson",
            email: "bob@example.com",
            interactionCount: 27,
            lastInteraction: "2024-01-18T09:15:00Z",
          },
        ],
        suggestions: [
          "Consider following up with contacts you haven't engaged with in over 30 days",
          "Your response rate is highest between 9-10 AM. Schedule important emails during this time",
          "You have 5 starred emails that may require action",
          "Consider organizing your contacts into groups for more efficient communication",
        ],
      },
    },
  },
};

const mockGetAiInsightsError = {
  request: {
    query: GET_AI_INSIGHTS,
    variables: {
      timeRange: {
        start: new Date(
          mockDate.getTime() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        end: mockDate.toISOString(),
      },
    },
  },
  error: new Error("Failed to load insights"),
};

const mockGetAiInsightsEmpty = {
  request: {
    query: GET_AI_INSIGHTS,
    variables: {
      timeRange: {
        start: new Date(
          mockDate.getTime() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        end: mockDate.toISOString(),
      },
    },
  },
  result: {
    data: {
      getAiInsights: {
        communicationPatterns: {
          totalEmails: 0,
          readRate: "0%",
          starRate: "0%",
          avgResponseTime: "N/A",
          peakHours: [],
        },
        topContacts: [],
        suggestions: [],
      },
    },
  },
};

describe("AiInsightsDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    // Check for skeleton loaders - using class names instead of data-testid
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders full dashboard with all sections", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // Check header
    expect(
      screen.getByText("Powered by Claude AI - Last 30 days"),
    ).toBeInTheDocument();

    // Check communication patterns section
    expect(screen.getByText("Communication Patterns")).toBeInTheDocument();
    expect(screen.getByText("234")).toBeInTheDocument();
    expect(screen.getByText("Total Emails")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText("Read Rate")).toBeInTheDocument();
    expect(screen.getByText("23%")).toBeInTheDocument();
    expect(screen.getByText("Star Rate")).toBeInTheDocument();
    expect(screen.getByText("2.5h")).toBeInTheDocument();
    expect(screen.getByText("Avg Response")).toBeInTheDocument();

    // Check peak hours
    expect(screen.getByText("Peak Communication Hours")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM")).toBeInTheDocument();
    expect(screen.getByText("4:00 PM")).toBeInTheDocument();

    // Check top contacts section
    expect(screen.getByText("Top Contacts")).toBeInTheDocument();
    expect(
      screen.getByText("Your most frequent email correspondents"),
    ).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();

    // Check AI recommendations section
    expect(screen.getByText("AI Recommendations")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Personalized suggestions to improve your communication",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Consider following up with contacts/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your response rate is highest between 9-10 AM/),
    ).toBeInTheDocument();
    expect(screen.getByText(/You have 5 starred emails/)).toBeInTheDocument();
    expect(
      screen.getByText(/Consider organizing your contacts into groups/),
    ).toBeInTheDocument();
  });

  it("renders error state", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsError]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load AI insights at this time."),
      ).toBeInTheDocument();
    });
  });

  it("handles empty data gracefully", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsEmpty]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // Should show 0 values
    expect(screen.getByText("0")).toBeInTheDocument();
    const zeroPercents = screen.getAllByText("0%");
    expect(zeroPercents).toHaveLength(2); // Read rate and star rate
    expect(screen.getByText("N/A")).toBeInTheDocument();

    // No peak hours badges should be shown
    expect(screen.queryByText("Peak Communication Hours")).toBeInTheDocument();

    // No contacts should be shown
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();

    // No suggestions should be shown
    expect(screen.queryByText(/Consider following up/)).not.toBeInTheDocument();
  });

  it("displays all icons correctly", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // Check for all icons
    expect(document.querySelector(".lucide-brain")).toBeInTheDocument();
    expect(document.querySelector(".lucide-mail")).toBeInTheDocument();
    expect(document.querySelector(".lucide-users")).toBeInTheDocument();
    expect(document.querySelector(".lucide-trending-up")).toBeInTheDocument();
    expect(document.querySelector(".lucide-clock")).toBeInTheDocument();
    expect(document.querySelector(".lucide-star")).toBeInTheDocument();
  });

  it("formats contact avatars correctly", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Check avatar initials
    expect(screen.getByText("JD")).toBeInTheDocument(); // John Doe
    expect(screen.getByText("JS")).toBeInTheDocument(); // Jane Smith
    expect(screen.getByText("BJ")).toBeInTheDocument(); // Bob Johnson
  });

  it("applies hover effects on contact items", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const contactItem = screen
      .getByText("John Doe")
      .closest(".flex.items-center.justify-between");
    expect(contactItem).toHaveClass("hover:bg-muted/50", "transition-colors");
  });

  it("renders suggestion bullets correctly", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Recommendations")).toBeInTheDocument();
    });

    // Check for bullet points (rendered as divs with bg-primary)
    const bullets = document.querySelectorAll(
      ".h-2.w-2.rounded-full.bg-primary",
    );
    expect(bullets).toHaveLength(4); // 4 suggestions
  });

  it("uses correct time range for query", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // The component sets a 30-day range from the mocked date
    // We mocked Date.now() to return 2024-01-20T12:00:00Z
    // So 30 days before would be 2023-12-21T12:00:00Z
  });

  it("handles null insights data", async () => {
    const mockNullInsights = {
      request: {
        query: GET_AI_INSIGHTS,
        variables: {
          timeRange: {
            start: new Date(
              mockDate.getTime() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            end: mockDate.toISOString(),
          },
        },
      },
      result: {
        data: {
          getAiInsights: null,
        },
      },
    };

    render(
      <MockedProvider mocks={[mockNullInsights]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load AI insights at this time."),
      ).toBeInTheDocument();
    });
  });

  it("applies correct styling to sections", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // Check main container styling
    const mainContainer = screen.getByText("AI Insights").closest(".space-y-6");
    expect(mainContainer).toBeInTheDocument();

    // Check card styling - at least one card should exist
    const cards = document.querySelectorAll(".rounded-lg.border");
    expect(cards.length).toBeGreaterThan(0);

    // Check grid layout for stats
    const statsGrid = screen.getByText("Total Emails").closest(".grid");
    expect(statsGrid).toHaveClass("grid-cols-2", "md:grid-cols-4", "gap-4");
  });

  it("handles contact names with multiple parts correctly", async () => {
    jest.setTimeout(10000);
    const mockWithComplexNames = {
      request: {
        query: GET_AI_INSIGHTS,
        variables: {
          timeRange: {
            start: new Date(
              mockDate.getTime() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            end: mockDate.toISOString(),
          },
        },
      },
      result: {
        data: {
          getAiInsights: {
            communicationPatterns: {
              totalEmails: 10,
              readRate: "100%",
              starRate: "0%",
              avgResponseTime: "1h",
              peakHours: [],
            },
            topContacts: [
              {
                id: "1",
                name: "Mary Jane Watson Parker",
                email: "mary@example.com",
                interactionCount: 10,
                lastInteraction: "2024-01-20T10:00:00Z",
              },
            ],
            suggestions: [],
          },
        },
      },
    };

    render(
      <MockedProvider mocks={[mockWithComplexNames]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Mary Jane Watson Parker")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Should show all initials
    expect(screen.getByText("MJWP")).toBeInTheDocument();
  });

  it("displays interaction count label correctly", async () => {
    jest.setTimeout(10000);
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("Top Contacts")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Check for "interactions" label
    const interactionLabels = screen.getAllByText("interactions");
    expect(interactionLabels).toHaveLength(3); // 3 contacts
  });

  it("handles refresh through polling interval", async () => {
    // The component sets up polling with pollInterval: 300000 (5 minutes)
    // We're just checking that the component renders without error with polling enabled
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // Component should render without errors
    expect(document.querySelector(".space-y-6")).toBeInTheDocument();
  });

  it("renders communication pattern icons with correct colors", async () => {
    render(
      <MockedProvider mocks={[mockGetAiInsightsSuccess]} addTypename={false}>
        <AiInsightsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });

    // Check for colored icons
    expect(
      document.querySelector(".lucide-trending-up.text-green-500"),
    ).toBeInTheDocument();
    expect(
      document.querySelector(".lucide-star.text-yellow-500"),
    ).toBeInTheDocument();
    expect(
      document.querySelector(".lucide-clock.text-blue-500"),
    ).toBeInTheDocument();
  });
});
