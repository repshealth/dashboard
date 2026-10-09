'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../DataProvider';
import { EmailPreview, SequenceNav } from './parts';
import { useCampaign } from './useCampaign';
import { backend } from '@/lib/backend';
import { SITE_STATUS } from '@/lib/constants';
import { fmtWhen } from '@/lib/format';
import { fmtLaunch } from '@/lib/emails/schedule';
import { siteHref } from '@/lib/emails/html';
import { fieldLabel, pendingEmailVersion, publishedEmailVersions, type EmailComment, type EmailField, type EmailListId } from '@/lib/emails/types';
import type { Device } from '@/lib/types';

const STATUS = {
  ...SITE_STATUS,
  approved: { label: 'Approved', cls: 'st-approved' },
};

/** The client's launch emails: read them, comment on any line, request changes or approve. */
export default function EmailsView() {
  const { client, viewer, toast, refreshAgency } = useData();
  const { campaign, reload } = useCampaign(client?.id);
  const [vi, setVi] = useState(0);
  const [list, setList] = useState<EmailListId>('prereg');
  const [emailId, setEmailId] = useState('prereg-1');
  const [device, setDevice] = useState<Device>('desktop');
  const [cmode, setCmode] = useState(false);
  const [draft, setDraft] = useState<{ field: EmailField; quote: string; text: string } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setVi(0); setList('prereg'); setEmailId('prereg-1'); setCmode(false); setDraft(null); setPick(null); }, [client?.id]);
  useEffect(() => { if (draft) textRef.current?.focus(); }, [draft]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCmode(false); setDraft(null); setModal(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const versions = publishedEmailVersions(campaign);
  const version = versions[Math.min(vi, Math.max(versions.length - 1, 0))];
  const email = version?.emails.find((e) => e.id === emailId) ?? version?.emails[0];
  const comments: EmailComment[] = useMemo(() => (version && email ? version.comments.filter((c) => c.emailId === email.id) : []), [version, email]);
  const number = new Map(comments.map((c, i) => [c.id, i + 1]));

  if (!client) return <div className="loading">No clients on this account yet.</div>;
  if (campaign === undefined) return <div className="loading">Loading emails…</div>;

  const admin = Boolean(viewer?.isAdmin);
  const isDraft = campaign?.status === 'draft';
  const actor = admin ? 'REPS team' : viewer?.name || 'You';

  const head = (actions: 'send' | 'review' | null) => (
    <header>
      <div>
        <h1>Emails</h1>
        <p className="sub">Your launch emails: 6 for people who pre-registered and 6 for your email list</p>
      </div>
      {actions === 'send' && (
        <div className="actions">
          <button type="button" className="btn gold" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await backend.sendEmailsToClient(client.id); await reload(); refreshAgency().catch(() => {}); toast(`Sent to ${campaign?.contact || client.name} to review.`); }
            catch (e) { toast(e instanceof Error ? e.message : 'Could not send. Please try again.'); }
            finally { setBusy(false); }
          }}>Send to client</button>
        </div>
      )}
      {actions === 'review' && (
        <div className="actions">
          <button type="button" className="btn" disabled={busy} onClick={async () => {
            if (!version) return;
            const open = version.comments.filter((c) => !c.resolved).length;
            if (!open) { toast('Add a comment first so we know what to change.'); return; }
            setBusy(true);
            try {
              await backend.requestEmailChanges(client.id, version.id, actor);
              await reload();
              if (admin) refreshAgency().catch(() => {});
              toast(`Sent ${open} comment${open === 1 ? '' : 's'}. Your updated emails will be ready to review soon.`);
            } catch (e) { toast(e instanceof Error ? e.message : 'Could not send. Please try again.'); }
            finally { setBusy(false); }
          }}>Request changes</button>
          <button type="button" className="btn gold" disabled={busy} onClick={() => setModal(true)}>Approve emails</button>
        </div>
      )}
    </header>
  );

  if (!campaign || !version || !email || (isDraft && !admin)) {
    return (
      <div className="view">
        {head(null)}
        <div className="sv-empty">
          <span className={`stbadge ${SITE_STATUS.building.cls}`}>{SITE_STATUS.building.label}</span>
          <div className="sv-et">{campaign ? 'Your launch emails are being written' : `No launch emails for ${client.name} yet`}</div>
          <p>{campaign
            ? "The REPS team is checking them over. You'll get an email as soon as they're ready to review here."
            : admin ? 'Launch emails are written when a client submits the onboarding form.' : 'The REPS team will add them here as soon as they are ready.'}</p>
        </div>
      </div>
    );
  }

  const old = vi > 0;
  const waiting = campaign.status === 'changes';
  const approved = campaign.status === 'approved';
  const locked = approved || old;
  const pending = pendingEmailVersion(campaign);
  const st = old ? { label: 'Earlier version', cls: 'st-build' } : STATUS[campaign.status];
  const openAll = version.comments.filter((c) => !c.resolved).length;
  const ml = campaign.mailerlite;

  const post = async () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) { textRef.current?.focus(); return; }
    setBusy(true);
    try {
      const saved = await backend.addEmailComment({
        clientId: client.id, versionId: version.id, emailId: email.id, field: draft.field, quote: draft.quote,
        author: actor, role: admin ? 'agency' : 'client', text, resolved: false,
      });
      await reload();
      setDraft(null);
      setPick(saved.id);
      toast(admin ? 'Comment added.' : 'Comment added. The REPS team has been notified.');
    } catch { toast('Could not save that comment. Please try again.'); }
    finally { setBusy(false); }
  };

  const toggle = async (c: EmailComment) => {
    await backend.setEmailCommentResolved(client.id, c.id, !c.resolved);
    await reload();
  };

  return (
    <div className="view">
      {head(isDraft ? 'send' : !locked && !waiting ? 'review' : null)}

      <SequenceNav campaign={campaign} emails={version.emails} list={list} setList={setList} emailId={email.id}
        setEmailId={(id) => { setEmailId(id); setDraft(null); setPick(null); }}
        openCount={(id) => version.comments.filter((c) => c.emailId === id && !c.resolved).length} />

      <div className="sv-bar">
        <div className="em-info">
          <span><b>Launch</b> {campaign.launchDate ? fmtLaunch(campaign.launchDate) : 'date to be set'}</span>
          <span><b>Website</b> {campaign.websiteUrl ? siteHref(campaign.websiteUrl).replace(/^https?:\/\//, '') : 'to be added'}</span>
          {list === 'prereg' && campaign.offer && <span><b>Offer</b> {campaign.offer}{campaign.discountCode ? ` · ${campaign.discountCode}` : ''}</span>}
          {list === 'public' && <span><b>Offer</b> Full price</span>}
        </div>
        <div className="sv-tools">
          {versions.length > 1 && (
            <label className="vsel">
              <span className="sr">Version</span>
              <select value={vi} onChange={(e) => { setVi(+e.target.value); setDraft(null); setPick(null); setCmode(false); }}>
                {versions.map((v, i) => <option key={v.id} value={i}>{v.label}{i === 0 ? ' (latest)' : ''}</option>)}
              </select>
            </label>
          )}
          <div className="seg" role="group" aria-label="Device">
            {(['desktop', 'mobile'] as Device[]).map((d) => (
              <button key={d} type="button" className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>{d === 'desktop' ? 'Desktop' : 'Mobile'}</button>
            ))}
          </div>
          {!locked && (
            <button type="button" className={`btn${cmode ? ' gold' : ''}`} onClick={() => { setCmode(!cmode); setDraft(null); }}>
              {cmode ? 'Click any line of the email' : '+ Add comment'}
            </button>
          )}
        </div>
      </div>

      <div className="work">
        <div className="sv-stage em-stage">
          <EmailPreview campaign={campaign} email={email} device={device} mode={cmode ? 'comment' : 'view'}
            comments={comments} number={number} pick={pick} onPick={(id) => setPick(pick === id ? null : id)}
            draftField={draft?.field}
            onTarget={(field, quote) => { setDraft({ field, quote, text: '' }); setCmode(false); setPick(null); }} />
        </div>

        <aside className="detail sv-side" aria-label="Review">
          <span className={`stbadge ${st.cls}`}>{st.label}</span>
          <div className="sv-ver">Version {version.version} · {old ? version.sentNote : campaign.statusNote || version.sentNote}</div>
          {isDraft && !old && (
            <div className="sv-lock sv-draft">Written from {campaign.contact || client.name}&apos;s onboarding form. Only the REPS team can see these. Check them over, edit them in <Link href="/agency/emails" className="sv-inline-link">Agency · Emails</Link>, then press <b>Send to client</b>.</div>
          )}
          {waiting && !old && (admin ? (
            <div className="sv-lock sv-draft">
              {pending ? <>A revised version ({pending.version}) has been made from these comments and is waiting for your approval.</> : <>Changes requested.</>}
              {' '}<Link href="/agency/emails" className="sv-inline-link">Open Agency · Emails</Link>
            </div>
          ) : (
            <div className="sv-lock sv-wait">Thanks, your changes are with the REPS team. You&apos;ll get an email when the updated version is ready to review.</div>
          ))}
          {approved && !old && (
            <div className={`sv-lock${ml.state === 'scheduled' ? '' : ' sv-draft'}`}>
              {ml.state === 'scheduled'
                ? <>Approved. All 12 emails are scheduled in MailerLite and will send on the dates shown.</>
                : admin ? <>Approved by the client. {ml.note}</> : <>Approved. The REPS team is scheduling your emails now.</>}
            </div>
          )}
          {old && <div className="sv-lock old">You&apos;re viewing an earlier version. Switch to the latest version to comment or approve.</div>}

          <div className="lbl">COMMENTS ON THIS EMAIL</div>
          <div className="sv-open">{openAll} open across all 12 emails</div>

          {draft && (
            <div className="composer">
              <div className="cm-h"><span className="pin sm draft">{comments.length + 1}</span><b>On the {fieldLabel(draft.field)}</b></div>
              <div className="em-quote">{draft.quote || 'Empty'}</div>
              <textarea ref={textRef} rows={3} placeholder='What would you like changed? Put exact new wording in "quotes".' value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(); }} />
              <div className="cp-a">
                <button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button>
                <button type="button" className="btn gold" disabled={busy} onClick={post}>{busy ? 'Posting…' : 'Post'}</button>
              </div>
            </div>
          )}

          <div className="cms">
            {comments.length ? comments.map((c) => (
              <div key={c.id} className={`cm${c.resolved ? ' done' : ''}${pick === c.id ? ' on' : ''}`} role="button" tabIndex={0}
                onClick={() => setPick(pick === c.id ? null : c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick(pick === c.id ? null : c.id); } }}>
                <div className="cm-h">
                  <span className={`pin sm${c.resolved ? ' done' : ''}`}>{number.get(c.id)}</span>
                  <b>{c.author}</b>
                  <span className="devtag">{fieldLabel(c.field)}</span>
                  <span className="cm-t">{fmtWhen(c.createdAt)}</span>
                </div>
                <div className="cm-b">{c.text}</div>
                {!locked && (
                  <button type="button" className="cm-r" onClick={(e) => { e.stopPropagation(); toggle(c); }}>{c.resolved ? 'Reopen' : 'Resolve'}</button>
                )}
              </div>
            )) : (
              <div className="cm-none">No comments on this email{locked ? '' : <>. Click <b>Add comment</b>, then click the line you want changed.</>}</div>
            )}
          </div>
        </aside>
      </div>

      {modal && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="approve-emails-title">
            <div id="approve-emails-title" className="m-t">Approve all 12 emails?</div>
            <p>
              You&apos;re signing off version {version.version} of your launch emails: 6 to your pre-registration list and 6 to your email list.
              {openAll ? ` There ${openAll === 1 ? 'is' : 'are'} still ${openAll} open comment${openAll === 1 ? '' : 's'}, these will be closed.` : ''}
              {' '}They&apos;ll be scheduled in MailerLite to send from {campaign.launchDate ? fmtLaunch(campaign.launchDate) : 'your launch date'} onwards (the warm-ups go out the week before).
            </p>
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button type="button" className="btn gold" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  const r = await backend.approveEmails(client.id, version.id, actor);
                  await reload();
                  if (admin) refreshAgency().catch(() => {});
                  setModal(false);
                  toast(r.state === 'scheduled' ? 'Approved and scheduled. Nice one!' : 'Approved. The REPS team will finish scheduling them.');
                } catch (e) { toast(e instanceof Error ? e.message : 'Could not save the approval. Please try again.'); }
                finally { setBusy(false); }
              }}>Approve and schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
