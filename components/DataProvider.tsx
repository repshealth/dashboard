'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { backend } from '@/lib/backend';
import { latestPublished, pendingVersion } from '@/lib/site/versions';
import { emailsNeedingReps, type EmailCampaign } from '@/lib/emails/types';
import type { Meeting } from '@/lib/meetings/types';
import type { Task } from '@/lib/tasks/types';
import type { Client, Lead, Site, SiteComment, StageId, Viewer, Device, PinAnchor, CommentTarget } from '@/lib/types';

export interface DraftComment {
  pageId: string;
  device?: Device;
  anchor: PinAnchor;
  target?: CommentTarget;
  text: string;
}

interface DataCtx {
  mode: 'demo' | 'live';
  ready: boolean;
  error: string | null;
  viewer: Viewer | null;
  clients: Client[];
  client: Client | null;
  setClientId: (id: string) => void;
  leads: Lead[] | null;
  site: Site | null | undefined;
  moveLead: (leadId: string, stage: StageId) => Promise<void>;
  saveNotes: (leadId: string, notes: string) => Promise<void>;
  addComment: (versionId: string, draft: DraftComment) => Promise<SiteComment>;
  toggleResolved: (versionId: string, commentId: string) => Promise<void>;
  /** Returns how many comments were sent, and whether a revised version is being made. */
  requestChanges: () => Promise<{ open: number; auto: boolean }>;
  approve: () => Promise<void>;
  sendToClient: () => Promise<void>;
  /* Agency */
  allLeads: Lead[] | null;
  allSites: Site[] | null;
  approvalsCount: number;
  /** Every client's launch emails (REPS only), and how many need the team. */
  allCampaigns: EmailCampaign[] | null;
  emailsCount: number;
  /** Every call (REPS only), and how many aren't matched to a client yet. */
  allMeetings: Meeting[] | null;
  meetingsCount: number;
  refreshMeetings: () => Promise<void>;
  /** Every task (REPS only), and how many from calls are waiting for review. */
  allTasks: Task[] | null;
  tasksCount: number;
  refreshTasks: () => Promise<void>;
  refreshAgency: () => Promise<void>;
  approveVersion: (clientId: string, versionId: string) => Promise<void>;
  rejectVersion: (clientId: string, versionId: string, note: string) => Promise<void>;
  toast: (msg: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);
export const useData = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be used inside <DataProvider>');
  return c;
};

const STORE_KEY = 'reps.client';
// Kept in memory too, for browsers where storage is blocked (e.g. the preview link).
let lastClient: string | null = null;
const remember = (id: string) => {
  lastClient = id;
  try { localStorage.setItem(STORE_KEY, id); } catch {}
};
const recall = () => {
  if (lastClient) return lastClient;
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
};
/** Opens this client next time the dashboard loads (used after onboarding). */
export const rememberClient = remember;

/** Sites with something for REPS to do: an amend to approve, or a change request to handle by hand. */
export function countApprovals(sites: Site[] | null) {
  if (!sites) return 0;
  return sites.filter((s) => pendingVersion(s) || (s.status === 'changes' && (latestPublished(s)?.comments.some((c) => !c.resolved) ?? false))).length;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [leadsBy, setLeadsBy] = useState<Record<string, Lead[]>>({});
  const [sitesBy, setSitesBy] = useState<Record<string, Site | null>>({});
  const [allLeads, setAllLeads] = useState<Lead[] | null>(null);
  const [allSites, setAllSites] = useState<Site[] | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<EmailCampaign[] | null>(null);
  const [allMeetings, setAllMeetings] = useState<Meeting[] | null>(null);
  const refreshMeetings = useCallback(async () => { setAllMeetings(await backend.listMeetings()); }, []);
  const [allTasks, setAllTasks] = useState<Task[] | null>(null);
  const refreshTasks = useCallback(async () => { setAllTasks(await backend.listTasks()); }, []);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const refreshAgency = useCallback(async () => {
    const [l, s, e, m, t] = await Promise.all([backend.listAllLeads(), backend.listSites(), backend.listEmailCampaigns(), backend.listMeetings(), backend.listTasks()]);
    setAllMeetings(m);
    setAllTasks(t);
    setAllLeads(l);
    setAllSites(s);
    setAllCampaigns(e);
  }, []);

  // Sign-in check and client list. REPS admins also get the agency data.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await backend.getViewer();
        if (!v) { router.replace('/login'); return; }
        const list = await backend.listClients();
        if (!alive) return;
        setViewer(v);
        setClients(list);
        const saved = recall();
        setClientIdState(list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? null);
        setReady(true);
        if (v.isAdmin) refreshAgency().catch((e) => alive && setError(e.message));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [router, refreshAgency]);

  const reloadSite = useCallback(async (cid: string) => {
    const s = await backend.getSite(cid);
    setSitesBy((m) => ({ ...m, [cid]: s }));
  }, []);

  // Load leads and site for the selected client the first time it is opened.
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!clientId || requested.current.has(clientId)) return;
    requested.current.add(clientId);
    backend.listLeads(clientId)
      .then((l) => setLeadsBy((m) => ({ ...m, [clientId]: l })))
      .catch((e) => setError(e.message));
    reloadSite(clientId).catch((e) => setError(e.message));
  }, [clientId, reloadSite]);

  const setClientId = useCallback((id: string) => { setClientIdState(id); remember(id); }, []);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const leads = clientId ? leadsBy[clientId] ?? null : null;
  const site = clientId ? sitesBy[clientId] : undefined;

  /** Updates a lead everywhere it is shown (its client's board and the agency report). */
  const patchLead = useCallback((cid: string, leadId: string, fn: (l: Lead) => Lead) => {
    setLeadsBy((m) => (m[cid] ? { ...m, [cid]: m[cid].map((l) => (l.id === leadId ? fn(l) : l)) } : m));
    setAllLeads((all) => all && all.map((l) => (l.id === leadId ? fn(l) : l)));
  }, []);
  const patchSite = useCallback((cid: string, fn: (s: Site) => Site) => {
    setSitesBy((m) => (m[cid] ? { ...m, [cid]: fn(m[cid]!) } : m));
    setAllSites((all) => all && all.map((s) => (s.clientId === cid ? fn(s) : s)));
  }, []);

  const actorName = viewer?.isAdmin ? 'REPS team' : viewer?.name || 'You';

  const findLead = useCallback((leadId: string) => {
    for (const list of Object.values(leadsBy)) {
      const l = list.find((x) => x.id === leadId);
      if (l) return l;
    }
    return allLeads?.find((x) => x.id === leadId) ?? null;
  }, [leadsBy, allLeads]);

  const moveLead = useCallback(async (leadId: string, stage: StageId) => {
    const lead = findLead(leadId);
    if (!lead || lead.stage === stage) return;
    const event = await backend.moveLead(lead, stage, actorName);
    patchLead(lead.clientId, leadId, (l) => ({ ...l, stage, events: [event, ...l.events] }));
  }, [findLead, actorName, patchLead]);

  const saveNotes = useCallback(async (leadId: string, notes: string) => {
    const lead = findLead(leadId);
    if (!lead) return;
    await backend.saveNotes(leadId, notes);
    patchLead(lead.clientId, leadId, (l) => ({ ...l, notes }));
    toast('Note saved.');
  }, [findLead, patchLead, toast]);

  const addComment = useCallback(async (versionId: string, d: DraftComment) => {
    if (!clientId) throw new Error('No client selected');
    const saved = await backend.addComment({
      clientId,
      pageId: d.pageId,
      device: d.device,
      anchor: d.anchor,
      target: d.target,
      text: d.text,
      author: viewer?.isAdmin ? 'REPS team' : `${viewer?.name || 'You'}`,
      role: viewer?.isAdmin ? 'agency' : 'client',
      resolved: false,
    });
    patchSite(clientId, (s) => ({
      ...s,
      versions: s.versions.map((v) => (v.id === versionId ? { ...v, comments: [...v.comments, saved] } : v)),
    }));
    toast(viewer?.isAdmin ? 'Comment added.' : 'Comment added. The REPS team has been notified.');
    return saved;
  }, [clientId, viewer, patchSite, toast]);

  const toggleResolved = useCallback(async (versionId: string, commentId: string) => {
    if (!clientId) return;
    const current = sitesBy[clientId]?.versions.find((v) => v.id === versionId)?.comments.find((c) => c.id === commentId);
    if (!current) return;
    await backend.setCommentResolved(clientId, commentId, !current.resolved);
    patchSite(clientId, (s) => ({
      ...s,
      versions: s.versions.map((v) => v.id !== versionId ? v : {
        ...v, comments: v.comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c)),
      }),
    }));
  }, [clientId, sitesBy, patchSite]);

  const requestChanges = useCallback(async () => {
    if (!clientId) return { open: 0, auto: false };
    const latest = latestPublished(sitesBy[clientId]);
    if (!latest || !latest.comments.some((c) => !c.resolved)) return { open: 0, auto: false };
    const r = await backend.requestChanges(clientId, latest.id, actorName);
    await reloadSite(clientId);
    if (viewer?.isAdmin) refreshAgency().catch(() => {});
    return { open: r.open, auto: latest.pages.some((p) => p.kind === 'template') };
  }, [clientId, sitesBy, actorName, viewer, reloadSite, refreshAgency]);

  const approve = useCallback(async () => {
    if (!clientId) return;
    const latest = latestPublished(sitesBy[clientId]);
    if (!latest) return;
    const note = `Approved just now by ${actorName}`;
    await backend.approveSite(clientId, latest.id, actorName);
    patchSite(clientId, (x) => ({
      ...x,
      status: 'approved',
      statusNote: note,
      versions: x.versions.map((v) => (v.id === latest.id ? { ...v, comments: v.comments.map((c) => ({ ...c, resolved: true })) } : v)),
    }));
  }, [clientId, sitesBy, actorName, patchSite]);

  const sendToClient = useCallback(async () => {
    if (!clientId) return;
    await backend.sendSiteToClient(clientId);
    patchSite(clientId, (x) => ({ ...x, status: 'review', statusNote: 'Sent for review just now by REPS team' }));
  }, [clientId, patchSite]);

  const approveVersion = useCallback(async (cid: string, versionId: string) => {
    await backend.approveVersion(cid, versionId);
    await Promise.all([refreshAgency(), sitesBy[cid] !== undefined ? reloadSite(cid) : Promise.resolve()]);
  }, [refreshAgency, reloadSite, sitesBy]);

  const rejectVersion = useCallback(async (cid: string, versionId: string, note: string) => {
    await backend.rejectVersion(cid, versionId, note);
    await Promise.all([refreshAgency(), sitesBy[cid] !== undefined ? reloadSite(cid) : Promise.resolve()]);
  }, [refreshAgency, reloadSite, sitesBy]);

  const signOut = useCallback(async () => {
    await backend.signOut();
    router.replace('/login');
  }, [router]);

  const approvalsCount = countApprovals(allSites);
  const emailsCount = emailsNeedingReps(allCampaigns);
  const meetingsCount = (allMeetings ?? []).filter((m) => !m.clientId).length;
  const tasksCount = (allTasks ?? []).filter((t) => t.status === 'suggested').length;

  const value = useMemo<DataCtx>(() => ({
    mode: backend.mode, ready, error, viewer, clients, client, setClientId, leads, site,
    moveLead, saveNotes, addComment, toggleResolved, requestChanges, approve, sendToClient,
    allLeads, allSites, approvalsCount, allCampaigns, emailsCount, allMeetings, meetingsCount, refreshMeetings, allTasks, tasksCount, refreshTasks, refreshAgency, approveVersion, rejectVersion, toast, signOut,
  }), [allCampaigns, emailsCount, allMeetings, meetingsCount, refreshMeetings, allTasks, tasksCount, refreshTasks, ready, error, viewer, clients, client, setClientId, leads, site, moveLead, saveNotes, addComment, toggleResolved,
    requestChanges, approve, sendToClient, allLeads, allSites, approvalsCount, refreshAgency, approveVersion, rejectVersion, toast, signOut]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={`toast${toastMsg ? ' show' : ''}`} role="status">{toastMsg}</div>
    </Ctx.Provider>
  );
}
