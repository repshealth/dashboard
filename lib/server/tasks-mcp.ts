import type { Backend } from '../backend/types';
import type { Client } from '../types';
import { ASSIGNEES, ASSIGNEE_NAME, type Assignee, type Task, type TaskPatch, type TaskStatus } from '../tasks/types';

/**
 * The Tasks connector: a small MCP server (Streamable HTTP, JSON replies, no sessions) that lets
 * Claude add, list and update tasks on the dashboard. Added in claude.ai as a custom connector.
 * Every call runs through the normal backend as the REPS team, so the usual checks apply.
 * Clients are read straight from the store (listClients on the backend also seeds and syncs).
 * The route (app/api/mcp/[key]) checks the key before anything here runs.
 */

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const ASSIGNEE_IDS = ASSIGNEES.map((a) => a.id);
const TZ = 'Europe/London';

/** Today in London, YYYY-MM-DD. */
export const londonToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const DAY = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' };
const WHO = { type: 'string', enum: ASSIGNEE_IDS, description: 'sam, alyza, james, client or ai' };

const TOOLS = [
  {
    name: 'list_clients',
    title: 'List dashboard clients',
    description: 'Lists the clients on the REPS dashboard, plus today\'s date in London. Use the exact name when adding a task.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_task',
    title: 'Add a task',
    description:
      'Adds a task to the REPS dashboard (Agency · Tasks). With an assignee it goes straight to Open; without one it goes to To review. ' +
      'The client is matched to a dashboard client by name (a unique partial match like "Gabby" works). If they are not on the dashboard, set new_client to true to save it under the typed name (only the REPS team sees those). ' +
      'Tasks assigned to client show on that client\'s own Tasks page. Files can only be attached in the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'The client\'s name' },
        title: { type: 'string', description: 'The task, a short action. Max 300 characters.' },
        description: { type: 'string', description: 'Details, links, context. Optional.' },
        assignee: WHO,
        due: { ...DAY, description: 'Due date, YYYY-MM-DD. Optional. Not before the assigned date.' },
        assigned_on: { ...DAY, description: 'Assigned date, YYYY-MM-DD. Defaults to today.' },
        new_client: { type: 'boolean', description: 'True to save the task under a name that is not on the dashboard yet.' },
      },
      required: ['client', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
    title: 'List tasks',
    description: 'Lists tasks on the dashboard, newest first. Filter by client, assignee and status. Use it to check for duplicates or find a task id to update.',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Client name (optional)' },
        assignee: WHO,
        status: { type: 'string', enum: ['suggested', 'open', 'done', 'dismissed', 'all'], description: 'suggested = To review. Defaults to open and suggested.' },
        limit: { type: 'number', description: 'Max tasks to return (default 30, max 100)' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'update_task',
    title: 'Update a task',
    description: 'Changes a task by id (from list_tasks): reword it, reassign it, change dates, or mark it done, open again or dismissed. Only the fields given are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        assignee: WHO,
        due: { ...DAY, description: 'YYYY-MM-DD, or an empty string to clear it' },
        assigned_on: DAY,
        status: { type: 'string', enum: ['open', 'done', 'dismissed'] },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

class ToolError extends Error {}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** A dashboard client by name or slug: exact first, then a unique partial match. */
function findClient(clients: Client[], name: string): { client?: Client; options?: Client[] } {
  const n = norm(name);
  const exact = clients.find((c) => norm(c.name) === n || c.slug === n);
  if (exact) return { client: exact };
  const part = clients.filter((c) => norm(c.name).includes(n) || n.includes(norm(c.name)));
  if (part.length === 1) return { client: part[0] };
  return { options: part };
}

const day = (v: unknown, field: string) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ToolError(`${field} must be a date like 2026-11-30.`);
  return v;
};
const who = (v: unknown): Assignee | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const a = String(v).trim().toLowerCase() as Assignee;
  if (!ASSIGNEE_IDS.includes(a)) throw new ToolError(`assignee must be one of: ${ASSIGNEE_IDS.join(', ')}.`);
  return a;
};
const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

const STATUS_NAME: Record<TaskStatus, string> = { suggested: 'To review', open: 'Open', done: 'Done', dismissed: 'Dismissed' };

function describe(t: Task, clients: Client[]) {
  const client = t.clientId ? clients.find((c) => c.id === t.clientId)?.name ?? t.clientId : `${t.clientName ?? '?'} (not on the dashboard)`;
  return {
    id: t.id,
    client,
    title: t.title,
    description: t.detail ?? '',
    assignee: t.assignee ? ASSIGNEE_NAME[t.assignee] : null,
    status: STATUS_NAME[t.status],
    assigned_on: t.assignedOn ?? null,
    due: t.due ?? null,
    files: (t.files ?? []).map((f) => f.name),
    from_call: t.meetingTitle ?? null,
    done_by: t.doneBy ?? null,
  };
}

async function callTool(backend: Backend, name: string, args: Record<string, unknown>, listClients: () => Promise<Client[]>) {
  const clients = (await listClients()).sort((a, b) => a.name.localeCompare(b.name));
  const today = londonToday();

  if (name === 'list_clients') {
    return { today, clients: clients.map((c) => c.name) };
  }

  if (name === 'add_task') {
    const title = str(args.title).trim();
    const clientName = str(args.client).trim();
    if (!clientName) throw new ToolError('Say which client the task is for.');
    if (!title) throw new ToolError('The task needs a title.');
    const assignee = who(args.assignee) ?? null;
    const assignedOn = day(args.assigned_on, 'assigned_on') ?? today;
    const due = day(args.due, 'due');
    if (due && due < assignedOn) throw new ToolError(`The due date (${due}) is before the assigned date (${assignedOn}).`);

    const found = findClient(clients, clientName);
    let clientId = '';
    let typedName = '';
    if (found.client) clientId = found.client.id;
    else if (args.new_client === true) typedName = clientName;
    else if (found.options?.length) throw new ToolError(`"${clientName}" matches more than one client: ${found.options.map((c) => c.name).join(', ')}. Say which one.`);
    else throw new ToolError(`"${clientName}" isn't on the dashboard. Clients: ${clients.map((c) => c.name).join(', ') || 'none yet'}. If it's someone new, call again with new_client: true.`);

    const t = await backend.addTask(clientId, { title, detail: str(args.description).trim() || undefined, assignee, due, assignedOn, clientName: typedName || undefined });
    const notes: string[] = [];
    if (!assignee) notes.push('No assignee, so it is in To review.');
    if (typedName) notes.push('Saved under a name that is not on the dashboard, so only the REPS team sees it.');
    if (typedName && assignee === 'client') notes.push('The client has no dashboard account yet, so they will not see it until they are added.');
    return { added: describe(t, clients), notes };
  }

  if (name === 'list_tasks') {
    let tasks = await backend.listTasks();
    if (args.client) {
      const f = findClient(clients, str(args.client));
      const n = norm(str(args.client));
      tasks = tasks.filter((t) => (f.client ? t.clientId === f.client.id : !t.clientId && norm(t.clientName ?? '').includes(n)));
    }
    const a = who(args.assignee);
    if (a) tasks = tasks.filter((t) => t.assignee === a);
    const s = str(args.status) || 'active';
    if (s === 'active') tasks = tasks.filter((t) => t.status === 'open' || t.status === 'suggested');
    else if (s !== 'all') tasks = tasks.filter((t) => t.status === s);
    const limit = Math.min(100, Math.max(1, Number(args.limit) || 30));
    tasks.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    return { today, total: tasks.length, tasks: tasks.slice(0, limit).map((t) => describe(t, clients)) };
  }

  if (name === 'update_task') {
    const id = str(args.id).trim();
    if (!id) throw new ToolError('Give the task id (from list_tasks).');
    const patch: TaskPatch = {};
    if (args.title !== undefined) patch.title = str(args.title);
    if (args.description !== undefined) patch.detail = str(args.description);
    const a = who(args.assignee);
    if (a) patch.assignee = a;
    if (args.due !== undefined) patch.due = day(args.due, 'due') ?? '';
    if (args.assigned_on !== undefined) patch.assignedOn = day(args.assigned_on, 'assigned_on');
    if (args.status !== undefined) {
      const st = str(args.status) as TaskStatus;
      if (!['open', 'done', 'dismissed'].includes(st)) throw new ToolError('status must be open, done or dismissed.');
      patch.status = st;
    }
    if (!Object.keys(patch).length) throw new ToolError('Nothing to change.');
    await backend.updateTask(id, patch);
    const t = (await backend.listTasks()).find((x) => x.id === id);
    return { updated: t ? describe(t, clients) : { id } };
  }

  throw new ToolError(`Unknown tool: ${name}`);
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const reply = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message. Returns null for notifications (nothing to send back). */
export async function handleMcp(backend: Backend, msg: Rpc, listClients: () => Promise<Client[]> = () => backend.listClients()) {
  if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid request');
  const isNotification = msg.id === undefined;
  const p = msg.params ?? {};

  switch (msg.method) {
    case 'initialize': {
      const asked = String(p.protocolVersion ?? '');
      return reply(msg.id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'reps-tasks', title: 'REPS Tasks', version: '1.0.0' },
        instructions: 'Adds and manages tasks on the REPS dashboard. Team: Sam, Alyza, James; or assign to the client or AI. Dates are YYYY-MM-DD, London time.',
      });
    }
    case 'ping':
      return isNotification ? null : reply(msg.id, {});
    case 'tools/list':
      return reply(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(p.name ?? '');
      const args = (p.arguments && typeof p.arguments === 'object' ? p.arguments : {}) as Record<string, unknown>;
      try {
        const out = await callTool(backend, name, args, listClients);
        return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out, isError: false });
      } catch (e) {
        // Validation and access errors go back to Claude so it can fix the call.
        const text = e instanceof Error && (e instanceof ToolError || e.name === 'AccessError' || 'status' in e) ? e.message : 'Something went wrong on the dashboard. Try again.';
        if (!(e instanceof ToolError)) console.error('Tasks connector:', e);
        return reply(msg.id, { content: [{ type: 'text', text }], isError: true });
      }
    }
    default:
      if (isNotification) return null;
      return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
