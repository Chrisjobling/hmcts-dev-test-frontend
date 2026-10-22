import { buildPagination, parsePageNumber } from '../modules/pagination';

import axios from 'axios';
import type { Application, Response } from 'express';

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

interface CreateTaskForm {
  caseNumber: string;
  title: string;
  description: string;
  dueDateTime: string;
}

interface CreateTaskPayload {
  caseNumber: string;
  title: string;
  description?: string;
  status: string;
  dueDateTime: string;
}

interface HomeOptions {
  statusCode?: number;
  error?: string;
  notice?: string;
  form?: CreateTaskForm;
  statusFilter?: string;
  page?: number;
}

interface TaskPageOptions {
  statusCode?: number;
  error?: string;
  notice?: string;
}

const casesApiUrl = 'http://localhost:4000/cases';
const pageSize = 10;
// The API returns a 500 once the row offset (page * size) no longer fits in a 32-bit integer
const maxPageNumber = Math.floor((2 ** 31 - 1) / pageSize) + 1;
const defaultStatus = 'Open';
const availableStatuses = [defaultStatus, 'In-progress', 'Closed'];
const emptyForm: CreateTaskForm = {
  caseNumber: '',
  title: '',
  description: '',
  dueDateTime: '',
};

function formValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function statusOptionsFor(selectedStatus = ''): string[] {
  return [...new Set([...availableStatuses, ...(selectedStatus ? [selectedStatus] : [])])];
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTime(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date).replace(' at ', ', ');
}

function toTaskViewModel(task: CaseRecord) {
  const identifier = task.id ?? task.caseNumber;
  if (identifier === undefined || identifier === null || String(identifier).trim() === '') {
    throw new TypeError('Task response did not include an identifier');
  }

  return {
    ...task,
    urlId: encodeURIComponent(String(identifier)),
    caseNumberDisplay: String(task.caseNumber ?? identifier),
    descriptionDisplay: task.description?.trim() || 'Not provided',
    createdDateDisplay: formatDateTime(task.createdDate) ?? 'Not set',
    dueDateDisplay: formatDateTime(task.dueDateTime) ?? 'Not set',
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isCasePage(data: unknown): data is CasePage {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  const { content, page, size, totalElements, totalPages } = data as Record<string, unknown>;
  return Array.isArray(content) && [page, size, totalElements, totalPages].every(isCount);
}

async function getTasks(statusFilter: string, pageNumber: number): Promise<CasePage> {
  const response = await axios.get<unknown>(casesApiUrl, {
    params: {
      ...(statusFilter ? { status: statusFilter } : {}),
      // The API's pages are zero-based, whereas the page numbers shown to users start at 1
      page: pageNumber - 1,
      size: pageSize,
    },
  });
  if (!isCasePage(response.data)) {
    throw new TypeError('Cases endpoint returned an unexpected response');
  }
  return response.data;
}

function listUrl(statusFilter: string, pageNumber = 1): string {
  const params = new URLSearchParams();
  if (statusFilter) {
    params.set('status', statusFilter);
  }
  if (pageNumber > 1) {
    params.set('page', String(pageNumber));
  }
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

function summariseTasks({ page, size, totalElements }: CasePage, shown: number): string {
  if (totalElements === 1) {
    return 'Showing 1 task';
  }
  const first = page * size + 1;
  return `Showing ${first} to ${first + shown - 1} of ${totalElements} tasks`;
}

async function getTask(id: string): Promise<CaseRecord> {
  const response = await axios.get<CaseRecord>(`${casesApiUrl}/${encodeURIComponent(id)}`);
  if (response.data === null || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new TypeError('Case endpoint returned an unexpected response');
  }
  return response.data;
}

function listNotice(value: unknown): string | undefined {
  if (value === 'created') {
    return 'Task created.';
  }
  if (value === 'deleted') {
    return 'Task deleted.';
  }
  return undefined;
}

function taskNotice(value: unknown): string | undefined {
  return value === 'status-updated' ? 'Task status updated.' : undefined;
}

async function renderHome(res: Response, options: HomeOptions = {}): Promise<void> {
  const statusFilter = options.statusFilter ?? '';
  const pageNumber = options.page ?? 1;
  try {
    const casePage = await getTasks(statusFilter, pageNumber);
    if (pageNumber > 1 && casePage.content.length === 0) {
      // The page no longer exists (or never did), so send the user back to the first page of the same results
      res.redirect(302, listUrl(statusFilter));
      return;
    }

    const tasks = casePage.content.map(toTaskViewModel);
    res.status(options.statusCode ?? 200).render('home', {
      tasks,
      taskSummary: tasks.length ? summariseTasks(casePage, tasks.length) : undefined,
      pagination: buildPagination(casePage.page + 1, casePage.totalPages, targetPage =>
        listUrl(statusFilter, targetPage)
      ),
      error: options.error,
      notice: options.notice,
      form: options.form ?? emptyForm,
      statusFilter,
      statusOptions: statusOptionsFor(statusFilter),
    });
  } catch (error) {
    console.error('Error loading tasks:', error);
    res.status(502).render('home', {
      tasks: [],
      error: options.error
        ? `${options.error} The task list could not be loaded. Please try again later.`
        : 'Tasks could not be loaded. Please try again later.',
      form: options.form ?? emptyForm,
      statusFilter,
      statusOptions: statusOptionsFor(statusFilter),
    });
  }
}

async function renderTaskPage(res: Response, id: string, options: TaskPageOptions = {}): Promise<void> {
  try {
    const task = toTaskViewModel(await getTask(id));
    res.status(options.statusCode ?? 200).render('task', {
      task,
      error: options.error,
      notice: options.notice,
      statusOptions: statusOptionsFor(task.status),
    });
  } catch (error) {
    console.error('Error loading task:', error);
    res.status(502).render('task', {
      error: options.error
        ? `${options.error} Task details could not be loaded. Please try again later.`
        : 'Task could not be loaded. Please try again later.',
    });
  }
}

export default function (app: Application): void {
  app.get('/', async (req, res) => {
    await renderHome(res, {
      notice: listNotice(req.query.notice),
      statusFilter: formValue(req.query.status),
      page: parsePageNumber(req.query.page, maxPageNumber),
    });
  });

  app.post('/tasks', async (req, res) => {
    const form: CreateTaskForm = {
      caseNumber: formValue(req.body?.caseNumber),
      title: formValue(req.body?.title),
      description: formValue(req.body?.description),
      dueDateTime: formValue(req.body?.dueDateTime),
    };

    if (!form.caseNumber || !form.title || !form.dueDateTime) {
      await renderHome(res, {
        statusCode: 400,
        error: 'Enter a case number, title and due date.',
        form,
      });
      return;
    }

    const date = new Date(form.dueDateTime);
    const isoDate = date.toISOString();

    const payload: CreateTaskPayload = {
      caseNumber: form.caseNumber,
      title: form.title,
      status: defaultStatus,
      dueDateTime: isoDate,
      ...(form.description ? { description: form.description } : {}),
    };

    try {
      await axios.post(casesApiUrl, payload);
      res.redirect(303, '/?notice=created');
    } catch (error) {
      console.error('Error creating task:', error);
      await renderHome(res, {
        statusCode: 502,
        error: 'Task could not be created. Please try again.',
        form,
      });
    }
  });

  app.get('/tasks/:id', async (req, res) => {
    await renderTaskPage(res, req.params.id, {
      notice: taskNotice(req.query.notice),
    });
  });

  app.post('/tasks/:id/status', async (req, res) => {
    const id = req.params.id;
    const status = formValue(req.body?.status);
    if (!status) {
      await renderTaskPage(res, id, {
        statusCode: 400,
        error: 'Select a status for this task.',
      });
      return;
    }

    try {
      await axios.patch(`${casesApiUrl}/${encodeURIComponent(id)}/status`, { status });
      res.redirect(303, `/tasks/${encodeURIComponent(id)}?notice=status-updated`);
    } catch (error) {
      console.error('Error updating task status:', error);
      await renderTaskPage(res, id, {
        statusCode: 502,
        error: 'Task status could not be updated. Please try again.',
      });
    }
  });

  app.post('/tasks/:id/delete', async (req, res) => {
    const id = req.params.id;

    try {
      await axios.delete(`${casesApiUrl}/${encodeURIComponent(id)}`);
      res.redirect(303, '/?notice=deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
      await renderTaskPage(res, id, {
        statusCode: 502,
        error: 'Task could not be deleted. Please try again.',
      });
    }
  });
}
