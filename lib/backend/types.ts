import type { SiteDesign } from '../site/spec';
import type { LaunchDoc, LaunchSetup, OnboardingAnswers } from '../site/onboarding';
import type { Client, Lead, LeadEvent, Site, SiteComment, SiteSource, SiteVersion, StageId, Viewer } from '../types';
import type { EmailCampaign, EmailComment, LaunchEmail, MailerLitePublic, MailerLiteSettings, MailerLiteState } from '../emails/types';
import type { Meeting, VoiceProfile } from '../meetings/types';
import type { Assignee, Task, TaskPatch } from '../tasks/types';

/** One onboarding form as submitted. */
export interface Submission {
  id: string;
  clientId: string | null;
  submittedAt: string; // ISO date
  answers: OnboardingAnswers;
}

export type NewComment = Omit<SiteComment, 'id' | 'createdAt'> & { clientId: string };
export type NewEmailComment = Omit<EmailComment, 'id' | 'createdAt'> & { clientId: string; versionId: string };
export type LaunchSettings = Pick<EmailCampaign, 'launchDate' | 'websiteUrl' | 'discountCode'>;

/**
 * Everything the dashboard reads or writes goes through this interface.
 * `demo` serves the built-in example data; `live` calls the server, which keeps everything in Cloudflare D1.
 */
export interface LoginInfo {
  id: string;
  name: string;
  email: string;
  /** REPS agency login: every client account. */
  isAdmin: boolean;
  clientIds: string[];
  hasPassword: boolean;
  createdAt: string;
  lastSignIn?: string;
}
export interface LoginInput { id?: string; name: string; email: string; password?: string; clientIds: string[] }

export interface Backend {
  mode: 'demo' | 'live';
  /** Returns null when nobody is signed in (live mode only). Sign-in itself goes through /api/auth. */
  getViewer(): Promise<Viewer | null>;
  /** Email and password sign-in. Live mode sets the session cookie through /api/auth/login. */
  signIn(email: string, password: string): Promise<Viewer>;
  signOut(): Promise<void>;
  /** Admin: everyone who can sign in, and which client accounts they can open. */
  listLogins(): Promise<LoginInfo[]>;
  /** Admin: adds or updates a login. A password is needed for a new login; for an existing one it resets it. */
  saveLogin(x: LoginInput): Promise<LoginInfo>;
  removeLogin(id: string): Promise<void>;
  listClients(): Promise<Client[]>;
  listLeads(clientId: string): Promise<Lead[]>;
  moveLead(lead: Lead, stage: StageId, by: string): Promise<LeadEvent>;
  saveNotes(leadId: string, notes: string): Promise<void>;
  getSite(clientId: string): Promise<Site | null>;
  addComment(c: NewComment): Promise<SiteComment>;
  setCommentResolved(clientId: string, commentId: string, resolved: boolean): Promise<void>;
  /** The client approves the design: every open comment on it is closed. */
  approveSite(clientId: string, versionId: string, by: string): Promise<void>;
  /** Creates the client account and a draft website from onboarding answers. */
  submitOnboarding(answers: OnboardingAnswers): Promise<{ clientId: string; slug: string; copyBy: 'claude' | 'template' }>;
  /** Moves a draft site to review and sends the client their login. */
  sendSiteToClient(clientId: string): Promise<void>;

  /* Agency (REPS admins) */
  /** Every lead across every client. */
  listAllLeads(): Promise<Lead[]>;
  /** Every client's website, including amended versions waiting for approval. */
  listSites(): Promise<Site[]>;
  /**
   * Client asks for changes. Marks the site, and for generated sites makes a revised version
   * from the open comments, waiting for REPS approval.
   */
  requestChanges(clientId: string, versionId: string, by: string): Promise<{ open: number; pending: SiteVersion | null }>;
  /** REPS connects the website to the GitHub repo it's saved to from Claude. Empty repo disconnects. */
  saveSiteSource(clientId: string, src: Pick<SiteSource, 'repo' | 'branch' | 'autoPublish'>): Promise<void>;
  /** REPS checks GitHub for a newer version now (pushes also arrive on their own). */
  syncSite(clientId: string): Promise<{ added: boolean; note: string }>;
  /** Admin: redraw a generated site in another design. Drafts change in place; otherwise a pending version. */
  setSiteDesign(clientId: string, design: Exclude<SiteDesign, 'shapeup'>): Promise<{ pending: boolean; file?: boolean }>;
  /** REPS approves a revised version: the client can now see it and approve it. */
  approveVersion(clientId: string, versionId: string): Promise<void>;
  /** REPS discards a revised version; the request stays open for the team to handle. */
  rejectVersion(clientId: string, versionId: string, note: string): Promise<void>;
  /**
   * Admin: closes change requests on the client's current version as done or declined. When none
   * are left open, the site goes back to the client to review and drops out of Approvals.
   */
  closeComments(clientId: string, commentIds: string[], outcome: 'done' | 'declined', note?: string): Promise<{ open: number }>;
  /** Launch setups saved by the team (one per client). */
  listLaunchSetups(): Promise<LaunchDoc[]>;
  getLaunchSetup(clientId: string): Promise<LaunchDoc | null>;
  /** Saves the launch setup. With build, also updates the website, makes the pre-reg page and writes the emails. */
  saveLaunchSetup(clientId: string, setup: LaunchSetup, build: boolean): Promise<{ built: boolean; notes: string[] }>;
  /** Every onboarding form submitted, newest first. */
  listSubmissions(): Promise<Submission[]>;

  /* Launch emails */
  getEmails(clientId: string): Promise<EmailCampaign | null>;
  /** Every client's launch emails, including revised versions waiting for approval (REPS). */
  listEmailCampaigns(): Promise<EmailCampaign[]>;
  addEmailComment(c: NewEmailComment): Promise<EmailComment>;
  setEmailCommentResolved(clientId: string, commentId: string, resolved: boolean): Promise<void>;
  /** REPS sends the draft emails to the client to review. */
  sendEmailsToClient(clientId: string): Promise<void>;
  /** Client asks for changes: a revised version is made from the comments for REPS to approve. */
  requestEmailChanges(clientId: string, versionId: string, by: string): Promise<{ open: number; pending: boolean }>;
  /** Client approves: the emails are created and scheduled in MailerLite. */
  approveEmails(clientId: string, versionId: string, by: string): Promise<MailerLiteState>;
  /** REPS retries scheduling in MailerLite, e.g. once MailerLite is connected. */
  scheduleEmails(clientId: string): Promise<MailerLiteState>;
  /** REPS approves a revised version, so the client sees it. */
  approveEmailVersion(clientId: string, versionId: string): Promise<void>;
  rejectEmailVersion(clientId: string, versionId: string, note: string): Promise<void>;
  /** REPS edits the emails by hand. */
  saveEmailEdits(clientId: string, emails: LaunchEmail[]): Promise<void>;
  /** REPS changes the launch date, website link or code. Send times move with the launch date. */
  saveLaunchSettings(clientId: string, s: LaunchSettings): Promise<void>;
  /** A client's MailerLite details (REPS only). The API key itself is never returned. */
  getMailerLite(clientId: string): Promise<MailerLitePublic | null>;
  /** Leave apiKey empty to keep the saved key. */
  saveMailerLite(clientId: string, s: MailerLiteSettings): Promise<void>;
  /** REPS asks Claude to rewrite all 12 emails in the client's voice (from their calls). */
  rewriteEmails(clientId: string): Promise<void>;

  /* Meetings (Google Meet calls) */
  /** A client's calls (clients only get the ones not hidden), or every call when no client is given (REPS). */
  listMeetings(clientId?: string): Promise<Meeting[]>;
  /** REPS pastes in a transcript or Gemini notes by hand. */
  addMeeting(m: { clientId: string | null; title: string; date: string; text: string }): Promise<Meeting>;
  updateMeeting(id: string, patch: { clientId?: string | null; visibleToClient?: boolean }): Promise<void>;
  deleteMeeting(id: string): Promise<void>;
  getVoice(clientId: string): Promise<VoiceProfile | null>;
  /** Rebuilds the client's voice profile from all their calls. */
  refreshVoice(clientId: string): Promise<VoiceProfile>;
  saveVoice(v: VoiceProfile): Promise<void>;

  /* Tasks from calls */
  /** Every task (REPS), or one client's. Clients only get the tasks assigned to them. */
  listTasks(clientId?: string): Promise<Task[]>;
  addTask(clientId: string, t: { title: string; detail?: string; assignee: Assignee | null; due?: string }): Promise<Task>;
  /** REPS can change anything; a client can only tick their own tasks done or not done. */
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  /** Pulls tasks from a call again (e.g. one added before tasks existed). Returns how many were found. */
  findTasks(meetingId: string): Promise<number>;
}
