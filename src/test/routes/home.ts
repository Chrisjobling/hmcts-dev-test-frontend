import { app } from '../../main/app';

import axios, { AxiosHeaders, type AxiosResponse } from 'axios';
import request from 'supertest';

jest.mock('axios');

interface CaseRecord {
  caseNumber: string | number;
  title: string;
  description: string;
  status: string;
  createdDate: string;
  dueDateTime?: string | null;
}

const mockedAxiosGet = jest.mocked(axios.get);

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches and displays all cases', async () => {
    const cases: CaseRecord[] = [
      {
        caseNumber: 'CASE-001',
        title: 'First case',
        description: 'First case description',
        status: 'Open',
        createdDate: '2026-10-20',
        dueDateTime: '2026-11-20T17:00:00Z',
      },
      {
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
    expect(response.text).toContain('2026-11-20T17:00:00Z');
    expect(response.text).toContain('Not set');
    expect(response.text).not.toMatch(/<th[^>]*>\s*ID\s*<\/th>/);
  });

  test('shows an empty state when there are no cases', async () => {
    mockedAxiosGet.mockResolvedValue(axiosResponse([]));

    const response = await request(app).get('/').expect(200);

    expect(response.text).toContain('There are no cases to display.');
    expect(response.text).not.toContain('<table');
  });

  test('shows an error when the cases endpoint returns an unexpected response', async () => {
    mockedAxiosGet.mockResolvedValue(axiosResponse({ message: 'Unexpected response' }));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app).get('/').expect(502);

    expect(response.text).toContain('Cases could not be loaded');
    expect(consoleError).toHaveBeenCalledWith(
      'Error loading cases:',
      expect.objectContaining({ message: 'Cases endpoint returned an unexpected response' })
    );
  });

  test('shows an error when the cases endpoint cannot be reached', async () => {
    const error = new Error('Backend unavailable');
    mockedAxiosGet.mockRejectedValue(error);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app).get('/').expect(502);
    expect(response.text).toContain('Cases could not be loaded');
    expect(consoleError).toHaveBeenCalledWith('Error loading cases:', error);
    expect(consoleError).toHaveBeenCalledWith('Error loading cases:', error);
  });
});
