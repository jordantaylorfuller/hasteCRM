import { paginateResults, calculateSkip } from "./pagination";

describe("Pagination Utils", () => {
  describe("calculateSkip", () => {
    it("should calculate skip for first page", () => {
      expect(calculateSkip(1, 10)).toBe(0);
      expect(calculateSkip(1, 20)).toBe(0);
      expect(calculateSkip(1, 100)).toBe(0);
    });

    it("should calculate skip for subsequent pages", () => {
      expect(calculateSkip(2, 10)).toBe(10);
      expect(calculateSkip(3, 10)).toBe(20);
      expect(calculateSkip(5, 20)).toBe(80);
      expect(calculateSkip(10, 15)).toBe(135);
    });

    it("should handle zero page (treat as page 1)", () => {
      expect(calculateSkip(0, 10)).toBe(0);
      expect(calculateSkip(-1, 10)).toBe(0);
      expect(calculateSkip(-5, 10)).toBe(0);
    });

    it("should handle negative page numbers", () => {
      expect(calculateSkip(-10, 20)).toBe(0);
    });

    it("should handle zero limit", () => {
      expect(calculateSkip(1, 0)).toBe(0);
      expect(calculateSkip(5, 0)).toBe(0);
    });

    it("should handle negative limit", () => {
      expect(calculateSkip(1, -10)).toBe(0);
      expect(calculateSkip(5, -10)).toBe(0);
    });

    it("should handle large page numbers", () => {
      expect(calculateSkip(1000, 50)).toBe(49950);
      expect(calculateSkip(Number.MAX_SAFE_INTEGER, 1)).toBe(
        Number.MAX_SAFE_INTEGER - 1,
      );
    });
  });

  describe("paginateResults", () => {
    const mockItems = ["item1", "item2", "item3", "item4", "item5"];

    it("should paginate results for first page", () => {
      const result = paginateResults(mockItems.slice(0, 3), 1, 3, 10);

      expect(result).toEqual({
        items: ["item1", "item2", "item3"],
        total: 10,
        page: 1,
        limit: 3,
        pages: 4,
        hasNext: true,
        hasPrev: false,
      });
    });

    it("should paginate results for middle page", () => {
      const result = paginateResults(mockItems.slice(0, 2), 2, 2, 5);

      expect(result).toEqual({
        items: ["item1", "item2"],
        total: 5,
        page: 2,
        limit: 2,
        pages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it("should paginate results for last page", () => {
      const result = paginateResults(["item5"], 3, 2, 5);

      expect(result).toEqual({
        items: ["item5"],
        total: 5,
        page: 3,
        limit: 2,
        pages: 3,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("should handle empty results", () => {
      const result = paginateResults([], 1, 10, 0);

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        pages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should handle single page results", () => {
      const result = paginateResults(mockItems, 1, 10, 5);

      expect(result).toEqual({
        items: mockItems,
        total: 5,
        page: 1,
        limit: 10,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should handle zero or negative page numbers", () => {
      const result = paginateResults(mockItems, 0, 5, 10);

      expect(result.page).toBe(1);
      expect(result.hasPrev).toBe(false);
    });

    it("should handle zero or negative limit", () => {
      const result = paginateResults(mockItems, 1, 0, 10);

      expect(result.limit).toBe(1);
      expect(result.pages).toBe(10);
    });

    it("should handle page beyond total pages", () => {
      const result = paginateResults([], 10, 5, 20);

      expect(result).toEqual({
        items: [],
        total: 20,
        page: 10,
        limit: 5,
        pages: 4,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("should handle large datasets", () => {
      const result = paginateResults([], 500, 20, 10000);

      expect(result).toEqual({
        items: [],
        total: 10000,
        page: 500,
        limit: 20,
        pages: 500,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("should handle fractional pages correctly", () => {
      const result = paginateResults([], 1, 3, 10);

      expect(result.pages).toBe(4); // ceil(10/3) = 4
    });

    it("should handle edge case with 1 item per page", () => {
      const result = paginateResults(["item"], 3, 1, 5);

      expect(result).toEqual({
        items: ["item"],
        total: 5,
        page: 3,
        limit: 1,
        pages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });
  });
});
