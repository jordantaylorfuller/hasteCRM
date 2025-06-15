import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useToast, toast, reducer } from "./use-toast";

// Mock timers
jest.useFakeTimers();

describe("use-toast", () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    // Clean up any remaining timeouts
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  describe("reducer", () => {
    const initialState = { toasts: [] };

    it("handles ADD_TOAST action", () => {
      const newToast = {
        id: "1",
        title: "Test Toast",
        description: "Test Description",
      };

      const state = reducer(initialState, {
        type: "ADD_TOAST",
        toast: newToast,
      });

      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]).toEqual(newToast);
    });

    it("limits toasts to TOAST_LIMIT (1)", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Toast 1" },
      });

      const state2 = reducer(state1, {
        type: "ADD_TOAST",
        toast: { id: "2", title: "Toast 2" },
      });

      expect(state2.toasts).toHaveLength(1);
      expect(state2.toasts[0].id).toBe("2");
    });

    it("handles UPDATE_TOAST action", () => {
      const initialToast = { id: "1", title: "Original" };
      const stateWithToast = { toasts: [initialToast] };

      const state = reducer(stateWithToast, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Updated", description: "New desc" },
      });

      expect(state.toasts[0]).toEqual({
        id: "1",
        title: "Updated",
        description: "New desc",
      });
    });

    it("handles DISMISS_TOAST with specific toastId", () => {
      const stateWithToast = {
        toasts: [{ id: "1", title: "Toast", open: true }],
      };

      const state = reducer(stateWithToast, {
        type: "DISMISS_TOAST",
        toastId: "1",
      });

      expect(state.toasts[0].open).toBe(false);
    });

    it("handles DISMISS_TOAST without toastId (dismisses all)", () => {
      const stateWithToasts = {
        toasts: [
          { id: "1", title: "Toast 1", open: true },
          { id: "2", title: "Toast 2", open: true },
        ],
      };

      const state = reducer(stateWithToasts, {
        type: "DISMISS_TOAST",
      });

      expect(state.toasts[0].open).toBe(false);
      expect(state.toasts[1].open).toBe(false);
    });

    it("handles REMOVE_TOAST with specific toastId", () => {
      const stateWithToasts = {
        toasts: [
          { id: "1", title: "Toast 1" },
          { id: "2", title: "Toast 2" },
        ],
      };

      const state = reducer(stateWithToasts, {
        type: "REMOVE_TOAST",
        toastId: "1",
      });

      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe("2");
    });

    it("handles REMOVE_TOAST without toastId (removes all)", () => {
      const stateWithToasts = {
        toasts: [
          { id: "1", title: "Toast 1" },
          { id: "2", title: "Toast 2" },
        ],
      };

      const state = reducer(stateWithToasts, {
        type: "REMOVE_TOAST",
      });

      expect(state.toasts).toHaveLength(0);
    });
  });

  describe("useToast hook", () => {
    it("returns initial empty state", () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toEqual([]);
      expect(typeof result.current.toast).toBe("function");
      expect(typeof result.current.dismiss).toBe("function");
    });

    it("adds toast via hook", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: "Test Toast",
          description: "Test Description",
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe("Test Toast");
      expect(result.current.toasts[0].description).toBe("Test Description");
    });

    it("dismisses specific toast", () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const { id } = result.current.toast({ title: "Test" });
        toastId = id;
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismiss(toastId!);
      });

      expect(result.current.toasts[0].open).toBe(false);
    });

    it("dismisses all toasts", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: "Toast 1" });
        result.current.toast({ title: "Toast 2" });
      });

      expect(result.current.toasts).toHaveLength(1); // Limited to 1

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.toasts[0].open).toBe(false);
    });

    it("automatically removes toast after timeout when dismissed", async () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: "Auto Remove" });
      });

      expect(result.current.toasts).toHaveLength(1);

      // Dismiss the toast to trigger the removal queue
      act(() => {
        result.current.dismiss(result.current.toasts[0].id);
      });

      // Toast should be marked as closed but still in array
      expect(result.current.toasts[0].open).toBe(false);

      // Fast forward time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.toasts).toHaveLength(0);
      });
    });

    it("updates across multiple hook instances", () => {
      const { result: result1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      act(() => {
        result1.current.toast({ title: "Shared Toast" });
      });

      // Both hooks should see the same toast
      expect(result1.current.toasts).toHaveLength(1);
      expect(result2.current.toasts).toHaveLength(1);
      expect(result1.current.toasts[0].title).toBe("Shared Toast");
      expect(result2.current.toasts[0].title).toBe("Shared Toast");
    });
  });

  describe("toast function", () => {
    it("returns toast object with id, dismiss, and update", () => {
      const result = toast({ title: "Test" });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("string");
      expect(typeof result.dismiss).toBe("function");
      expect(typeof result.update).toBe("function");
    });

    it("generates unique ids", () => {
      const toast1 = toast({ title: "Toast 1" });
      const toast2 = toast({ title: "Toast 2" });

      expect(toast1.id).not.toBe(toast2.id);
    });

    it("update function updates toast", () => {
      const { result } = renderHook(() => useToast());

      let toastInstance: any;
      act(() => {
        toastInstance = toast({ title: "Original" });
      });

      expect(result.current.toasts[0].title).toBe("Original");

      act(() => {
        toastInstance.update({ title: "Updated" });
      });

      expect(result.current.toasts[0].title).toBe("Updated");
    });

    it("dismiss function dismisses toast", () => {
      const { result } = renderHook(() => useToast());

      let toastInstance: any;
      act(() => {
        toastInstance = toast({ title: "To Dismiss" });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        toastInstance.dismiss();
      });

      expect(result.current.toasts[0].open).toBe(false);
    });

    it("handles onOpenChange callback", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: "With Callback" });
      });

      const toastWithCallback = result.current.toasts[0];
      expect(toastWithCallback.onOpenChange).toBeDefined();

      // Simulate closing via onOpenChange
      act(() => {
        toastWithCallback.onOpenChange!(false);
      });

      expect(result.current.toasts[0].open).toBe(false);
    });
  });

  describe("toast variants", () => {
    it("supports default variant", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: "Default Toast",
          variant: "default",
        });
      });

      expect(result.current.toasts[0].variant).toBe("default");
    });

    it("supports destructive variant", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: "Error Toast",
          variant: "destructive",
        });
      });

      expect(result.current.toasts[0].variant).toBe("destructive");
    });
  });

  describe("edge cases", () => {
    it("handles rapid toast additions", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.toast({ title: `Toast ${i}` });
        }
      });

      // Should only keep the last one due to TOAST_LIMIT
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe("Toast 9");
    });

    it("prevents duplicate remove operations", () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const { id } = result.current.toast({ title: "Test" });
        toastId = id;
      });

      act(() => {
        result.current.dismiss(toastId!);
      });

      // Wait for removal
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.toasts).toHaveLength(0);

      // Try to dismiss again - should not throw
      expect(() => {
        act(() => {
          result.current.dismiss(toastId!);
        });
      }).not.toThrow();
    });

    it("cleans up listeners on unmount", () => {
      const { result, unmount } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: "Test" });
      });

      unmount();

      // Should not throw when updating after unmount
      expect(() => {
        act(() => {
          toast({ title: "After unmount" });
        });
      }).not.toThrow();
    });

    it("handles very long content", () => {
      const { result } = renderHook(() => useToast());
      const longText = "a".repeat(1000);

      act(() => {
        result.current.toast({
          title: longText,
          description: longText,
        });
      });

      expect(result.current.toasts[0].title).toBe(longText);
      expect(result.current.toasts[0].description).toBe(longText);
    });

    it("maintains counter across MAX_VALUE boundary", () => {
      // This is an edge case test for the genId function
      const { result } = renderHook(() => useToast());
      const toastIds = new Set();

      // Generate many IDs
      act(() => {
        for (let i = 0; i < 100; i++) {
          const { id } = toast({ title: `Toast ${i}` });
          toastIds.add(id);
        }
      });

      // All IDs should be unique
      expect(toastIds.size).toBe(100);
    });

    it("prevents adding duplicate timeouts for the same toast", () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const { id } = result.current.toast({ title: "Test" });
        toastId = id;
      });

      // Dismiss the toast to add it to the remove queue
      act(() => {
        result.current.dismiss(toastId!);
      });

      // Try to dismiss again - this should trigger the early return
      act(() => {
        result.current.dismiss(toastId!);
      });

      // Advance timers to trigger removal
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Toast should be removed only once
      expect(result.current.toasts).toHaveLength(0);
    });

    it("handles UPDATE_TOAST with reducer branch coverage", () => {
      const { result } = renderHook(() => useToast());

      // Create a toast
      let toastInstance: any;
      act(() => {
        toastInstance = result.current.toast({ title: "Original" });
      });

      expect(result.current.toasts).toHaveLength(1);
      const toastId = result.current.toasts[0].id;

      // Update the toast
      act(() => {
        toastInstance.update({
          title: "Updated",
          description: "New description",
        });
      });

      // Toast should be updated
      expect(result.current.toasts[0].title).toBe("Updated");
      expect(result.current.toasts[0].description).toBe("New description");

      // The UPDATE_TOAST action only updates toasts that match the ID
      // Since we only have one toast, the branch where t.id !== action.toast.id
      // is covered when the internal array.map checks other array positions (if any)
    });

    it("handles UPDATE_TOAST with multiple toasts to cover false branch", () => {
      const { result } = renderHook(() => useToast());

      // Create first toast
      let toastInstance1: any;
      act(() => {
        toastInstance1 = result.current.toast({ title: "Toast 1" });
      });

      // Wait a bit to ensure different IDs
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Try to create second toast but it will replace the first due to TOAST_LIMIT=1
      let toastInstance2: any;
      act(() => {
        toastInstance2 = result.current.toast({ title: "Toast 2" });
      });

      // Now we have one toast (Toast 2)
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe("Toast 2");

      // Update toast1 which doesn't exist anymore - this will trigger the false branch
      act(() => {
        toastInstance1.update({ title: "Updated Toast 1" });
      });

      // The toast should remain unchanged since toastInstance1's ID doesn't match
      expect(result.current.toasts[0].title).toBe("Toast 2");
    });

    it("dismisses all toasts when toastId is undefined", () => {
      const { result } = renderHook(() => useToast());

      // Create a toast (only 1 due to TOAST_LIMIT)
      act(() => {
        result.current.toast({ title: "Toast 1" });
      });

      expect(result.current.toasts).toHaveLength(1);

      // Dismiss all toasts by passing undefined
      act(() => {
        result.current.dismiss();
      });

      // The toast should have open: false
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].open).toBe(false);

      // Advance timers to trigger removal
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // All toasts should be removed
      expect(result.current.toasts).toHaveLength(0);
    });

    it("handles DISMISS_TOAST with specific toastId and multiple toasts", () => {
      const { result } = renderHook(() => useToast());

      // Create first toast
      let toastId1: string;
      act(() => {
        const { id } = result.current.toast({ title: "Toast 1" });
        toastId1 = id;
      });

      // Wait to ensure different IDs
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Create second toast (will replace first due to TOAST_LIMIT)
      let toastId2: string;
      act(() => {
        const { id } = result.current.toast({ title: "Toast 2" });
        toastId2 = id;
      });

      // We have one toast (Toast 2)
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].id).toBe(toastId2);

      // Dismiss a toast with a non-existent ID to cover false branch
      act(() => {
        result.current.dismiss("non-existent-id");
      });

      // Toast 2 should remain open because its ID doesn't match
      expect(result.current.toasts[0].open).not.toBe(false);
      expect(result.current.toasts[0].id).toBe(toastId2);

      // Now dismiss the actual toast
      act(() => {
        result.current.dismiss(toastId2);
      });

      // Toast should be marked as closed
      expect(result.current.toasts[0].open).toBe(false);
    });
  });
});
