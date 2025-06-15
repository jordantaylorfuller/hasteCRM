import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event"; // eslint-disable-line no-unused-vars
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import DashboardLayout from "./layout";

// Mock dependencies
jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
      className,
      onClick,
    }: {
      children: React.ReactNode;
      href: string;
      className?: string;
      onClick?: () => void;
    }) => (
      <a
        href={href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}
      >
        {children}
      </a>
    ),
  };
});

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  LayoutDashboard: () => <div data-testid="icon-dashboard" />,
  Users: () => <div data-testid="icon-users" />,
  Building2: () => <div data-testid="icon-building" />,
  Mail: () => <div data-testid="icon-mail" />,
  Settings: () => <div data-testid="icon-settings" />,
  LogOut: () => <div data-testid="icon-logout" />,
  Menu: () => <div data-testid="icon-menu" />,
  X: () => <div data-testid="icon-x" />,
  Kanban: () => <div data-testid="icon-kanban" />,
}));

describe("Dashboard Layout", () => {
  const mockPush = jest.fn();
  const mockLogout = jest.fn();
  const mockRouter = { push: mockPush };
  const mockUser = {
    id: "1",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    status: "ACTIVE",
  };
  const mockWorkspace = {
    id: "1",
    name: "My Company",
    plan: "PRO",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("renders loading state", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      workspace: null,
      loading: true,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
  });

  it("redirects to login when not authenticated", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      workspace: null,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders layout with user information", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Check user info is displayed
    expect(screen.getAllByText("John Doe")[0]).toBeInTheDocument();
    expect(screen.getAllByText("john@example.com")[0]).toBeInTheDocument();

    // Check content is rendered
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Desktop navigation
    expect(screen.getAllByText("Dashboard")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Pipelines")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Contacts")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Companies")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Emails")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Settings")[0]).toBeInTheDocument();
  });

  it("highlights active navigation item", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });
    (usePathname as jest.Mock).mockReturnValue("/contacts");

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    const contactsLinks = screen.getAllByText("Contacts");
    // Check that at least one contacts link has the active class
    const activeLink = contactsLinks.find((link) => {
      const linkElement = link.closest("a");
      return (
        linkElement?.className?.includes("bg-gray-100") &&
        linkElement?.className?.includes("text-gray-900")
      );
    });
    expect(activeLink).toBeTruthy();
  });

  it("calls logout function when logout button is clicked", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Click desktop logout button
    const logoutButtons = screen.getAllByText("Logout");
    fireEvent.click(logoutButtons[0]);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("toggles mobile sidebar", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Mobile menu should be hidden initially
    const mobileSidebar = screen
      .getByTestId("icon-x")
      .closest("nav")?.parentElement;
    expect(mobileSidebar).toHaveClass("hidden");

    // Click menu button to open
    const menuButton = screen.getByTestId("icon-menu").parentElement;
    fireEvent.click(menuButton!);

    // Mobile menu should be visible
    expect(mobileSidebar).toHaveClass("block");

    // Click X button to close
    const closeButton = screen.getByTestId("icon-x").parentElement;
    fireEvent.click(closeButton!);

    // Mobile menu should be hidden again
    expect(mobileSidebar).toHaveClass("hidden");
  });

  it("closes mobile sidebar when clicking overlay", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Open mobile menu
    const menuButton = screen.getByTestId("icon-menu").parentElement;
    fireEvent.click(menuButton!);

    // Click overlay
    const overlay = document.querySelector(".bg-gray-600.bg-opacity-75");
    fireEvent.click(overlay!);

    // Mobile menu should be hidden
    const mobileSidebar = screen
      .getByTestId("icon-x")
      .closest("nav")?.parentElement;
    expect(mobileSidebar).toHaveClass("hidden");
  });

  it("closes mobile sidebar when navigation link is clicked", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Open mobile menu
    const menuButton = screen.getByTestId("icon-menu").parentElement;
    fireEvent.click(menuButton!);

    // Wait for menu to open
    await waitFor(() => {
      const mobileSidebar = screen
        .getByTestId("icon-x")
        .closest("nav")?.parentElement;
      expect(mobileSidebar).toHaveClass("block");
    });

    // Click a navigation link in mobile menu
    const mobileContactsLink = screen.getAllByText("Contacts")[0];
    fireEvent.click(mobileContactsLink);

    // Mobile menu should be hidden
    await waitFor(() => {
      const mobileSidebar = screen
        .getByTestId("icon-x")
        .closest("nav")?.parentElement;
      expect(mobileSidebar).toHaveClass("hidden");
    });
  });

  it("displays correct page title in mobile header", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });
    (usePathname as jest.Mock).mockReturnValue("/contacts");

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Check mobile header shows correct page
    const mobileHeader =
      screen.getByTestId("icon-menu").parentElement?.parentElement;
    expect(mobileHeader).toHaveTextContent("Contacts");
  });

  it('displays "Dashboard" as fallback title for unknown routes', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });
    // Set a pathname that doesn't match any navigation items
    (usePathname as jest.Mock).mockReturnValue("/unknown-route");

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Check mobile header shows Dashboard as fallback
    const mobileHeader =
      screen.getByTestId("icon-menu").parentElement?.parentElement;
    expect(mobileHeader).toHaveTextContent("Dashboard");
  });

  it("returns null when user or workspace is missing", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    const { container } = render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders hasteCRM branding", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
      loading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>,
    );

    // Should show hasteCRM in both desktop and mobile sidebars
    const brandingElements = screen.getAllByText("hasteCRM");
    expect(brandingElements.length).toBeGreaterThanOrEqual(2);
  });
});
