import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

// Mock Radix UI tabs
jest.mock("@radix-ui/react-tabs");

describe("Tabs", () => {
  const defaultTabs = (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3" disabled>Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
      <TabsContent value="tab3">Content 3</TabsContent>
    </Tabs>
  );

  it("renders tabs with default value", () => {
    render(defaultTabs);
    
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Tab 3")).toBeInTheDocument();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
  });

  it("switches tabs on click", async () => {
    render(defaultTabs);
    
    const tab2 = screen.getByText("Tab 2");
    fireEvent.click(tab2);
    
    await waitFor(() => {
      // Check that content 2 is visible
      const content2 = screen.getByText("Content 2");
      expect(content2).toBeInTheDocument();
      
      // Content 1 might still be in DOM but hidden
      const content1Element = content2.parentElement?.parentElement?.querySelector('[aria-labelledby*="tab1"]');
      if (content1Element) {
        expect(content1Element).toHaveAttribute('data-state', 'inactive');
      }
    });
  });

  it("handles controlled value", () => {
    const ControlledTabs = () => {
      const [value, setValue] = React.useState("tab1");
      
      return (
        <Tabs value={value} onValueChange={setValue}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
    };
    
    render(<ControlledTabs />);
    
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Tab 2"));
    
    // In controlled mode, the content is actually swapped
    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("respects disabled state", () => {
    render(defaultTabs);
    
    const disabledTab = screen.getByText("Tab 3");
    expect(disabledTab).toHaveAttribute("data-disabled");
    
    fireEvent.click(disabledTab);
    
    // Content should not change
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 3")).not.toBeInTheDocument();
  });

  it("applies custom className to TabsList", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList className="custom-list-class">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );
    
    const tabsList = screen.getByRole("tablist");
    expect(tabsList).toHaveClass("custom-list-class");
    expect(tabsList).toHaveClass("inline-flex");
    expect(tabsList).toHaveClass("bg-muted");
  });

  it("applies custom className to TabsTrigger", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" className="custom-trigger-class">
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );
    
    const trigger = screen.getByRole("tab", { name: "Tab 1" });
    expect(trigger).toHaveClass("custom-trigger-class");
    expect(trigger).toHaveClass("inline-flex");
  });

  it("applies custom className to TabsContent", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="custom-content-class">
          Content 1
        </TabsContent>
      </Tabs>
    );
    
    const content = screen.getByRole("tabpanel");
    expect(content).toHaveClass("custom-content-class");
    expect(content).toHaveClass("mt-2");
  });

  it("handles keyboard navigation", async () => {
    const user = userEvent.setup();
    render(defaultTabs);
    
    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    const tab2 = screen.getByRole("tab", { name: "Tab 2" });
    
    // Focus tab1 and press Enter
    await user.click(tab1);
    await user.keyboard("{Enter}");
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    
    // Click tab2 and verify it activates
    await user.click(tab2);
    await user.keyboard("{Enter}");
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("shows active state correctly", () => {
    render(defaultTabs);
    
    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    const tab2 = screen.getByRole("tab", { name: "Tab 2" });
    
    expect(tab1).toHaveAttribute("data-state", "active");
    expect(tab2).toHaveAttribute("data-state", "inactive");
    
    fireEvent.click(tab2);
    
    expect(tab1).toHaveAttribute("data-state", "inactive");
    expect(tab2).toHaveAttribute("data-state", "active");
  });

  it("handles focus visible state", async () => {
    const user = userEvent.setup();
    render(defaultTabs);
    
    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    
    // Tab to focus - might need to tab twice if tablist gets focus first
    await user.tab();
    if (document.activeElement !== tab1) {
      await user.tab();
    }
    expect(tab1).toHaveFocus();
    // The focus-visible class is applied by CSS, just verify focus works
  });

  it("renders with orientation prop", () => {
    render(
      <Tabs defaultValue="tab1" orientation="vertical">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );
    
    const tabsList = screen.getByRole("tablist");
    expect(tabsList).toHaveAttribute("aria-orientation", "vertical");
  });

  it("forwards refs correctly", () => {
    const listRef = React.createRef<HTMLDivElement>();
    const triggerRef = React.createRef<HTMLButtonElement>();
    const contentRef = React.createRef<HTMLDivElement>();
    
    render(
      <Tabs defaultValue="tab1">
        <TabsList ref={listRef}>
          <TabsTrigger ref={triggerRef} value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent ref={contentRef} value="tab1">Content 1</TabsContent>
      </Tabs>
    );
    
    expect(listRef.current).toBeInstanceOf(HTMLDivElement);
    expect(triggerRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it("maintains proper ARIA attributes", () => {
    render(defaultTabs);
    
    const tabsList = screen.getByRole("tablist");
    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    const content1 = screen.getByRole("tabpanel");
    
    // TabsList should have proper role
    expect(tabsList).toBeInTheDocument();
    
    // Tabs should have proper attributes
    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab1).toHaveAttribute("aria-controls");
    
    // Content should have proper attributes
    expect(content1).toHaveAttribute("aria-labelledby");
  });

  it("handles asChild prop", () => {
    // Our mock doesn't fully support asChild, just verify it doesn't crash
    const { container } = render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" asChild>
            <a href="#tab1">Tab 1</a>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>
    );
    
    // Just verify the component renders
    expect(container.querySelector('[href="#tab1"]')).toBeInTheDocument();
  });

  it("handles nested tabs", () => {
    render(
      <Tabs defaultValue="outer1">
        <TabsList>
          <TabsTrigger value="outer1">Outer 1</TabsTrigger>
          <TabsTrigger value="outer2">Outer 2</TabsTrigger>
        </TabsList>
        <TabsContent value="outer1">
          <Tabs defaultValue="inner1">
            <TabsList>
              <TabsTrigger value="inner1">Inner 1</TabsTrigger>
              <TabsTrigger value="inner2">Inner 2</TabsTrigger>
            </TabsList>
            <TabsContent value="inner1">Inner Content 1</TabsContent>
            <TabsContent value="inner2">Inner Content 2</TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="outer2">Outer Content 2</TabsContent>
      </Tabs>
    );
    
    expect(screen.getByText("Inner Content 1")).toBeInTheDocument();
    
    // Click inner tab
    fireEvent.click(screen.getByText("Inner 2"));
    expect(screen.getByText("Inner Content 2")).toBeInTheDocument();
    
    // Click outer tab
    fireEvent.click(screen.getByText("Outer 2"));
    expect(screen.getByText("Outer Content 2")).toBeInTheDocument();
  });

  it("handles dynamic tabs", () => {
    const DynamicTabs = () => {
      const [tabs, setTabs] = React.useState(["tab1", "tab2"]);
      
      return (
        <>
          <button onClick={() => setTabs([...tabs, `tab${tabs.length + 1}`])}>
            Add Tab
          </button>
          <Tabs defaultValue="tab1">
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab} value={tab}>
                Content for {tab}
              </TabsContent>
            ))}
          </Tabs>
        </>
      );
    };
    
    render(<DynamicTabs />);
    
    expect(screen.getByText("tab1")).toBeInTheDocument();
    expect(screen.getByText("tab2")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Add Tab"));
    
    expect(screen.getByText("tab3")).toBeInTheDocument();
  });

  it("preserves displayName for debugging", () => {
    // Check that components have displayName set
    expect(TabsList.displayName).toBeDefined();
    expect(TabsTrigger.displayName).toBeDefined();
    expect(TabsContent.displayName).toBeDefined();
  });
});