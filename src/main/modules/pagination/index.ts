export interface PaginationItem {
  number?: number;
  href?: string;
  current?: boolean;
  ellipsis?: boolean;
}

export interface PaginationLink {
  href: string;
}


export interface Pagination {
  currentPage: number;
  totalPages: number;
  items: PaginationItem[];
  previous?: PaginationLink;
  next?: PaginationLink;
}

export function parsePageNumber(value: unknown, maxPage = Number.MAX_SAFE_INTEGER): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d+$/.test(text)) {
    return 1;
  }
  const pageNumber = Number(text);
  return pageNumber >= 1 && pageNumber <= maxPage ? pageNumber : 1;
}


export function buildPagination(
  currentPage: number,
  totalPages: number,
  hrefFor: (pageNumber: number) => string
): Pagination | undefined {
  if (totalPages <= 1) {
    return undefined;
  }

  const pageItem = (pageNumber: number): PaginationItem => ({
    number: pageNumber,
    href: hrefFor(pageNumber),
    current: pageNumber === currentPage,
  });

  const shownPages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter(pageNumber => pageNumber >= 1 && pageNumber <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let lastShownPage = 0;
  for (const pageNumber of shownPages) {
    const skippedPages = pageNumber - lastShownPage - 1;
    if (skippedPages === 1) {
      items.push(pageItem(lastShownPage + 1));
    } else if (skippedPages > 1) {
      items.push({ ellipsis: true });
    }
    items.push(pageItem(pageNumber));
    lastShownPage = pageNumber;
  }

  return {
    currentPage,
    totalPages,
    items,
    ...(currentPage > 1 ? { previous: { href: hrefFor(currentPage - 1) } } : {}),
    ...(currentPage < totalPages ? { next: { href: hrefFor(currentPage + 1) } } : {}),
  };
}
