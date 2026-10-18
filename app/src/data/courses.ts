/** App-side shapes for courses and assessments, plus mapping from database rows. */

export type Level = 'weak' | 'okay' | 'strong' | 'none';
export type Status = 'not_started' | 'in_progress' | 'done';
export type AssessmentType = 'exam' | 'assignment' | 'quiz' | 'other';

export type Assessment = {
  id: string;
  courseId: string;
  name: string;
  due: string | null; // ISO date-time
  weight: number; // percent of the course
  status: Status;
  type: AssessmentType;
  hoursLeft: number;
  isExam: boolean;
  isHurdle: boolean;
  needsReview: boolean;
  why?: string;
  note: string | null;
};

export type Topic = {
  id: string;
  courseId: string;
  name: string;
  week: string | null; // e.g. "Week 3", from the course profile
  hasNotes: boolean;
  imported: boolean;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  semester: string;
  assessments: Assessment[];
  topics: Topic[]; // in course order
};

// ---------- database rows ----------

export type AssessmentRow = {
  id: number;
  course_id: number;
  name: string;
  type: string | null;
  weighting: number | null;
  due_date: string | null;
  is_hurdle: boolean | null;
  estimated_hours: number | null;
  status: string | null;
  source: string | null;
  needs_review: boolean | null;
  note: string | null;
};

export type TopicRow = {
  id: number;
  course_id: number;
  name: string;
  week: string | null;
  position: number;
  has_notes: boolean;
  source: string;
};

export type CourseRow = {
  id: number;
  code: string;
  name: string | null;
  semester: string | null;
  profile_url: string | null;
  assessments?: AssessmentRow[];
};

const DEFAULT_HOURS: Record<AssessmentType, number> = { exam: 10, assignment: 6, quiz: 0.75, other: 3 };

function asType(t: string | null): AssessmentType {
  return t === 'exam' || t === 'assignment' || t === 'quiz' ? t : 'other';
}

function asStatus(s: string | null): Status {
  return s === 'in_progress' || s === 'done' ? s : 'not_started';
}

export function assessmentFromRow(r: AssessmentRow): Assessment {
  const type = asType(r.type);
  return {
    id: String(r.id),
    courseId: String(r.course_id),
    name: r.name,
    due: r.due_date,
    weight: Number(r.weighting ?? 0),
    status: asStatus(r.status),
    type,
    hoursLeft: r.estimated_hours != null ? Number(r.estimated_hours) : DEFAULT_HOURS[type],
    isExam: type === 'exam',
    isHurdle: !!r.is_hurdle,
    needsReview: !!r.needs_review,
    note: r.note,
  };
}

export function topicFromRow(r: TopicRow): Topic {
  return {
    id: String(r.id),
    courseId: String(r.course_id),
    name: r.name,
    week: r.week,
    hasNotes: !!r.has_notes,
    imported: r.source === 'imported',
  };
}

export function courseFromRow(r: CourseRow, topics: TopicRow[] = []): Course {
  return {
    id: String(r.id),
    code: r.code,
    name: r.name ?? '',
    semester: r.semester ?? '',
    assessments: (r.assessments ?? []).map(assessmentFromRow),
    topics: topics.filter((t) => t.course_id === r.id).map(topicFromRow),
  };
}
