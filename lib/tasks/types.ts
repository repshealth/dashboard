/** Tasks pulled from client calls, reviewed and assigned by the REPS team. */
export type Assignee = 'sam' | 'alyza' | 'james' | 'client' | 'ai';

export const ASSIGNEES: { id: Assignee; label: string }[] = [
  { id: 'sam', label: 'Sam' },
  { id: 'alyza', label: 'Alyza' },
  { id: 'james', label: 'James' },
  { id: 'client', label: 'Client' },
  { id: 'ai', label: 'AI' },
];
export const ASSIGNEE_NAME = Object.fromEntries(ASSIGNEES.map((a) => [a.id, a.label])) as Record<Assignee, string>;

/** suggested = waiting for the team to review. open = assigned. dismissed = not a real task. */
export type TaskStatus = 'suggested' | 'open' | 'done' | 'dismissed';

/** A file attached to a task (brief, photos, contract...). */
export interface TaskFile {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface Task {
  id: string;
  /** Empty when the task is for someone not on the dashboard yet (see clientName). */
  clientId: string;
  /** The client's name, typed in, when they aren't on the dashboard yet. */
  clientName?: string;
  title: string;
  detail?: string;
  /** What was said or written in the call that this task comes from. */
  quote?: string;
  meetingId?: string;
  meetingTitle?: string;
  meetingAt?: string;
  status: TaskStatus;
  assignee: Assignee | null;
  /** Who it looked like it was for, from the notes. Shown as a hint while reviewing. */
  suggested?: Assignee | null;
  due?: string; // YYYY-MM-DD
  /** The day it was assigned, as set by the team. */
  assignedOn?: string; // YYYY-MM-DD
  files?: TaskFile[];
  createdAt: string;
  assignedAt?: string;
  doneAt?: string;
  doneBy?: string;
  source: 'meeting' | 'manual';
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'detail' | 'assignee' | 'status' | 'due' | 'assignedOn' | 'files' | 'clientId' | 'clientName'>>;

/** What the team fills in when adding a task by hand. */
export interface NewTask {
  title: string;
  detail?: string;
  assignee: Assignee | null;
  due?: string;
  assignedOn?: string;
  /** For a client not on the dashboard yet. */
  clientName?: string;
  files?: TaskFile[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Keeps only well-formed files (uploaded through the dashboard), at most 20. */
export const cleanFiles = (files: unknown): TaskFile[] => (Array.isArray(files) ? files : [])
  .filter((f): f is TaskFile => !!f && typeof f === 'object' && typeof (f as TaskFile).url === 'string' && /^(\/api\/files\/tasks\/|data:)/.test((f as TaskFile).url))
  .slice(0, 20)
  .map((f) => ({ name: String(f.name || 'File').slice(0, 160), url: f.url, size: Number(f.size) || undefined, type: f.type ? String(f.type).slice(0, 100) : undefined }));
export const cleanDay = (d: unknown) => (typeof d === 'string' && DAY.test(d) ? d : undefined);

/** A task as found in a call, before it's saved. */
export interface FoundTask { title: string; detail: string; quote: string; suggested: Assignee | null }
