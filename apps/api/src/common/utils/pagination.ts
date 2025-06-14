export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function calculateSkip(page: number, limit: number): number {
  const validPage = Math.max(1, page);
  const validLimit = Math.max(0, limit);
  return (validPage - 1) * validLimit;
}

export function paginateResults<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): PaginationResult<T> {
  const validPage = Math.max(1, page);
  const validLimit = Math.max(1, limit);
  const pages = Math.ceil(total / validLimit) || 0;

  return {
    items,
    total,
    page: validPage,
    limit: validLimit,
    pages,
    hasNext: validPage < pages,
    hasPrev: validPage > 1,
  };
}