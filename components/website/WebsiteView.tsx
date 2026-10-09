'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useData, type DraftComment } from '../DataProvider';
import MockSite from './MockSite';
import SpecSite from '../site/SpecSite';
import { SITE_STATUS } from '@/lib/constants';
import { fmtWhen } from '@/lib/format';
import { pendingVersion, publishedVersions } from '@/lib/site/versions';
import type { CommentTarget, Device, PinAnchor, SiteComment } from '@/lib/types';

const SECTION_NAMES: Record<string, string> = {
  about: 'Intro section', inside: 'Feature cards', app: 'App section', pricing: 'Pricing', programmes: 'Programmes',
  results: 'Results', coach: 'Meet the coach', faq: 'FAQ', guide: 'Free guide', benefits: 'Reasons to join',
};

/** Describes what a pin was dropped on, so the REPS team (and Claude) know what the comment is about. */
function describeTarget(el: Element, pageName: string): CommentTarget {
  const sec = el.closest('.t-navwrap, .t-hero, .t-bandzone, .t-foot, section[id]');
  const section = !sec ? pageName
    : sec.classList.contains('t-navwrap') ? 'Menu'
    : sec.classList.contains('t-hero') ? 'Hero'
    : sec.classList.contains('t-bandzone') ? 'Highlights band'
    : sec.classList.contains('t-foot') ? 'Footer'
    : SECTION_NAMES[sec.id] ?? pageName;
  const pic = el.closest('img, [role="img"]');
  if (pic) {
    const label = pic.getAttribute('alt') || pic.getAttribute('aria-label') || 'Image';
    return { section, text: label.replace(/ \(to be added\)$/, '') };
  }
  const textEl = el.closest('h1, h2, h3, p, li, button, a, .t-card-t, .t-card-b, .t-btn, .t-stat-v, .t-stat-l, .t-price-v, span') ?? el;
  const text = (textEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { section, text };
}

type Pos = Record<string, { x: number; y: number }>;

/** Finds the element a pin is anchored to inside the preview. */
function anchorEl(pv: HTMLElement, a: PinAnchor, all: Element[]) {
  if (a.sel) return pv.querySelectorAll('.site ' + a.sel)[a.n ?? 0] ?? (pv.querySelector('.site ' + a.sel) || null);
  return a.i !== undefined ? all[a.i] ?? null : null;
}

export default function WebsiteView() {
  const { client, site, viewer, addComment, toggleResolved, requestChanges, approve, sendToClient, toast } = useData();
  const [vi, setVi] = useState(0);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [cmode, setCmode] = useState(false);
  const [draft, setDraft] = useState<DraftComment | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<Pos>({});
  const pvRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  // Generated sites are drawn at a real desktop width and scaled down to fit the preview.
  const DESKTOP_W = 1280;
  const [vpW, setVpW] = useState(0);
  useEffect(() => {
    const el = vpRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setVpW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const scrollToPick = useRef(false);

  // Fresh review state for each client.
  useEffect(() => {
    setVi(0); setPageKey(null); setDevice('desktop'); setCmode(false); setDraft(null); setPick(null); setModal(false);
  }, [client?.id]);

  const versions = publishedVersions(site);
  const version = versions[Math.min(vi, Math.max(versions.length - 1, 0))];
  const page = version?.pages.find((p) => p.key === pageKey) ?? version?.pages[0];
  const pageId = page?.id;
  const comments: SiteComment[] = useMemo(
    () => (version && pageId ? version.comments.filter((c) => c.pageId === pageId) : []),
    [version, pageId],
  );
  const onDevice = (c: { device?: Device }) => !c.device || c.device === device;

  const draftAnchor = draft?.anchor;
  const measure = useCallback(() => {
    const pv = pvRef.current;
    if (!pv) return;
    const base = pv.getBoundingClientRect();
    const all = Array.from(pv.querySelectorAll('.site, .site *'));
    const next: Pos = {};
    const place = (id: string, a: PinAnchor) => {
      const el = anchorEl(pv, a, all);
      if (!el) return;
      const r = el.getBoundingClientRect();
      next[id] = { x: r.left - base.left + r.width * a.fx, y: r.top - base.top + r.height * a.fy };
    };
    comments.forEach((c) => onDevice(c) && place(c.id, c.anchor));
    if (draftAnchor) place('draft', draftAnchor);
    setPos((prev) => {
      const keys = Object.keys(next);
      const same = keys.length === Object.keys(prev).length &&
        keys.every((k) => prev[k] && Math.abs(prev[k].x - next[k].x) < 0.5 && Math.abs(prev[k].y - next[k].y) < 0.5);
      return same ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, draftAnchor, device]);

  useLayoutEffect(() => { measure(); }, [measure, pageId, vpW]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Start each page, version, device and client at the top of the preview.
  useEffect(() => { vpRef.current?.scrollTo({ top: 0 }); }, [client?.id, pageId, vi, device]);

  // Scroll the preview (not the whole page) to a picked comment's pin.
  useEffect(() => {
    if (!scrollToPick.current || !pick || !pos[pick] || !vpRef.current) return;
    scrollToPick.current = false;
    const vp = vpRef.current;
    vp.scrollTo({ top: Math.max(0, pos[pick].y - vp.clientHeight / 2), behavior: 'smooth' });
  }, [pick, pos]);

  useEffect(() => { if (draft) textRef.current?.focus(); }, [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCmode(false); setDraft(null); setModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!client) return <div className="loading">No clients on this account yet.</div>;
  if (site === undefined) return <div className="loading">Loading website…</div>;

  const isDraft = site?.status === 'draft';
  const head = (actions: boolean) => (
    <header>
      <div>
        <h1>Website</h1>
        <p className="sub">Preview your new site, leave comments and approve the design</p>
      </div>
      {actions && isDraft && (
        <div className="actions">
          <button className="btn gold" type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await sendToClient(); toast(`Sent to ${site?.contact || client?.name}. They'll get an email with their login.`); }
            catch (e) { toast(e instanceof Error ? e.message : 'Could not send. Please try again.'); }
            finally { setBusy(false); }
          }}>Send to client</button>
        </div>
      )}
      {actions && !isDraft && (
        <div className="actions">
          <button className="btn" type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const r = await requestChanges();
              toast(!r.open ? 'Add a comment first so we know what to change.'
                : r.auto ? `Sent ${r.open} comment${r.open === 1 ? '' : 's'}. Your updated site will be ready to review soon.`
                : `Sent ${r.open} comment${r.open === 1 ? '' : 's'} to the REPS team.`);
            } finally { setBusy(false); }
          }}>Request changes</button>
          <button className="btn gold" type="button" disabled={busy} onClick={() => setModal(true)}>Approve design</button>
        </div>
      )}
    </header>
  );

  // Clients never see a draft; the REPS team does.
  if (!site || !version || !page || site.status === 'building' || (isDraft && !viewer?.isAdmin)) {
    return (
      <div className="view">
        {head(false)}
        <div className="sv-empty">
          <span className={`stbadge ${SITE_STATUS.building.cls}`}>{SITE_STATUS.building.label}</span>
          <div className="sv-et">{client.name}&apos;s website is on its way</div>
          <p>{site?.statusNote || 'The REPS team is building the first draft.'} You&apos;ll get an email as soon as it&apos;s ready to review here.</p>
        </div>
      </div>
    );
  }

  const old = vi > 0;
  const locked = site.status === 'approved' || old;
  // After "Request changes" the buttons wait until the REPS team sends the updated version.
  const waiting = site.status === 'changes';
  const pending = pendingVersion(site);
  const st = old ? { label: 'Earlier version', cls: 'st-build' } : SITE_STATUS[site.status];
  const sentLine = old ? version.sentNote : site.statusNote || version.sentNote;
  const openAll = version.comments.filter((c) => !c.resolved).length;
  const number = new Map(comments.map((c, i) => [c.id, i + 1]));

  const placePin = (e: MouseEvent<HTMLDivElement>) => {
    if (!cmode || (e.target as HTMLElement).closest('.pin')) return;
    const pv = pvRef.current!;
    const target = (e.target as HTMLElement).closest('.site *') || pv.querySelector('.site');
    if (!target) return;
    const r = target.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const shot = page.kind === 'shot';
    const anchor: PinAnchor = shot
      ? { sel: '.shot', ...(() => { const ir = pv.querySelector('.shot')!.getBoundingClientRect(); return { fx: (e.clientX - ir.left) / ir.width, fy: (e.clientY - ir.top) / ir.height }; })() }
      : { i: Array.from(pv.querySelectorAll('.site, .site *')).indexOf(target), fx, fy };
    const described = shot
      ? { section: page.name, text: `Screenshot, about ${Math.round(anchor.fy * 100)}% of the way down` }
      : describeTarget(target, page.name);
    setDraft({ pageId: page.id, device: shot ? device : undefined, anchor, target: described, text: '' });
    setCmode(false);
    setPick(null);
  };

  const post = async () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) { textRef.current?.focus(); return; }
    setBusy(true);
    try {
      const saved = await addComment(version.id, { ...draft, text });
      setDraft(null);
      setPick(saved.id);
    } catch (err) {
      toast('Could not save that comment. Please try again.');
      console.error(err);
    } finally { setBusy(false); }
  };

  const choose = (c: SiteComment) => {
    if (pick === c.id) { setPick(null); return; }
    if (c.device && c.device !== device) setDevice(c.device);
    scrollToPick.current = true;
    setPick(c.id);
  };

  return (
    <div className="view">
      {head(!locked && !waiting)}

      <div className="sv-bar">
        <div className="sv-tabs">
          {version.pages.map((p) => {
            const n = version.comments.filter((c) => c.pageId === p.id && !c.resolved).length;
            return (
              <button key={p.id} type="button" className={`pill${p.id === page.id ? ' on' : ''}`}
                onClick={() => { setPageKey(p.key); setDraft(null); setPick(null); }}>
                {p.name}{n ? <span className="cnt">{n}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="sv-tools">
          {versions.length > 1 && (
            <label className="vsel">
              <span className="sr">Version</span>
              <select value={vi} onChange={(e) => { setVi(+e.target.value); setPageKey(null); setDraft(null); setPick(null); setCmode(false); }}>
                {versions.map((v, i) => <option key={v.id} value={i}>{v.label}{i === 0 ? ' (latest)' : ''}</option>)}
              </select>
            </label>
          )}
          <div className="seg" role="group" aria-label="Device">
            {(['desktop', 'mobile'] as Device[]).map((d) => (
              <button key={d} type="button" className={device === d ? 'on' : ''} onClick={() => { setDevice(d); setDraft(null); setPick(null); }}>
                {d === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>
          {!locked && (
            <button type="button" className={`btn${cmode ? ' gold' : ''}`} onClick={() => { setCmode(!cmode); setDraft(null); }}>
              {cmode ? 'Click the preview to place a pin' : '+ Add comment'}
            </button>
          )}
        </div>
      </div>

      <div className="work">
        <div className="sv-stage">
          <div className={`frame ${device}`}>
            <div className="chrome">
              <span className="dots"><i /><i /><i /></span>
              <span className="url">{site.domain}{page.path}</span>
              <span className="ver">{version.version}</span>
            </div>
            <div className="viewport" ref={vpRef}>
              <div className={`pv${cmode ? ' cmode' : ''}`} ref={pvRef} onClick={placePin} onLoadCapture={measure}>
                {page.kind === 'shot' ? (
                  <div className="site shotwrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${page.id}-${device}`}
                      className="shot"
                      src={device === 'mobile' ? page.mobileUrl || page.desktopUrl : page.desktopUrl}
                      alt={`${page.name}, ${device} design`}
                      onLoad={measure}
                    />
                  </div>
                ) : page.kind === 'template' && page.spec ? (
                  device === 'desktop' ? (
                    <div className="tpl-zoom" style={{ width: DESKTOP_W, zoom: vpW ? Math.min(1, vpW / DESKTOP_W) : 0.6 }}>
                      <SpecSite spec={page.spec} />
                    </div>
                  ) : (
                    <SpecSite spec={page.spec} />
                  )
                ) : site.brand && page.mock ? (
                  <MockSite brand={site.brand} page={page.mock} />
                ) : null}

                {comments.map((c) => onDevice(c) && pos[c.id] ? (
                  <button key={c.id} type="button" aria-label={`Comment ${number.get(c.id)}`}
                    className={`pin${c.resolved ? ' done' : ''}${pick === c.id ? ' on' : ''}`}
                    style={{ left: pos[c.id].x, top: pos[c.id].y }}
                    onClick={(e) => { e.stopPropagation(); setPick(pick === c.id ? null : c.id); }}>
                    {number.get(c.id)}
                  </button>
                ) : null)}
                {draft && pos.draft && (
                  <span className="pin draft" style={{ left: pos.draft.x, top: pos.draft.y }}>{comments.length + 1}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="detail sv-side" aria-label="Review">
          <span className={`stbadge ${st.cls}`}>{st.label}</span>
          <div className="sv-ver">Version {version.version} · {sentLine}</div>
          {isDraft && !old && (
            <div className="sv-lock sv-draft">Built from {site.contact || client.name}&apos;s onboarding form. Only the REPS team can see this. Check it over, leave notes as comments, then press <b>Send to client</b>.</div>
          )}
          {waiting && !old && (viewer?.isAdmin ? (
            <div className="sv-lock sv-draft">
              {pending
                ? <>A revised version ({pending.version}) has been made from these comments. It&apos;s waiting for your approval before {site.contact || 'the client'} sees it.</>
                : <>Changes requested. Handle them from Approvals.</>}
              {' '}<Link href="/agency/approvals" className="sv-inline-link">Open Approvals</Link>
            </div>
          ) : (
            <div className="sv-lock sv-wait">Thanks, your changes are with the REPS team. You&apos;ll get an email when the updated version is ready to review.</div>
          ))}
          {old ? (
            <div className="sv-lock old">You&apos;re viewing an earlier version for reference. Switch to the latest version to comment or approve.</div>
          ) : locked ? (
            <div className="sv-lock">Design approved. Comments are closed and the REPS team will now put the site live.</div>
          ) : null}
          <div className="lbl">COMMENTS ON {page.name.toUpperCase()}</div>
          <div className="sv-open">{openAll} open across the site</div>

          {draft && (
            <div className="composer">
              <div className="cm-h"><span className="pin sm draft">{comments.length + 1}</span><b>New comment</b></div>
              <textarea ref={textRef} rows={3} placeholder="What would you like changed here?" value={draft.text}
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
              <div key={c.id} className={`cm${c.resolved ? ' done' : ''}${pick === c.id ? ' on' : ''}`}
                role="button" tabIndex={0} onClick={() => choose(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(c); } }}>
                <div className="cm-h">
                  <span className={`pin sm${c.resolved ? ' done' : ''}`}>{number.get(c.id)}</span>
                  <b>{c.author}{viewer && c.author === viewer.name && !viewer.isAdmin ? ' (you)' : ''}</b>
                  {c.device && <span className="devtag">{c.device === 'mobile' ? 'Mobile' : 'Desktop'}</span>}
                  <span className="cm-t">{fmtWhen(c.createdAt)}</span>
                </div>
                <div className="cm-b">{c.text}</div>
                {!locked && (
                  <button type="button" className="cm-r" onClick={(e) => { e.stopPropagation(); toggleResolved(version.id, c.id); }}>
                    {c.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                )}
              </div>
            )) : (
              <div className="cm-none">
                No comments on this page{locked ? '' : <>. Click <b>Add comment</b>, then click anywhere on the preview.</>}
              </div>
            )}
          </div>
        </aside>
      </div>

      {modal && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="approve-title">
            <div id="approve-title" className="m-t">Approve this design?</div>
            <p>
              You&apos;re signing off version {version.version} of the {client.name} website.
              {openAll ? ` There ${openAll === 1 ? 'is' : 'are'} still ${openAll} open comment${openAll === 1 ? '' : 's'}, these will be closed.` : ''}
              {' '}The REPS team will then put it live.
            </p>
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button type="button" className="btn gold" disabled={busy} onClick={async () => {
                setBusy(true);
                try { await approve(); setModal(false); toast('Design approved. Nice one!'); }
                catch { toast('Could not save the approval. Please try again.'); }
                finally { setBusy(false); }
              }}>Approve design</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
