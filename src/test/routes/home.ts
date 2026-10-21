import { app } from '../../main/app';

import axios, { AxiosHeaders, type AxiosResponse } from 'axios';
import request from 'supertest';

jest.mock('axios');

interface CaseRecord {
  id?: string | number;
  caseNumber?: string | number;
  title: string;
  description?: string | null;
  status: string;
  createdDate: string;
  dueDateTime?: string | null;
}

interface CasePage {
  content: CaseRecord[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const casesUrl = 'http://localhost:4000/cases';
const mockedAxiosGet = jest.mocked(axios.get);
const mockedAxiosPost = jest.mocked(axios.post);
const mockedAxiosPatch = jest.mocked(axios.patch);
const mockedAxiosDelete = jest.mocked(axios.delete);

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function casePage(content: CaseRecord[], overrides: Partial<CasePage> = {}): CasePage {
  return {
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    ...overrides,
  };
}

function caseRecords(count: number, firstPosition = 1): CaseRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `task-${firstPosition + index}`,
    caseNumber: `CASE-${firstPosition + index}`,
    title: `Task ${firstPosition + index}`,
    status: 'Open',
    createdDate: '2026-10-21',
  }));
}

function paginationNav(html: string): string {
  return html.match(/<nav class="govuk-pagination[\s\S]*?<\/nav>/)?.[0] ?? '';
}

describe('Home page', () => {
  beforeEach(() => {
    mockedAxiosGet.mockReset();
    mockedAxiosPost.mockReset();
    mockedAxiosPatch.mockReset();
    mockedAxiosDelete.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches and displays all cases', async () => {
    const cases: CaseRecord[] = [
      {
        id: 'task-001',
        caseNumber: 'CASE-001',
        title: 'First case',
        description: 'First case description',
        status: 'Open',
        createdDate: '2026-10-20',
        dueDateTime: '2026-11-20T17:00:00Z',
      },
      {
        id: 'task-002',
        caseNumber: 1002,
        title: 'Second case',
        description: 'Second case description',
        status: 'Closed',
        createdDate: '2026-10-21',
      },
    ];
    mockedAxiosGet.mockResolvedValue(axiosResponse(casePage(cases)));

    const response = await request(app).get('/').expect(200);

    expect(mockedAxiosGet).toHaveBeenCalledWith(casesUrl, { params: { page: 0, size: 10 } });
    expect(response.text).toContain('<title>Tasks</title>');
    expect(response.text).toContain('Showing 1 to 2 of 2 tasks');
    expect(response.text).not.toContain('govuk-pagination');
    expect(response.text).toContain('CASE-001');
    expect(response.text).toContain('href="/tasks/task-001"');
    expect(response.text).toContain('First case');
    expect(response.text).toContain('1002');
    expect(response.text).toContain('Second case');
    expect(response.text).toContain('First case description');
    expect(response.text).toContain('Second case description');
    expect(response.text).toContain('Open');
    expect(response.text).toContain('Closed');
    expect(response.text).toContain('2026-10-20');
    expect(response.text).toContain('2026-10-21');
    expect(response.text).toContain('Case number');
    expect(response.text).toContain('Description');
    expect(response.text).toContain('Status');
    expect(response.text).toContain('Created date');
    expect(response.text).toContain('Due date');
    expect(response.text).toContain('Description (optional)');
    expect(response.text).not.toMatch(/<textarea[^>]*\brequired\b/);
    expect(response.text).toMatch(/<input(?=[^>]*name="dueDateTime")(?=[^>]*\brequired\b)[^>]*>/);
    expect(response.text).toContain('2026-11-20T17:00:00Z');
    expect(response.text).toContain('Not set');
    expect(response.text).not.toMatch(/<th[^>]*>\s*ID\s*<\/th>/);
  });

  test('shows an empty state when there are no cases', async () => {
    mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([])));

    const response = await request(app).get('/').expect(200);

    expect(response.text).toContain('There are no tasks to display.');
    expect(response.text).not.toContain('<table');
    expect(response.text).not.toContain('Showing');
    expect(response.text).not.toContain('govuk-pagination');
  });

  test('filters tasks by status through the cases endpoint', async () => {
    mockedAxiosGet.mockResolvedValue(
      axiosResponse(
        casePage([
          {
            id: 'task-closed',
            caseNumber: 'CASE-CLOSED',
            title: 'Closed task',
            description: 'A completed task',
            status: 'Closed',
            createdDate: '2026-10-21',
          },
        ])
      )
    );

    const response = await request(app).get('/?status=Closed').expect(200);

    expect(mockedAxiosGet).toHaveBeenCalledWith(casesUrl, {
      params: { status: 'Closed', page: 0, size: 10 },
    });
    expect(response.text).toContain('Tasks with status: Closed');
    expect(response.text).toMatch(/<option value="Closed" selected>[\s\S]*?Closed\s*<\/option>/);
    expect(response.text).toContain('Closed task');
    expect(response.text).toContain('Showing 1 task');
  });

  test('shows the empty state for a status filter with no matching tasks', async () => {
    mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([])));

    const response = await request(app).get('/?status=Closed').expect(200);

    expect(response.text).toContain('There are no tasks with status "Closed".');
  });

  test('shows an error when the cases endpoint returns an unexpected response', async () => {
    mockedAxiosGet.mockResolvedValue(axiosResponse({ message: 'Unexpected response' }));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app).get('/').expect(502);

    expect(response.text).toContain('Tasks could not be loaded');
    expect(consoleError).toHaveBeenCalledWith(
      'Error loading tasks:',
      expect.objectContaining({ message: 'Cases endpoint returned an unexpected response' })
    );
  });

  test('shows an error when the cases endpoint cannot be reached', async () => {
    const error = new Error('Backend unavailable');
    mockedAxiosGet.mockRejectedValue(error);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app).get('/').expect(502);
    expect(response.text).toContain('Tasks could not be loaded');
    expect(consoleError).toHaveBeenCalledWith('Error loading tasks:', error);
  });

  test.each([
    ['a bare array, as returned before pagination', []],
    ['content that is not an array', { ...casePage([]), content: 'none' }],
    ['no page totals', { content: [], page: 0, size: 10 }],
    ['page totals that are not numbers', { ...casePage([]), totalPages: '1' }],
    ['a negative total', { ...casePage([]), totalElements: -1 }],
    ['no body', null],
  ])('shows an error when the cases endpoint returns %s', async (_description, body) => {
    mockedAxiosGet.mockResolvedValue(axiosResponse(body));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app).get('/').expect(502);

    expect(response.text).toContain('Tasks could not be loaded');
  });

  describe('pagination', () => {
    test('requests the page named in the query string and links to the neighbouring pages', async () => {
      mockedAxiosGet.mockResolvedValue(
        axiosResponse(casePage(caseRecords(10, 21), { page: 2, totalElements: 45, totalPages: 5 }))
      );

      const response = await request(app).get('/?page=3').expect(200);

      expect(mockedAxiosGet).toHaveBeenCalledWith(casesUrl, { params: { page: 2, size: 10 } });
      expect(response.text).toContain('<title>Tasks (page 3 of 5)</title>');
      expect(response.text).toContain('Showing 21 to 30 of 45 tasks');
      expect(response.text).toContain('Task 21');
      expect(response.text).toContain('Task 30');
      const nav = paginationNav(response.text);
      expect(nav).toContain('href="/?page=2" rel="prev"');
      expect(nav).toContain('href="/?page=4" rel="next"');
      expect(nav).toContain('href="/" aria-label="Page 1"');
      expect(nav).toContain('href="/?page=3" aria-label="Page 3" aria-current="page"');
      expect(nav).toContain('href="/?page=5" aria-label="Page 5"');
    });

    test('does not link to a previous page from the first page', async () => {
      mockedAxiosGet.mockResolvedValue(axiosResponse(casePage(caseRecords(10), { totalElements: 25, totalPages: 3 })));

      const response = await request(app).get('/').expect(200);

      expect(response.text).toContain('<title>Tasks (page 1 of 3)</title>');
      expect(response.text).toContain('Showing 1 to 10 of 25 tasks');
      const nav = paginationNav(response.text);
      expect(nav).not.toContain('rel="prev"');
      expect(nav).toContain('href="/?page=2" rel="next"');
    });

    test('does not link to a next page from the last page', async () => {
      mockedAxiosGet.mockResolvedValue(
        axiosResponse(casePage(caseRecords(5, 21), { page: 2, totalElements: 25, totalPages: 3 }))
      );

      const response = await request(app).get('/?page=3').expect(200);

      expect(response.text).toContain('Showing 21 to 25 of 25 tasks');
      const nav = paginationNav(response.text);
      expect(nav).toContain('href="/?page=2" rel="prev"');
      expect(nav).not.toContain('rel="next"');
    });

    test('replaces skipped pages with ellipses', async () => {
      mockedAxiosGet.mockResolvedValue(
        axiosResponse(casePage(caseRecords(10, 91), { page: 9, totalElements: 200, totalPages: 20 }))
      );

      const response = await request(app).get('/?page=10').expect(200);

      const nav = paginationNav(response.text);
      expect(nav.match(/govuk-pagination__item--ellipsis/g)).toHaveLength(2);
      for (const shownPage of [1, 9, 10, 11, 20]) {
        expect(nav).toContain(`aria-label="Page ${shownPage}"`);
      }
      expect(nav).not.toContain('aria-label="Page 5"');
    });

    test('keeps the status filter when moving between pages', async () => {
      mockedAxiosGet.mockResolvedValue(
        axiosResponse(casePage(caseRecords(10, 11), { page: 1, totalElements: 25, totalPages: 3 }))
      );

      const response = await request(app).get('/?status=In-progress&page=2').expect(200);

      expect(mockedAxiosGet).toHaveBeenCalledWith(casesUrl, { params: { status: 'In-progress', page: 1, size: 10 } });
      expect(response.text).toContain('Showing 11 to 20 of 25 tasks');
      const nav = paginationNav(response.text);
      expect(nav).toContain('href="/?status=In-progress" rel="prev"');
      expect(nav).toContain('href="/?status=In-progress&amp;page=3" rel="next"');
    });

    test('encodes the status filter in pagination links', async () => {
      mockedAxiosGet.mockResolvedValue(axiosResponse(casePage(caseRecords(10), { totalElements: 25, totalPages: 3 })));

      const response = await request(app).get('/').query({ status: 'Review & sign-off' }).expect(200);

      expect(paginationNav(response.text)).toContain('href="/?status=Review+%26+sign-off&amp;page=2" rel="next"');
    });

    test.each(['page=abc', 'page=0', 'page=-1', 'page=1.5', 'page=', 'page=2&page=3', 'page=99999999999999999999'])(
      'falls back to the first page for ?%s',
      async query => {
        mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([])));

        await request(app).get(`/?${query}`).expect(200);

        expect(mockedAxiosGet).toHaveBeenCalledWith(casesUrl, { params: { page: 0, size: 10 } });
      }
    );

    test('does not request pages whose row offset the API cannot calculate', async () => {
      mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([])));

      await request(app).get('/?page=214748365');
      expect(mockedAxiosGet).toHaveBeenLastCalledWith(casesUrl, { params: { page: 214748364, size: 10 } });

      await request(app).get('/?page=214748366');
      expect(mockedAxiosGet).toHaveBeenLastCalledWith(casesUrl, { params: { page: 0, size: 10 } });
    });

    test('redirects to the first page of the same results when the page is out of range', async () => {
      mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([], { page: 8, totalElements: 25, totalPages: 3 })));

      const response = await request(app).get('/?status=Closed&page=9').expect(302);

      expect(mockedAxiosGet).toHaveBeenCalledWith(casesUrl, { params: { status: 'Closed', page: 8, size: 10 } });
      expect(response.headers.location).toBe('/?status=Closed');
    });

    test('redirects to the first page when a later page is requested but there are no tasks', async () => {
      mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([], { page: 1 })));

      const response = await request(app).get('/?page=2').expect(302);

      expect(response.headers.location).toBe('/');
    });
  });

  test('retrieves and displays a task by ID', async () => {
    const task: CaseRecord = {
      id: 'task-003',
      caseNumber: 'CASE-003',
      title: 'Task details',
      status: 'Open',
      createdDate: '2026-10-21',
      dueDateTime: '2026-11-21T17:00:00Z',
    };
    mockedAxiosGet.mockResolvedValue(axiosResponse(task));

    const response = await request(app).get('/tasks/task-003').expect(200);

    expect(mockedAxiosGet).toHaveBeenCalledWith('http://localhost:4000/cases/task-003');
    expect(response.text).toContain('Task details');
    expect(response.text).toContain('Not provided');
    expect(response.text).toContain('2026-11-21T17:00:00Z');
    expect(response.text).toContain('<option value="In-progress"');
    expect(response.text).not.toContain('In progress');
    expect(response.text).toContain('action="/tasks/task-003/status"');
    expect(response.text).toContain('action="/tasks/task-003/delete"');
  });

  test('creates a task and redirects to the list', async () => {
    mockedAxiosPost.mockResolvedValue(axiosResponse({}));

    const response = await request(app)
      .post('/tasks')
      .type('form')
      .send({
        caseNumber: 'CASE-004',
        title: 'New task',
        description: 'A newly created task',
        dueDateTime: '2026-12-01T09:30',
      })
      .expect(303);

    expect(mockedAxiosPost).toHaveBeenCalledWith('http://localhost:4000/cases', {
      caseNumber: 'CASE-004',
      title: 'New task',
      description: 'A newly created task',
      status: 'Open',
      dueDateTime: '2026-12-01T09:30',
    });
    expect(response.headers.location).toBe('/?notice=created');
  });

  test('creates a task when the description is omitted', async () => {
    mockedAxiosPost.mockResolvedValue(axiosResponse({}));

    const response = await request(app)
      .post('/tasks')
      .type('form')
      .send({
        caseNumber: 'CASE-005',
        title: 'Task without a description',
        dueDateTime: '2026-12-02T09:30',
      })
      .expect(303);

    expect(mockedAxiosPost).toHaveBeenCalledWith('http://localhost:4000/cases', {
      caseNumber: 'CASE-005',
      title: 'Task without a description',
      status: 'Open',
      dueDateTime: '2026-12-02T09:30',
    });
    expect(response.headers.location).toBe('/?notice=created');
  });

  test('requires a case number, title and due date when creating a task', async () => {
    mockedAxiosGet.mockResolvedValue(axiosResponse(casePage([])));

    const response = await request(app)
      .post('/tasks')
      .type('form')
      .send({ caseNumber: 'CASE-006', title: 'Task without a due date', description: '' })
      .expect(400);

    expect(response.text).toContain('Enter a case number, title and due date.');
    expect(mockedAxiosPost).not.toHaveBeenCalled();
  });

  test('updates a task status through the status endpoint', async () => {
    mockedAxiosPatch.mockResolvedValue(axiosResponse({}));

    const response = await request(app)
      .post('/tasks/task-006/status')
      .type('form')
      .send({ status: 'In-progress' })
      .expect(303);

    expect(mockedAxiosPatch).toHaveBeenCalledWith('http://localhost:4000/cases/task-006/status', {
      status: 'In-progress',
    });
    expect(response.headers.location).toBe('/tasks/task-006?notice=status-updated');
  });

  test('deletes a task and redirects to the list', async () => {
    mockedAxiosDelete.mockResolvedValue(axiosResponse({}));

    const response = await request(app).post('/tasks/task-007/delete').expect(303);

    expect(mockedAxiosDelete).toHaveBeenCalledWith('http://localhost:4000/cases/task-007');
    expect(response.headers.location).toBe('/?notice=deleted');
  });
});
