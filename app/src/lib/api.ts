import { API_URL } from '@/config';
import type { AssessmentType } from '@/data/courses';

export type ImportedAssessment = {
  name: string;
  weight: number;
  due: string | null;
  type: AssessmentType;
  is_hurdle: boolean;
  needs_review: boolean;
  note: string | null;
  raw_due_text: string;
};

export type ImportedCourse = {
  code: string;
  title: string | null;
  profile_url: string;
  semester_start: string | null;
  semester_end: string | null;
  assessments: ImportedAssessment[];
};

/** Ask the backend to read a UQ course profile. Throws an Error with a readable message. */
export function importCourse(code: string, year: number, semester: number, profileUrl?: string): Promise<ImportedCourse> {
  return post('/import-course', { code, year, semester, profile_url: profileUrl || null });
}

/** Ask the backend to read an assessment table the user copied and pasted. */
export function importFromText(code: string, text: string): Promise<ImportedCourse> {
  return post('/import-text', { code, text });
}

/** Send a course profile page the user opened in the app to the backend to read. */
export function importFromPage(code: string, url: string, html: string): Promise<ImportedCourse> {
  return post('/import-html', { code, url, html });
}

/** UQ term codes, as used in course profile links: 2026 Semester 1 = 7620, Semester 2 = 7660. */
export function termCode(year: number, semester: number): string {
  return `${year - 1950}${semester === 1 ? '20' : '60'}`;
}

/** Matches a course profile address and captures the course code and term code. */
export const PROFILE_LINK = /^https?:\/\/course-profiles\.uq\.edu\.au\/course-profiles\/([A-Z]{4}\d{4})-\d+-(\d{4})/;

/** The page listing a course's offerings, with links to each course profile. */
export function courseInfoUrl(code: string): string {
  return `https://programs-courses.uq.edu.au/course.html?course_code=${encodeURIComponent(code)}`;
}

async function post(path: string, payload: unknown): Promise<ImportedCourse> {
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      `Couldn't reach the Trajectory backend at ${API_URL}. Make sure it's running with --host 0.0.0.0.`,
    );
  }
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : `Import failed (${resp.status}).`;
    throw new Error(detail);
  }
  return body as ImportedCourse;
}
