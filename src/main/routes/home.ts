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
}

interface TaskPageOptions {
  statusCode?: number;
  error?: string;
  notice?: string;
}

const casesApiUrl = 'http://localhost:4000/cases';
const defaultStatus = 'Open';
const availableStatuses = [defaultStatus, 'In progress', 'Closed'];
const emptyForm: CreateTaskForm = {
  caseNumber: '',
  title: '',
  description: '',
  dueDateTime: '',
};

function formValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
    dueDateDisplay: task.dueDateTime ?? 'Not set',
  };
}

async function getTasks(): Promise<CaseRecord[]> {
  const response = await axios.get<CaseRecord[]>(casesApiUrl);
  if (!Array.isArray(response.data)) {
    throw new TypeError('Cases endpoint returned an unexpected response');
  }
  return response.data;
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
  try {
    const tasks = (await getTasks()).map(toTaskViewModel);
    res.status(options.statusCode ?? 200).render('home', {
      tasks,
      error: options.error,
      notice: options.notice,
      form: options.form ?? emptyForm,
    });
  } catch (error) {
    console.error('Error loading tasks:', error);
    res.status(502).render('home', {
      tasks: [],
      error: options.error
        ? `${options.error} The task list could not be loaded. Please try again later.`
        : 'Tasks could not be loaded. Please try again later.',
      form: options.form ?? emptyForm,
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
      statusOptions: [...new Set([...availableStatuses, task.status])],
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
    await renderHome(res, { notice: listNotice(req.query.notice) });
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

    const payload: CreateTaskPayload = {
      caseNumber: form.caseNumber,
      title: form.title,
      status: defaultStatus,
      dueDateTime: form.dueDateTime,
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
