'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import { EmailPreview, SequenceNav } from '../emails/parts';
import { VoiceCard } from '../meetings/parts';
import { useCampaign } from '../emails/useCampaign';
import { backend } from '@/lib/backend';
import { SITE_STATUS } from '@/lib/constants';
import { fmtLaunch, fmtSend, sendAt } from '@/lib/emails/schedule';
import { flattenEmails } from '@/lib/emails/amend';
import {
  fieldLabel, latestEmailVersion, pendingEmailVersion,
  type EmailCampaign, type EmailListId, type LaunchEmail,
} from '@/lib/emails/types';
import type { Device } from '@/lib/types';
import type { MailerLiteSettings } from '@/lib/emails/types';

const ML_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Scheduled', cls: 'st-approved' },
  not_scheduled: { label: 'Not yet', cls: 'st-build' },
  not_connected: { label: 'Not connected', cls: 'st-changes' },
  failed: { label: 'Needs a retry', cls: 'st-changes' },
};

const daysTo = (date: string) => {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Math.ceil((new Date(+m[1], +m[2] - 1, +m[3]).getTime() - Date.now()) / 864e5);
};

/** What the REPS team needs to do next with a client's emails. */
function nextStep(c: EmailCampaign) {
  if (pendingEmailVersion(c)) return 'Approve revised version';
  if (c.status === 'draft') return 'Check and send to client';
  if (c.status === 'changes') return 'Make the requested changes';
  if (c.status === 'approved' && c.mailerlite.state !== 'scheduled') return 'Finish scheduling';
  if (c.status === 'review') return 'With the client';
  return 'Done';
}

/** The next email still to send, across both lists. */
function nextSend(c: EmailCampaign) {
  const v = latestEmailVersion(c);
  if (!v || !c.launchDate) return null;
  const now = new Date().toISOString().slice(0, 16);
  return v.emails.map((e) => ({ e, at: sendAt(c.launchDate, e.offset, e.time) })).filter((x) => x.at > now).sort((a, b) => (a.at < b.at ? -1 : 1))[0] ?? null;
}

export default function AgencyEmails() {
  const router = useRouter();
  const { viewer, clients, allCampaigns, allLeads, refreshAgency, setClientId } = useData();
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  if (!viewer?.isAdmin) return null;

  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client';
  const signups = (id: string) => (allLeads ?? []).filter((l) => l.clientId === id && l.source === 'prereg').length;
  const rows = (allCampaigns ?? []).slice().sort((a, b) => {
    const w = (c: EmailCampaign) => (['Done', 'With the client'].includes(nextStep(c)) ? 1 : 0);
    return w(a) - w(b) || name(a.clientId).localeCompare(name(b.clientId));
  });
  const without = clients.filter((c) => !(allCampaigns ?? []).some((x) => x.clientId === c.id));

  if (sel) return <CampaignDetail clientId={sel} name={name(sel)} onBack={() => { setSel(null); refreshAgency().catch(() => {}); }} />;

  const scheduled = rows.filter((c) => c.mailerlite.state === 'scheduled').length;
  const needs = rows.filter((c) => !['Done', 'With the client'].includes(nextStep(c))).length;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Emails</h1>
          <p className="sub">Every client&apos;s launch emails: check them, make amends, approve revisions and track MailerLite scheduling</p>
        </div>
      </header>

      <div className="kpis">
        <div className="kpi"><div className="l">CLIENTS WITH LAUNCH EMAILS</div><div className="v">{rows.length}</div></div>
        <div className="kpi"><div className="l">NEED THE TEAM</div><div className="v">{needs}</div></div>
        <div className="kpi"><div className="l">SCHEDULED IN MAILERLITE</div><div className="v">{scheduled}</div></div>
        <div className="kpi"><div className="l">PRE-REG SIGN-UPS</div><div className="v">{rows.reduce((s, c) => s + signups(c.clientId), 0)}</div></div>
      </div>

      {allCampaigns === null ? <div className="loading">Loading emails…</div> : (
        <section className="list ag-clients ae-table" aria-label="Launch emails by client">
          <table>
            <thead>
              <tr><th>CLIENT</th><th>STATUS</th><th>LAUNCH</th><th>PRE-REG SIGN-UPS</th><th>NEXT EMAIL</th><th>MAILERLITE</th><th>NEXT STEP</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = SITE_STATUS[c.status];
                const d = daysTo(c.launchDate);
                const nx = nextSend(c);
                const ml = ML_BADGE[c.mailerlite.state] ?? ML_BADGE.not_scheduled;
                const step = nextStep(c);
                return (
                  <tr key={c.clientId} className="row">
                    <td><button type="button" className="namebtn" onClick={() => setSel(c.clientId)}>{name(c.clientId)}</button></td>
                    <td><span className={`stbadge sm ${st.cls}`}>{st.label}</span></td>
                    <td>{c.launchDate ? <>{fmtLaunch(c.launchDate)}<span className="ae-dim">{d === null ? '' : d > 0 ? ` · in ${d} day${d === 1 ? '' : 's'}` : d === 0 ? ' · today' : ' · launched'}</span></> : 'Not set'}</td>
                    <td className="num">{signups(c.clientId)}</td>
                    <td>{nx ? <>{fmtSend(nx.at)}<span className="ae-dim"> · {nx.e.list === 'prereg' ? 'Pre-reg' : 'General'} {nx.e.n}</span></> : '–'}</td>
                    <td><span className={`stbadge sm ${ml.cls}`}>{ml.label}</span></td>
                    <td><button type="button" className={`btn${['Done', 'With the client'].includes(step) ? '' : ' gold'} btn-sm`} onClick={() => setSel(c.clientId)}>{step === 'Done' || step === 'With the client' ? 'Open' : step}</button></td>
                  </tr>
                );
              })}
              {without.map((c) => (
                <tr key={c.id} className="row ae-none">
                  <td>{c.name}</td>
                  <td colSpan={5}><span className="ae-dim">No launch emails. They&apos;re written when the onboarding form is submitted.</span></td>
                  <td><button type="button" className="ob-link" onClick={() => { setClientId(c.id); router.push('/leads'); }}>Leads</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {!rows.length && allCampaigns !== null && <p className="ap-hint">Submit the onboarding form to see a client&apos;s launch emails appear here.</p>}
    </div>
  );
}

/** One client's emails: approve a revision, edit any email, change launch settings, schedule. */
function CampaignDetail({ clientId, name, onBack }: { clientId: string; name: string; onBack: () => void }) {
  const router = useRouter();
  const { toast, setClientId, refreshAgency } = useData();
  const { campaign, reload } = useCampaign(clientId);
  const [list, setList] = useState<EmailListId>('prereg');
  const [emailId, setEmailId] = useState('prereg-1');
  const [device, setDevice] = useState<Device>('desktop');
  const [showing, setShowing] = useState<'new' | 'old'>('new');
  const [editing, setEditing] = useState<LaunchEmail[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [settings, setSettings] = useState<{ launchDate: string; websiteUrl: string; discountCode: string } | null>(null);

  useEffect(() => {
    if (campaign) setSettings({ launchDate: campaign.launchDate, websiteUrl: campaign.websiteUrl, discountCode: campaign.discountCode });
  }, [campaign]);

  const pending = pendingEmailVersion(campaign);
  const latest = latestEmailVersion(campaign);
  const base = pending ? campaign?.versions.find((v) => v.id === pending.basedOn) ?? latest : latest;
  const shown = editing ? null : showing === 'new' && pending ? pending : base;
  const emails = editing ?? shown?.emails ?? [];
  const email = emails.find((e) => e.id === emailId) ?? emails[0];

  // Which fields of which emails changed in the revised version.
  const changed = useMemo(() => {
    const out = new Map<string, Set<string>>();
    for (const ch of pending?.changes ?? []) {
      const [id, ...rest] = ch.path.split('.');
      if (!out.has(id)) out.set(id, new Set());
      out.get(id)!.add(rest.join('.'));
    }
    return out;
  }, [pending]);

  if (campaign === undefined) return <div className="loading">Loading emails…</div>;
  if (!campaign || !base || !email) return <div className="view"><button type="button" className="ob-link" onClick={onBack}>← All clients</button><p>No launch emails for {name}.</p></div>;

  const comments = base.comments;
  const commentFor = (id?: string) => comments.find((c) => c.id === id);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); await reload(); refreshAgency().catch(() => {}); toast(done); }
    catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const editTarget = pending ? `the revised ${pending.version}` : campaign.status === 'draft' ? 'the draft' : 'a new version for you to approve';
  const dirty = editing && JSON.stringify(flattenEmails(editing)) !== JSON.stringify(flattenEmails((pending ?? base).emails));
  const st = SITE_STATUS[campaign.status];
  const ml = campaign.mailerlite;

  return (
    <div className="view">
      <button type="button" className="ob-link ae-back" onClick={onBack}>← All clients</button>

      <div className="ap-head">
        <div>
          <div className="ap-eyebrow">{name} · launch emails</div>
          <h2>{campaign.launchDate ? `Launching ${fmtLaunch(campaign.launchDate)}` : 'Launch date not set'}</h2>
          <p className="sub"><span className={`stbadge sm ${st.cls}`}>{st.label}</span> {campaign.statusNote}</p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => { setClientId(clientId); router.push('/emails'); }}>See client view</button>
          {campaign.status === 'draft' && !editing && (
            <button type="button" className="btn gold" disabled={busy} onClick={() => run(() => backend.sendEmailsToClient(clientId), `Sent to ${campaign.contact || name} to review.`)}>Send to client</button>
          )}
        </div>
      </div>

      {pending && !editing && (
        <div className="ap-head ae-pending">
          <div>
            <div className="ap-eyebrow">Waiting for you</div>
            <h2>{pending.version} {pending.amendedBy === 'reps' ? 'with your edits' : `made from ${campaign.contact || 'the client'}'s comments`}</h2>
            <p className="sub">{pending.summary} {pending.amendedBy === 'rules' ? 'Made with simple rules (Claude isn’t connected in this preview).' : pending.amendedBy === 'claude' ? 'Made by Claude.' : ''}</p>
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={() => setRejecting(!rejecting)}>Reject</button>
            <button type="button" className="btn gold" disabled={busy} onClick={() => run(() => backend.approveEmailVersion(clientId, pending.id), `${pending.version} sent to ${campaign.contact || name} to review.`)}>Approve and send to client</button>
          </div>
          {rejecting && (
            <div className="ap-reject ae-reject">
              <label htmlFor="ae-reject-note" className="ob-label">Message the client sees (optional)</label>
              <textarea id="ae-reject-note" rows={2} placeholder="e.g. We're rewriting these by hand and will send them tomorrow." value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="cp-a">
                <button type="button" className="btn" onClick={() => setRejecting(false)}>Cancel</button>
                <button type="button" className="btn gold" disabled={busy} onClick={() => run(async () => { await backend.rejectEmailVersion(clientId, pending.id, note.trim()); setRejecting(false); }, `${pending.version} discarded. The comments stay open.`)}>Discard this version</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ae-grid">
        <div className="ae-main">
          <SequenceNav campaign={campaign} emails={emails} list={list} setList={setList} emailId={email.id} setEmailId={setEmailId}
            openCount={(id) => comments.filter((c) => c.emailId === id && !c.resolved).length}
            changed={pending && showing === 'new' && !editing ? new Set(changed.keys()) : undefined} />
          <div className="sv-bar">
            <div className="sv-tools">
              {pending && !editing && (
                <div className="seg" role="group" aria-label="Which version">
                  <button type="button" className={showing === 'new' ? 'on' : ''} onClick={() => setShowing('new')}>Revised {pending.version}</button>
                  <button type="button" className={showing === 'old' ? 'on' : ''} onClick={() => setShowing('old')}>Current {base.version}</button>
                </div>
              )}
              <div className="seg" role="group" aria-label="Device">
                {(['desktop', 'mobile'] as Device[]).map((d) => (
                  <button key={d} type="button" className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>{d === 'desktop' ? 'Desktop' : 'Mobile'}</button>
                ))}
              </div>
            </div>
            <div className="sv-tools">
              {editing ? (
                <>
                  <button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                  <button type="button" className="btn gold" disabled={busy || !dirty} onClick={() => run(async () => {
                    await backend.saveEmailEdits(clientId, editing.map((e) => ({ ...e, body: e.body.map((p) => p.trim()).filter(Boolean) })));
                    setEditing(null);
                    setShowing('new');
                  }, campaign.status === 'draft' ? 'Draft updated.' : 'Saved. Approve it to send it to the client.')}>Save changes</button>
                </>
              ) : campaign.status !== 'approved' && (
                <button type="button" className="btn" onClick={() => { setEditing(JSON.parse(JSON.stringify((pending ?? base).emails))); setShowing('new'); }}>Edit emails</button>
              )}
            </div>
          </div>
          {editing && <p className="ap-hint ae-hint">Editing {editTarget}. Changes are saved across all 12 emails when you press Save changes.</p>}
          <div className="sv-stage em-stage">
            <EmailPreview campaign={campaign} email={email} device={device} mode={editing ? 'edit' : 'view'}
              comments={comments.filter((c) => c.emailId === email.id)} number={new Map(comments.filter((c) => c.emailId === email.id).map((c, i) => [c.id, i + 1]))}
              highlight={pending && showing === 'new' && !editing ? changed.get(email.id) : undefined}
              onChange={(next) => setEditing((all) => all && all.map((e) => (e.id === next.id ? next : e)))} />
          </div>
        </div>

        <aside className="ae-side">
          {pending && !editing && (
            <div className="detail ap-changes ae-card">
              <div className="lbl" style={{ marginTop: 0 }}>WHAT CHANGED ({pending.changes?.length ?? 0})</div>
              {!(pending.changes?.length) && <p className="cm-none">No text was changed automatically.</p>}
              {(pending.changes ?? []).map((ch, i) => {
                const cm = commentFor(ch.commentId);
                return (
                  <button key={i} type="button" className="chg-item ae-chg" onClick={() => { const id = ch.path.split('.')[0]; setList(id.startsWith('prereg') ? 'prereg' : 'public'); setEmailId(id); setShowing('new'); }}>
                    <div className="chg-label">{ch.label}</div>
                    <div className="chg-before">{ch.before}</div>
                    <div className="chg-after">{ch.after}</div>
                    {cm && <div className="chg-why"><b>{cm.author}:</b> {cm.text}</div>}
                  </button>
                );
              })}
              {(pending.unresolved?.length ?? 0) > 0 && (
                <>
                  <div className="lbl">NEEDS YOU ({pending.unresolved!.length})</div>
                  {pending.unresolved!.map((u) => {
                    const cm = commentFor(u.commentId);
                    return (
                      <div key={u.commentId} className="chg-item chg-need">
                        {cm && <div className="chg-label">{cm.emailId.startsWith('prereg') ? 'Pre-reg list' : 'General list'} · Email {cm.emailId.split('-')[1]} {fieldLabel(cm.field)}</div>}
                        <div className="chg-why"><b>{cm?.author ?? 'Client'}:</b> {u.text}</div>
                        <div className="chg-reason">{u.reason} Use <b>Edit emails</b> to make it, then approve.</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {!pending && comments.some((c) => !c.resolved) && (
            <div className="detail ae-card">
              <div className="lbl" style={{ marginTop: 0 }}>OPEN COMMENTS ({comments.filter((c) => !c.resolved).length})</div>
              {comments.filter((c) => !c.resolved).map((c) => (
                <button key={c.id} type="button" className="chg-item ae-chg" onClick={() => { setList(c.emailId.startsWith('prereg') ? 'prereg' : 'public'); setEmailId(c.emailId); }}>
                  <div className="chg-label">{c.emailId.startsWith('prereg') ? 'Pre-reg list' : 'General list'} · Email {c.emailId.split('-')[1]} {fieldLabel(c.field)}</div>
                  {c.quote && <div className="chg-before chg-ctx">{c.quote}</div>}
                  <div className="chg-why"><b>{c.author}:</b> {c.text}</div>
                </button>
              ))}
            </div>
          )}

          <VoiceCard clientId={clientId} name={campaign.contact || name} compact rewriteBusy={busy}
            onRewrite={campaign.status === 'approved' ? undefined : () => run(() => backend.rewriteEmails(clientId), 'Rewritten in their voice. Check the new version, then approve it.')} />

          {settings && (
            <form className="detail ae-card" onSubmit={(e) => { e.preventDefault(); run(() => backend.saveLaunchSettings(clientId, settings), 'Launch settings saved. Send dates moved with the launch date.'); }}>
              <div className="lbl" style={{ marginTop: 0 }}>LAUNCH SETTINGS</div>
              <label className="ae-f"><span>Launch date</span><input className="ob-input" type="date" required value={settings.launchDate} onChange={(e) => setSettings({ ...settings, launchDate: e.target.value })} /></label>
              <label className="ae-f"><span>Website link in the emails</span><input className="ob-input" placeholder="e.g. strongwithdani.co.uk" value={settings.websiteUrl} onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })} /></label>
              <label className="ae-f"><span>Discount code (pre-reg list only)</span><input className="ob-input" value={settings.discountCode} onChange={(e) => setSettings({ ...settings, discountCode: e.target.value.toUpperCase() })} /></label>
              <p className="ap-hint">Launch offer from the form: {campaign.offer || 'none'}, open {campaign.offerDays} days.</p>
              <button type="submit" className="btn" disabled={busy || campaign.mailerlite.state === 'scheduled'}>Save settings</button>
              {campaign.mailerlite.state === 'scheduled' && <p className="ap-hint">Already scheduled in MailerLite. Change dates there, or cancel the campaigns first.</p>}
            </form>
          )}

          <div className="detail ae-card">
            <div className="lbl" style={{ marginTop: 0 }}>MAILERLITE</div>
            <div className="ae-ml"><span className={`stbadge sm ${(ML_BADGE[ml.state] ?? ML_BADGE.not_scheduled).cls}`}>{(ML_BADGE[ml.state] ?? ML_BADGE.not_scheduled).label}</span><span>{ml.note || 'Scheduled once the client approves.'}</span></div>
            {campaign.status === 'approved' && ml.state !== 'scheduled' && (
              <button type="button" className="btn gold" disabled={busy} onClick={() => run(() => backend.scheduleEmails(clientId), 'Scheduling done.')}>Schedule in MailerLite</button>
            )}
            <p className="ap-hint">On approval, each email becomes a MailerLite campaign scheduled for its send time: the pre-reg emails to the pre-registration group, the others to the general list.</p>
            <MailerLiteForm clientId={clientId} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** The client's MailerLite account: key, sender and groups. The saved key is never shown again. */
function MailerLiteForm({ clientId }: { clientId: string }) {
  const { toast } = useData();
  const [open, setOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [f, setF] = useState<MailerLiteSettings>({ apiKey: '', fromEmail: '', fromName: '', preregGroupId: '', publicGroupId: '', publicSegmentId: '', useHtml: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    backend.getMailerLite(clientId).then((s) => {
      if (!s) return;
      const { hasKey: k, ...rest } = s;
      setHasKey(k);
      setF({ ...rest, apiKey: '' });
    }).catch(() => {});
  }, [clientId]);
  const field = (k: keyof MailerLiteSettings, label: string, hint?: string, type = 'text') => (
    <label className="ae-f"><span>{label}</span>
      <input className="ob-input" type={type} value={String(f[k] ?? '')} placeholder={hint} autoComplete="off" onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  if (!open) {
    return <button type="button" className="btn" onClick={() => setOpen(true)}>{hasKey ? 'MailerLite details' : 'Connect MailerLite'}</button>;
  }
  return (
    <form className="mt-vedit" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await backend.saveMailerLite(clientId, f); setHasKey(hasKey || Boolean(f.apiKey)); setF({ ...f, apiKey: '' }); setOpen(false); toast('MailerLite details saved.'); }
      catch (x) { toast(x instanceof Error ? x.message : 'Could not save.'); }
      finally { setBusy(false); }
    }}>
      {field('apiKey', 'API key', hasKey ? 'Saved. Paste a new one to replace it.' : 'From MailerLite: Integrations, API', 'password')}
      {field('fromEmail', 'From email', 'Must be verified in their MailerLite')}
      {field('fromName', 'From name', 'e.g. Dani at Strong With Dani')}
      {field('preregGroupId', 'Pre-registration group ID')}
      {field('publicGroupId', 'General list group ID')}
      {field('publicSegmentId', 'General list minus pre-reg (segment ID)', 'Optional, recommended')}
      <label className="ae-check"><input type="checkbox" checked={f.useHtml} onChange={(e) => setF({ ...f, useHtml: e.target.checked })} /> Send our email design (needs MailerLite’s Advanced plan)</label>
      <div className="cp-a"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn gold" disabled={busy}>Save</button></div>
    </form>
  );
}
