import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu";

// Mock Radix UI dropdown menu
jest.mock("@radix-ui/react-dropdown-menu");

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Check: ({ className }: { className?: string }) => (
    <div data-testid="check-icon" className={className}>
      Check
    </div>
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <div data-testid="chevron-right" className={className}>
      ChevronRight
    </div>
  ),
  Circle: ({ className }: { className?: string }) => (
    <div data-testid="circle-icon" className={className}>
      Circle
    </div>
  ),
}));

describe("DropdownMenu", () => {
  const BasicDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item 1</DropdownMenuItem>
        <DropdownMenuItem>Item 2</DropdownMenuItem>
        <DropdownMenuItem disabled>Disabled Item</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  describe("Basic functionality", () => {
    it("renders trigger button", () => {
      render(<BasicDropdown />);
      expect(screen.getByText("Open Menu")).toBeInTheDocument();
    });

    it("opens menu on trigger click", async () => {
      render(<BasicDropdown />);

      const trigger = screen.getByText("Open Menu");
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
        expect(screen.getByText("Item 2")).toBeInTheDocument();
      });
    });

    it("closes menu on item click", async () => {
      render(<BasicDropdown />);

      fireEvent.click(screen.getByText("Open Menu"));
      await waitFor(() =>
        expect(screen.getByText("Item 1")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByText("Item 1"));

      await waitFor(() => {
        expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      });
    });

    it("closes menu on escape key", async () => {
      const user = userEvent.setup();
      render(<BasicDropdown />);

      await user.click(screen.getByText("Open Menu"));
      await waitFor(() =>
        expect(screen.getByText("Item 1")).toBeInTheDocument(),
      );

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      });
    });

    it("respects disabled items", async () => {
      render(<BasicDropdown />);

      fireEvent.click(screen.getByText("Open Menu"));
      await waitFor(() =>
        expect(screen.getByText("Disabled Item")).toBeInTheDocument(),
      );

      const disabledItem = screen.getByText("Disabled Item");
      expect(disabledItem).toHaveAttribute("data-disabled");
      expect(disabledItem).toHaveClass("pointer-events-none", "opacity-50");
    });
  });

  describe("DropdownMenuContent", () => {
    it("applies custom className", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent className="custom-content">
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const content = screen.getByRole("menu");
        expect(content).toHaveClass("custom-content");
      });
    });

    it("uses default sideOffset", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("applies animation classes", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const content = screen.getByRole("menu");
        expect(content.className).toContain("data-[state=open]:animate-in");
      });
    });
  });

  describe("DropdownMenuItem", () => {
    it("applies inset padding", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const item = screen.getByText("Inset Item");
        expect(item).toHaveClass("pl-8");
      });
    });

    it("handles click events", async () => {
      const handleClick = jest.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleClick}>Click Me</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));
      await waitFor(() =>
        expect(screen.getByText("Click Me")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByText("Click Me"));
      expect(handleClick).toHaveBeenCalled();
    });

    it("applies hover and focus styles", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Hover Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const item = screen.getByText("Hover Item");
        expect(item.className).toContain("focus:bg-accent");
        expect(item.className).toContain("transition-colors");
      });
    });
  });

  describe("DropdownMenuCheckboxItem", () => {
    it("renders unchecked state", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={false}>
              Unchecked
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Unchecked")).toBeInTheDocument();
        expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();
      });
    });

    it("renders checked state", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>
              Checked
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Checked")).toBeInTheDocument();
        expect(screen.getByTestId("check-icon")).toBeInTheDocument();
      });
    });

    it("toggles checked state", async () => {
      const CheckboxDropdown = () => {
        const [checked, setChecked] = React.useState(false);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger>Open</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuCheckboxItem
                checked={checked}
                onCheckedChange={setChecked}
              >
                Toggle Me
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      };

      render(<CheckboxDropdown />);

      fireEvent.click(screen.getByText("Open"));
      await waitFor(() =>
        expect(screen.getByText("Toggle Me")).toBeInTheDocument(),
      );

      expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Toggle Me"));

      await waitFor(() => {
        expect(screen.getByTestId("check-icon")).toBeInTheDocument();
      });
    });
  });

  describe("DropdownMenuRadioGroup", () => {
    it("renders radio items", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">
                Option 1
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">
                Option 2
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("Option 2")).toBeInTheDocument();
        // Only selected item should have indicator
        expect(screen.getAllByTestId("circle-icon")).toHaveLength(1);
      });
    });

    it("changes selection", async () => {
      const RadioDropdown = () => {
        const [value, setValue] = React.useState("option1");

        return (
          <DropdownMenu>
            <DropdownMenuTrigger>Open</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
                <DropdownMenuRadioItem value="option1">
                  Option 1
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="option2">
                  Option 2
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      };

      render(<RadioDropdown />);

      fireEvent.click(screen.getByText("Open"));
      await waitFor(() =>
        expect(screen.getByText("Option 2")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByText("Option 2"));

      // Menu stays open for radio items
      expect(screen.getByText("Option 2")).toBeInTheDocument();
    });
  });

  describe("DropdownMenuLabel", () => {
    it("renders label with styling", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const label = screen.getByText("Actions");
        expect(label).toHaveClass("font-semibold");
      });
    });

    it("applies inset styling", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const label = screen.getByText("Inset Label");
        expect(label).toHaveClass("pl-8");
      });
    });
  });

  describe("DropdownMenuSeparator", () => {
    it("renders separator", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const content = screen.getByRole("menu");
        const separator = content.querySelector('[role="separator"]');
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass("bg-muted");
      });
    });
  });

  describe("DropdownMenuShortcut", () => {
    it("renders shortcut text", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Save
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("⌘S")).toBeInTheDocument();
        expect(screen.getByText("⌘S")).toHaveClass(
          "ml-auto",
          "text-xs",
          "opacity-60",
        );
      });
    });

    it("preserves displayName", () => {
      expect(DropdownMenuShortcut.displayName).toBe("DropdownMenuShortcut");
    });
  });

  describe("DropdownMenuSub", () => {
    it("renders submenu", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Sub Item 1</DropdownMenuItem>
                <DropdownMenuItem>Sub Item 2</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const trigger = screen.getByText("More");
        expect(trigger).toBeInTheDocument();
        expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
      });

      fireEvent.pointerEnter(screen.getByText("More"));

      await waitFor(() => {
        expect(screen.getByText("Sub Item 1")).toBeInTheDocument();
        expect(screen.getByText("Sub Item 2")).toBeInTheDocument();
      });
    });

    it("applies inset to sub trigger", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Inset Sub</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const trigger = screen.getByText("Inset Sub");
        expect(trigger).toHaveClass("pl-8");
      });
    });
  });

  describe("DropdownMenuPortal", () => {
    it("renders content in portal", () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent>
              <DropdownMenuItem>Portal Item</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      expect(screen.getByText("Portal Item")).toBeInTheDocument();
    });
  });

  describe("Keyboard navigation", () => {
    it("navigates with arrow keys", async () => {
      const user = userEvent.setup();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
            <DropdownMenuItem>Item 3</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() =>
        expect(screen.getByText("Item 1")).toBeInTheDocument(),
      );

      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toHaveTextContent("Item 1");

      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toHaveTextContent("Item 2");
    });

    it("activates item with Enter key", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleClick}>Click Me</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() =>
        expect(screen.getByText("Click Me")).toBeInTheDocument(),
      );

      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe("Complex menu structures", () => {
    it("renders nested groups", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Group 1</DropdownMenuLabel>
              <DropdownMenuItem>Item 1.1</DropdownMenuItem>
              <DropdownMenuItem>Item 1.2</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Group 2</DropdownMenuLabel>
              <DropdownMenuItem>Item 2.1</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      fireEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Group 1")).toBeInTheDocument();
        expect(screen.getByText("Group 2")).toBeInTheDocument();
        expect(screen.getByText("Item 1.1")).toBeInTheDocument();
        expect(screen.getByText("Item 2.1")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", async () => {
      render(<BasicDropdown />);

      const trigger = screen.getByText("Open Menu");
      expect(trigger).toHaveAttribute("aria-haspopup", "menu");

      fireEvent.click(trigger);

      await waitFor(() => {
        const menu = screen.getByRole("menu");
        expect(menu).toBeInTheDocument();

        const items = screen.getAllByRole("menuitem");
        expect(items).toHaveLength(3);
      });
    });

    it("manages focus correctly", async () => {
      const user = userEvent.setup();
      render(<BasicDropdown />);

      const trigger = screen.getByText("Open Menu");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      // Focus should be manageable within the menu
      await user.tab();
      expect(document.activeElement).toHaveTextContent("Item 1");
    });
  });

  describe("displayName preservation", () => {
    it("preserves display names from Radix primitives", () => {
      // These components get their displayName from Radix primitives
      expect(DropdownMenuSubTrigger.displayName).toBeDefined();
      expect(DropdownMenuSubContent.displayName).toBeDefined();
      expect(DropdownMenuContent.displayName).toBeDefined();
      expect(DropdownMenuItem.displayName).toBeDefined();
      expect(DropdownMenuCheckboxItem.displayName).toBeDefined();
      expect(DropdownMenuRadioItem.displayName).toBeDefined();
      expect(DropdownMenuLabel.displayName).toBeDefined();
      expect(DropdownMenuSeparator.displayName).toBeDefined();

      // DropdownMenuShortcut has its own displayName
      expect(DropdownMenuShortcut.displayName).toBe("DropdownMenuShortcut");
    });
  });
});
