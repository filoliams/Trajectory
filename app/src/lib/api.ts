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

/** A file the user picked or dropped. On web it's a File; on a phone, a local file address. */
export type PickedFile = { name: string; uri?: string; mimeType?: string; file?: File };

/**
 * Upload a course profile the user downloaded (PDF or saved web page). The
 * backend works out the course from the file and turns away a profile for a
 * different semester.
 */
export function importFromFile(picked: PickedFile, year: number, semester: number): Promise<ImportedCourse> {
  const form = new FormData();
  if (picked.file) {
    form.append('file', picked.file, picked.name);
  } else {
    // React Native's FormData uploads a local file from { uri, name, type }.
    form.append('file', { uri: picked.uri, name: picked.name, type: picked.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }
  form.append('year', String(year));
  form.append('semester', String(semester));
  return send('/import-file', { method: 'POST', body: form });
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

function post(path: string, payload: unknown): Promise<ImportedCourse> {
  return send(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function send(path: string, init: RequestInit): Promise<ImportedCourse> {
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, init);
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
