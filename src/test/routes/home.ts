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
    mockedAxiosGet.mockResolvedValue(axiosResponse(cases));

    const response = await request(app).get('/').expect(200);

    expect(mockedAxiosGet).toHaveBeenCalledWith('http://localhost:4000/cases');
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
    mockedAxiosGet.mockResolvedValue(axiosResponse([]));

    const response = await request(app).get('/').expect(200);

    expect(response.text).toContain('There are no tasks to display.');
    expect(response.text).not.toContain('<table');
  });

  test('filters tasks by status through the cases endpoint', async () => {
    mockedAxiosGet.mockResolvedValue(
      axiosResponse([
        {
          id: 'task-closed',
          caseNumber: 'CASE-CLOSED',
          title: 'Closed task',
          description: 'A completed task',
          status: 'Closed',
          createdDate: '2026-10-21',
        },
      ])
    );

    const response = await request(app).get('/?status=Closed').expect(200);

    expect(mockedAxiosGet).toHaveBeenCalledWith('http://localhost:4000/cases', {
      params: { status: 'Closed' },
    });
    expect(response.text).toContain('Tasks with status: Closed');
    expect(response.text).toMatch(/<option value="Closed" selected>[\s\S]*?Closed\s*<\/option>/);
    expect(response.text).toContain('Closed task');
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
    mockedAxiosGet.mockResolvedValue(axiosResponse([]));

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
