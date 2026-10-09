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

export interface Task {
  id: string;
  clientId: string;
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
  createdAt: string;
  assignedAt?: string;
  doneAt?: string;
  doneBy?: string;
  source: 'meeting' | 'manual';
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'detail' | 'assignee' | 'status' | 'due'>>;

/** A task as found in a call, before it's saved. */
export interface FoundTask { title: string; detail: string; quote: string; suggested: Assignee | null }
