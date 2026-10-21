import { Pagination, buildPagination, parsePageNumber } from '../../main/modules/pagination';

const hrefFor = (pageNumber: number): string => `/tasks?page=${pageNumber}`;

// Writes the items the way the GOV.UK Design System does: the current page in brackets, skipped pages as an ellipsis
function layout(pagination: Pagination | undefined): string {
  return (pagination?.items ?? [])
    .map(item => {
      if (item.ellipsis) {
        return '…';
      }
      return item.current ? `[${item.number}]` : String(item.number);
    })
    .join(' ');
}

describe('parsePageNumber', () => {
  test.each([
    ['1', 1],
    ['2', 2],
    ['10', 10],
    [' 3 ', 3],
    ['007', 7],
  ])('reads %p as page %p', (value, expected) => {
    expect(parsePageNumber(value)).toBe(expected);
  });

  test.each([
    undefined,
    null,
    '',
    ' ',
    'abc',
    '0',
    '-1',
    '+2',
    '1.5',
    '1e3',
    '2abc',
    '99999999999999999999',
    2,
    ['2'],
    ['2', '3'],
    {},
  ])('falls back to the first page for %p', value => {
    expect(parsePageNumber(value)).toBe(1);
  });

  test('falls back to the first page above the highest allowed page', () => {
    expect(parsePageNumber('5', 5)).toBe(5);
    expect(parsePageNumber('6', 5)).toBe(1);
  });
});

describe('buildPagination', () => {
  test.each([0, 1])('is not needed when there are %p pages', totalPages => {
    expect(buildPagination(1, totalPages, hrefFor)).toBeUndefined();
  });

  // The examples given for 100 pages in the GOV.UK Design System guidance
  test.each([
    [1, '[1] 2 … 100'],
    [2, '1 [2] 3 … 100'],
    [3, '1 2 [3] 4 … 100'],
    [4, '1 2 3 [4] 5 … 100'],
    [5, '1 … 4 [5] 6 … 100'],
    [98, '1 … 97 [98] 99 100'],
    [99, '1 … 98 [99] 100'],
    [100, '1 … 99 [100]'],
  ])('lays out page %p of 100 as "%s"', (currentPage, expected) => {
    expect(layout(buildPagination(currentPage, 100, hrefFor))).toBe(expected);
  });

  test.each([
    [1, 2, '[1] 2'],
    [2, 2, '1 [2]'],
    [2, 3, '1 [2] 3'],
    [4, 7, '1 2 3 [4] 5 6 7'],
    [4, 8, '1 2 3 [4] 5 … 8'],
    [5, 8, '1 … 4 [5] 6 7 8'],
  ])('lays out page %p of %p as "%s"', (currentPage, totalPages, expected) => {
    expect(layout(buildPagination(currentPage, totalPages, hrefFor))).toBe(expected);
  });

  test('links every numbered page and marks only the current one', () => {
    const pagination = buildPagination(5, 100, hrefFor);

    expect(pagination?.items).toEqual([
      { number: 1, href: '/tasks?page=1', current: false },
      { ellipsis: true },
      { number: 4, href: '/tasks?page=4', current: false },
      { number: 5, href: '/tasks?page=5', current: true },
      { number: 6, href: '/tasks?page=6', current: false },
      { ellipsis: true },
      { number: 100, href: '/tasks?page=100', current: false },
    ]);
  });

  test('links to the previous and next pages', () => {
    const pagination = buildPagination(5, 100, hrefFor);

    expect(pagination).toMatchObject({
      currentPage: 5,
      totalPages: 100,
      previous: { href: '/tasks?page=4' },
      next: { href: '/tasks?page=6' },
    });
  });

  test('has no previous page link on the first page', () => {
    const pagination = buildPagination(1, 3, hrefFor);

    expect(pagination).not.toHaveProperty('previous');
    expect(pagination?.next).toEqual({ href: '/tasks?page=2' });
  });

  test('has no next page link on the last page', () => {
    const pagination = buildPagination(3, 3, hrefFor);

    expect(pagination?.previous).toEqual({ href: '/tasks?page=2' });
    expect(pagination).not.toHaveProperty('next');
  });
});
