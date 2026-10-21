import axios from 'axios';
import { Application } from 'express';

interface CaseRecord {
  caseNumber: string | number;
  title: string;
  description: string;
  status: string;
  createdDate: string;
  dueDateTime?: string | null;
}

const casesApiUrl = 'http://localhost:4000/cases';

export default function (app: Application): void {
  app.get('/', async (_req, res) => {
    let cases: CaseRecord[];

    try {
      const response = await axios.get<CaseRecord[]>(casesApiUrl);
      if (!Array.isArray(response.data)) {
        throw new TypeError('Cases endpoint returned an unexpected response');
      }
      cases = response.data;
    } catch (error) {
      console.error('Error loading cases:', error);
      res.status(502).render('home', {
        error: 'Cases could not be loaded. Please try again later.',
        caseRows: [],
      });
      return;
    }

    const caseRows = cases.map(caseRecord => [
      { text: String(caseRecord.caseNumber) },
      { text: caseRecord.title },
      { text: caseRecord.description },
      { text: caseRecord.status },
      { text: caseRecord.createdDate },
      { text: caseRecord.dueDateTime ?? 'Not set' },
    ]);

    res.render('home', { caseRows });
  });
}
