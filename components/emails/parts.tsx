'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Device } from '@/lib/types';
import { EMAIL_LISTS, type EmailCampaign, type EmailComment, type EmailField, type EmailListId, type LaunchEmail } from '@/lib/emails/types';
import { fmtSend, offsetLabel, sendAt } from '@/lib/emails/schedule';
import { showsCode, siteHref } from '@/lib/emails/html';

const FONT: Record<string, string> = {
  bold: "'Oswald', 'Arial Narrow', sans-serif",
  modern: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  elegant: "'DM Serif Display', Georgia, serif",
};

export type EmailMode = 'view' | 'comment' | 'edit';

/** List tabs plus the six emails of the chosen list, in send order. */
export function SequenceNav({ campaign, emails, list, setList, emailId, setEmailId, openCount, changed }: {
  campaign: EmailCampaign;
  emails: LaunchEmail[];
  list: EmailListId;
  setList: (l: EmailListId) => void;
  emailId: string;
  setEmailId: (id: string) => void;
  /** Open comments per email id. */
  openCount?: (id: string) => number;
  /** Email ids that changed in a revised version. */
  changed?: Set<string>;
}) {
  return (
    <div className="em-nav">
      <div className="sv-tabs" role="tablist" aria-label="Email list">
        {(['prereg', 'public'] as EmailListId[]).map((l) => {
          const n = openCount ? emails.filter((e) => e.list === l).reduce((s, e) => s + openCount(e.id), 0) : 0;
          return (
            <button key={l} type="button" role="tab" aria-selected={list === l} className={`pill${list === l ? ' on' : ''}`}
              onClick={() => { setList(l); setEmailId(`${l}-${emailId.split('-')[1] ?? 1}`); }}>
              {EMAIL_LISTS[l].label}{n ? <span className="cnt">{n}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="em-about">{EMAIL_LISTS[list].about}</p>
      <ol className="em-seq">
        {emails.filter((e) => e.list === list).map((e) => {
          const n = openCount?.(e.id) ?? 0;
          return (
            <li key={e.id}>
              <button type="button" className={`em-step ${e.stage}${e.id === emailId ? ' on' : ''}`} onClick={() => setEmailId(e.id)} aria-current={e.id === emailId ? 'true' : undefined}>
                <span className="em-step-h">
                  <span className="em-step-n">{e.n}</span>
                  <span className="em-step-k">{e.stage === 'warmup' ? 'Warm-up' : 'Launch'}</span>
                  {n ? <span className="cnt">{n}</span> : null}
                  {changed?.has(e.id) && <span className="em-chg-dot" title="Changed in this version">Changed</span>}
                </span>
                <span className="em-step-s">{e.subject}</span>
                <span className="em-step-d">{campaign.launchDate ? fmtSend(sendAt(campaign.launchDate, e.offset, e.time)) : offsetLabel(e.offset)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Text that grows with its content, for editing in place. */
function Grow({ value, onChange, className, label }: { value: string; onChange: (v: string) => void; className: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} aria-label={label} className={`em-edit ${className}`} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * One email as the reader will see it, inside an inbox-style frame.
 * In comment mode every part is clickable; in edit mode every part is editable.
 */
export function EmailPreview({ campaign, email, device, mode = 'view', comments = [], number, pick, onPick, onTarget, onChange, highlight, draftField }: {
  campaign: EmailCampaign;
  email: LaunchEmail;
  device: Device;
  mode?: EmailMode;
  comments?: EmailComment[];
  number?: Map<string, number>;
  pick?: string | null;
  onPick?: (id: string) => void;
  onTarget?: (field: EmailField, quote: string) => void;
  onChange?: (e: LaunchEmail) => void;
  /** Fields that changed, outlined. */
  highlight?: Set<string>;
  draftField?: string | null;
}) {
  const b = campaign.brand;
  const vars = { '--ep': b.primary, '--es': b.secondary, '--eink': b.ink, '--efd': FONT[b.font] ?? FONT.bold } as CSSProperties;
  const when = campaign.launchDate ? fmtSend(sendAt(campaign.launchDate, email.offset, email.time)) : 'Date to be set';
  const href = siteHref(campaign.websiteUrl);
  const set = (patch: Partial<LaunchEmail>) => onChange?.({ ...email, ...patch });

  /** A part of the email: clickable to comment on, editable, outlined if changed, with its comment pins. */
  const part = ({ field, text, as: Tag = 'div', className = '', children, key }: { field: EmailField; text: string; as?: 'div' | 'p' | 'h1' | 'span'; className?: string; children?: ReactNode; key?: string | number }) => {
    const pins = comments.filter((c) => c.field === field);
    const cls = `em-part ${className}${mode === 'comment' ? ' em-hit' : ''}${highlight?.has(field) ? ' chg' : ''}${draftField === field ? ' em-drafting' : ''}`;
    const inner = (
      <>
        {children ?? text}
        {pins.length > 0 && (
          <span className="em-pins">
            {pins.map((c) => (
              <button key={c.id} type="button" className={`pin sm${c.resolved ? ' done' : ''}${pick === c.id ? ' on' : ''}`} aria-label={`Comment ${number?.get(c.id)}`}
                onClick={(ev) => { ev.stopPropagation(); onPick?.(c.id); }}>{number?.get(c.id)}</button>
            ))}
          </span>
        )}
      </>
    );
    if (mode !== 'comment') return <Tag key={key} className={cls}>{inner}</Tag>;
    return (
      <Tag key={key} className={cls} role="button" tabIndex={0} title="Comment on this"
        onClick={() => onTarget?.(field, text)}
        onKeyDown={(ev: React.KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onTarget?.(field, text); } }}>
        {inner}
      </Tag>
    );
  };

  const edit = mode === 'edit';

  return (
    <div className={`em-frame ${device}`} style={vars}>
      <div className="em-inbox">
        <div className="em-from"><span className="em-av" aria-hidden="true">{b.name.charAt(0)}</span><b>{b.name}</b><span>&lt;{b.replyTo}&gt;</span></div>
        <div className="em-meta">
          {edit ? (
            <>
              <label className="em-l">Subject<Grow className="em-subj" label="Subject line" value={email.subject} onChange={(v) => set({ subject: v })} /></label>
              <label className="em-l">Preview text<Grow className="em-prev" label="Preview text" value={email.preview} onChange={(v) => set({ preview: v })} /></label>
            </>
          ) : (
            <>
              {part({ field: 'subject', text: email.subject, className: 'em-subj' })}
              {part({ field: 'preview', text: email.preview, className: 'em-prev' })}
            </>
          )}
        </div>
        <div className="em-when">{EMAIL_LISTS[email.list].short} · Email {email.n} · {when}</div>
      </div>

      <div className="em-body">
        <div className="em-card">
          <div className="em-logo">
            {b.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={b.logoUrl} alt={b.name} />
              : <span>{b.name}</span>}
          </div>
          <div className="em-in">
            {edit
              ? <Grow className="em-h" label="Heading" value={email.heading} onChange={(v) => set({ heading: v })} />
              : part({ field: 'heading', as: 'h1', text: email.heading, className: 'em-h' })}
            <p className="em-p">Hi Sarah,</p>
            {email.body.map((para, i) => edit ? (
              <div key={i} className="em-edit-row">
                <Grow className="em-p" label={`Paragraph ${i + 1}`} value={para} onChange={(v) => set({ body: email.body.map((x, j) => (j === i ? v : x)) })} />
                <button type="button" className="em-x" aria-label={`Remove paragraph ${i + 1}`} onClick={() => set({ body: email.body.filter((_, j) => j !== i) })}>×</button>
              </div>
            ) : (
              part({ key: i, field: `body.${i}`, as: 'p', text: para, className: 'em-p' })
            ))}
            {edit && <button type="button" className="ob-link em-add" onClick={() => set({ body: [...email.body, ''] })}>+ Add a paragraph</button>}
            {showsCode(campaign, email) && (
              <div className="em-code">Your code: <b>{campaign.discountCode}</b></div>
            )}
            {email.stage === 'launch' && (edit ? (
              <label className="em-l em-l-btn">Button<Grow className="em-btn-edit" label="Button label" value={email.button} onChange={(v) => set({ button: v })} /></label>
            ) : email.button ? (
              <div className="em-btnrow">
                {part({ field: 'button', as: 'span', text: email.button, className: 'em-btn' })}
                <span className="em-link">{href ? `Links to ${href.replace(/^https?:\/\//, '')}` : 'Links to your website (add the address in settings)'}</span>
              </div>
            ) : null)}
            <p className="em-p em-sign">{b.coach}</p>
            {edit ? (
              <label className="em-l">P.S. (optional)<Grow className="em-ps" label="P.S." value={email.ps} onChange={(v) => set({ ps: v })} /></label>
            ) : email.ps ? (
              part({ field: 'ps', as: 'p', text: email.ps, className: 'em-ps', children: <>P.S. {email.ps}</> })
            ) : null}
          </div>
          <div className="em-foot">{b.name} · Unsubscribe</div>
        </div>
      </div>
    </div>
  );
}
