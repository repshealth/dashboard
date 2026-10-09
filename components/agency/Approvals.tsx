'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import PreviewFrame from '../site/PreviewFrame';
import { fmtWhen } from '@/lib/format';
import { latestPublished, pendingVersion } from '@/lib/site/versions';
import type { Client, Device, Site, SiteComment, SiteVersion } from '@/lib/types';

type Item =
  | { kind: 'auto'; client: Client; site: Site; pending: SiteVersion; base: SiteVersion | undefined; at: string }
  | { kind: 'manual'; client: Client; site: Site; base: SiteVersion; open: SiteComment[]; at: string };

/** What needs the REPS team: amends Claude made (to approve), and change requests it couldn't make. */
function buildQueue(sites: Site[], clients: Client[]): Item[] {
  const items: Item[] = [];
  for (const site of sites) {
    const client = clients.find((c) => c.id === site.clientId);
    if (!client) continue;
    const pending = pendingVersion(site);
    if (pending) {
      items.push({ kind: 'auto', client, site, pending, base: site.versions.find((v) => v.id === pending.basedOn), at: pending.createdAt ?? '' });
      continue;
    }
    const base = latestPublished(site);
    const open = base?.comments.filter((c) => !c.resolved) ?? [];
    if (site.status === 'changes' && base && open.length) {
      items.push({ kind: 'manual', client, site, base, open, at: open[open.length - 1].createdAt });
    }
  }
  return items.sort((a, b) => (a.kind === b.kind ? b.at.localeCompare(a.at) : a.kind === 'auto' ? -1 : 1));
}

export default function Approvals() {
  const router = useRouter();
  const { viewer, clients, allSites, refreshAgency, approveVersion, rejectVersion, setClientId, toast } = useData();
  const [selKey, setSelKey] = useState<string | null>(null);
  const [showing, setShowing] = useState<'new' | 'old'>('new');
  const [device, setDevice] = useState<Device>('desktop');
  const [pageIdx, setPageIdx] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  useEffect(() => { refreshAgency().catch(() => {}); }, [refreshAgency]);

  const queue = useMemo(() => buildQueue(allSites ?? [], clients), [allSites, clients]);
  const key = (i: Item) => `${i.kind}:${i.site.clientId}`;
  const item = queue.find((i) => key(i) === selKey) ?? queue[0];

  useEffect(() => { setShowing('new'); setPageIdx(0); setRejecting(false); setNote(''); }, [item && key(item)]);

  if (!viewer?.isAdmin) return null;
  if (allSites === null) return <div className="loading">Loading approvals…</div>;

  const openWebsite = (clientId: string) => { setClientId(clientId); router.push('/website'); };

  const commentFor = (id?: string) => (id ? item?.base?.comments.find((c) => c.id === id) : undefined);

  return (
    <div className="view">
      <header>
        <div>
          <h1>Approvals</h1>
          <p className="sub">Website amends made from client comments. Nothing reaches the client until you approve it.</p>
        </div>
      </header>

      {!queue.length ? (
        <div className="sv-empty">
          <span className="stbadge st-approved">All clear</span>
          <div className="sv-et">Nothing waiting for you</div>
          <p>When a client presses Request changes, Claude makes a revised version from their comments and it appears here for you to check.</p>
        </div>
      ) : (
        <div className="ap-grid">
          <nav className="ap-list" aria-label="Waiting for approval">
            {queue.map((i) => {
              const on = item && key(i) === key(item);
              const needs = i.kind === 'auto' ? i.pending.unresolved?.length ?? 0 : i.open.length;
              return (
                <button key={key(i)} type="button" className={`ap-item${on ? ' on' : ''}`} onClick={() => setSelKey(key(i))} aria-current={on ? 'true' : undefined}>
                  <div className="ap-item-h"><b>{i.client.name}</b><span className="cm-t">{fmtWhen(i.at)}</span></div>
                  {i.kind === 'auto' ? (
                    <>
                      <div className="ap-item-v">{i.base?.version ?? 'v?'} → {i.pending.version} · ready to approve</div>
                      <div className="ap-item-tags">
                        <span className="stbadge sm st-review">{i.pending.changes?.length ?? 0} change{(i.pending.changes?.length ?? 0) === 1 ? '' : 's'}</span>
                        {needs > 0 && <span className="stbadge sm st-changes">{needs} need{needs === 1 ? 's' : ''} you</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ap-item-v">{i.base.version} · changes to make by hand</div>
                      <div className="ap-item-tags"><span className="stbadge sm st-changes">{needs} comment{needs === 1 ? '' : 's'}</span></div>
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {item && item.kind === 'auto' && (() => {
            const page = (showing === 'new' ? item.pending : item.base ?? item.pending).pages[pageIdx] ?? item.pending.pages[0];
            const pages = item.pending.pages;
            const changes = item.pending.changes ?? [];
            const unresolved = item.pending.unresolved ?? [];
            return (
              <section className="ap-detail" aria-label={`${item.client.name} amend`}>
                <div className="ap-head">
                  <div>
                    <div className="ap-eyebrow">{item.client.name}</div>
                    <h2>{item.pending.version} made from {item.site.contact || 'the client'}&apos;s comments</h2>
                    <p className="sub">{item.pending.summary} {item.pending.amendedBy === 'rules' ? 'Made with simple rules (Claude isn’t connected in this preview).' : 'Made by Claude.'}</p>
                  </div>
                  <div className="actions">
                    <button type="button" className="btn" disabled={busy} onClick={() => setRejecting(!rejecting)}>Reject</button>
                    <button type="button" className="btn gold" disabled={busy} onClick={async () => {
                      setBusy(true);
                      try {
                        await approveVersion(item.site.clientId, item.pending.id);
                        toast(`${item.pending.version} sent to ${item.site.contact || item.client.name} for review.`);
                        setSelKey(null);
                      } catch (e) { toast(e instanceof Error ? e.message : 'Could not approve. Please try again.'); }
                      finally { setBusy(false); }
                    }}>Approve and send to client</button>
                  </div>
                </div>

                {rejecting && (
                  <div className="ap-reject">
                    <label htmlFor="reject-note" className="ob-label">Message the client sees (optional)</label>
                    <textarea id="reject-note" rows={2} placeholder="e.g. We're making these changes by hand and will send them over tomorrow." value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="cp-a">
                      <button type="button" className="btn" onClick={() => setRejecting(false)}>Cancel</button>
                      <button type="button" className="btn gold" disabled={busy} onClick={async () => {
                        setBusy(true);
                        try {
                          await rejectVersion(item.site.clientId, item.pending.id, note.trim());
                          toast(`${item.pending.version} discarded. ${item.client.name}'s comments stay open for the team.`);
                          setSelKey(null);
                        } catch (e) { toast(e instanceof Error ? e.message : 'Could not reject. Please try again.'); }
                        finally { setBusy(false); }
                      }}>Discard this version</button>
                    </div>
                  </div>
                )}

                <div className="ap-body">
                  <div className="ap-preview">
                    <div className="sv-bar">
                      <div className="seg" role="group" aria-label="Which version">
                        <button type="button" className={showing === 'new' ? 'on' : ''} onClick={() => setShowing('new')}>Revised {item.pending.version}</button>
                        <button type="button" className={showing === 'old' ? 'on' : ''} disabled={!item.base} onClick={() => setShowing('old')}>Current {item.base?.version}</button>
                      </div>
                      <div className="sv-tools">
                        {pages.length > 1 && pages.map((p, i) => (
                          <button key={p.id} type="button" className={`pill${i === pageIdx ? ' on' : ''}`} onClick={() => setPageIdx(i)}>{p.name}</button>
                        ))}
                        <div className="seg" role="group" aria-label="Device">
                          {(['desktop', 'mobile'] as Device[]).map((d) => (
                            <button key={d} type="button" className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>{d === 'desktop' ? 'Desktop' : 'Mobile'}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {page?.spec ? (
                      <PreviewFrame
                        spec={page.spec}
                        device={device}
                        label={`${item.site.domain}${page.path} · ${showing === 'new' ? item.pending.version : item.base?.version}`}
                        highlight={showing === 'new' ? changes.map((c) => c.after) : changes.map((c) => c.before)}
                      />
                    ) : <div className="sv-empty"><p>This page can&apos;t be previewed.</p></div>}
                    <p className="ap-hint">Changed words are outlined in the preview.</p>
                  </div>

                  <aside className="detail ap-changes" aria-label="What changed">
                    <div className="lbl" style={{ marginTop: 0 }}>WHAT CHANGED ({changes.length})</div>
                    {!changes.length && <p className="cm-none">No text was changed automatically.</p>}
                    {changes.map((c, i) => {
                      const cm = commentFor(c.commentId);
                      return (
                        <div key={i} className="chg-item">
                          <div className="chg-label">{c.label}</div>
                          <div className="chg-before">{c.before}</div>
                          <div className="chg-after">{c.after || <i>Line removed</i>}</div>
                          {cm && <div className="chg-why"><b>{cm.author}:</b> {cm.text}</div>}
                        </div>
                      );
                    })}
                    {unresolved.length > 0 && (
                      <>
                        <div className="lbl">NEEDS YOU ({unresolved.length})</div>
                        {unresolved.map((u) => (
                          <div key={u.commentId} className="chg-item chg-need">
                            <div className="chg-why"><b>{commentFor(u.commentId)?.author ?? 'Client'}:</b> {u.text}</div>
                            <div className="chg-reason">{u.reason}</div>
                          </div>
                        ))}
                        <p className="ap-hint">Approving sends the text changes now. These still need doing by hand afterwards.</p>
                      </>
                    )}
                  </aside>
                </div>
              </section>
            );
          })()}

          {item && item.kind === 'manual' && (
            <section className="ap-detail" aria-label={`${item.client.name} change request`}>
              <div className="ap-head">
                <div>
                  <div className="ap-eyebrow">{item.client.name}</div>
                  <h2>Changes to make by hand</h2>
                  <p className="sub">This site is made from designs or screenshots, so Claude can&apos;t edit it directly. Here&apos;s what {item.site.contact || 'the client'} asked for on {item.base.version}.</p>
                </div>
                <div className="actions">
                  <button type="button" className="btn gold" onClick={() => openWebsite(item.site.clientId)}>Open their website</button>
                </div>
              </div>
              <div className="detail ap-manual">
                {item.open.map((c, i) => (
                  <div key={c.id} className="chg-item">
                    <div className="chg-label">{i + 1}. {c.target?.section ?? item.base.pages.find((p) => p.id === c.pageId)?.name ?? 'Website'}{c.device ? ` · ${c.device}` : ''}</div>
                    {c.target?.text && <div className="chg-before chg-ctx">{c.target.text}</div>}
                    <div className="chg-why"><b>{c.author}:</b> {c.text}</div>
                    <div className="cm-t" style={{ marginLeft: 0 }}>{fmtWhen(c.createdAt)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
