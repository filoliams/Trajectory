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

export type ImportedTopic = { name: string; week: string | null };

export type ImportedCourse = {
  code: string;
  title: string | null;
  profile_url: string;
  semester_start: string | null;
  semester_end: string | null;
  assessments: ImportedAssessment[];
  topics?: ImportedTopic[];
};

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
