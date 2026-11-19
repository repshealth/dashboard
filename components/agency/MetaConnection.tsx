'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import type { MetaConnectionPublic } from '@/lib/ads/types';

const STATUS: Record<string, string> = { active: 'Active', disabled: 'Disabled', unsettled: 'Payment due', closed: 'Closed', other: 'Not active' };
type Conn = MetaConnectionPublic['connections'][number];

/**
 * Agency only: Meta connections (System User tokens, one per Business Manager) and, for each
 * client, the ad accounts that feed their Meta ads section. A client can have several, and a
 * shared ad account can be split between clients by campaign name.
 */
export default function MetaConnection() {
  const { toast } = useData();
  const [c, setC] = useState<MetaConnectionPublic | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { setC(await backend.getMetaConnection()); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the Meta connections.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(null); }
  };
  const sync = (clientId: string, name: string) => run(`sync-${clientId}`, async () => {
    const r = await backend.syncMetaAds(clientId);
    toast(r.failed ? `${name}: synced, but ${r.failed} ad account${r.failed === 1 ? '' : 's'} failed. See the error on the row.` : `${name}: ${r.rows} row${r.rows === 1 ? '' : 's'} updated.`);
    await load();
  });
  const syncAll = () => run('all', async () => {
    const linked = c?.clients.filter((x) => x.links.length) ?? [];
    let ok = 0; const failed: string[] = [];
    for (const x of linked) {
      try { const r = await backend.syncMetaAds(x.clientId); if (r.failed) failed.push(x.clientName); else ok++; } catch { failed.push(x.clientName); }
    }
    await load();
    toast(failed.length ? `Synced ${ok}. Problems with ${failed.join(', ')}.` : `Synced all ${ok} client${ok === 1 ? '' : 's'}.`);
  });

  if (err) return <div className="view"><div className="form-msg err">{err}</div></div>;
  if (!c) return <div className="loading">Loading…</div>;

  const anyConn = c.connections.length > 0;
  const linkedClients = c.clients.filter((x) => x.links.length).length;
  const usedAccounts = new Set(c.clients.flatMap((x) => x.links.map((l) => l.accountId)));
  const unlinked = new Set(c.connections.flatMap((k) => k.accounts.map((a) => a.id)).filter((id) => !usedAccounts.has(id))).size;
  const shown = c.clients.filter((x) => !q.trim() || `${x.clientName} ${x.links.map((l) => l.accountName).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()));
  const target = linkFor ? c.clients.find((x) => x.clientId === linkFor) : null;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Meta connection</h1>
          <p className="sub">Connect your Meta Business Manager, then link each client to their ad accounts. Their results show in that client&apos;s Meta ads section.</p>
        </div>
        {anyConn && (
          <div className="actions">
            <button type="button" className="btn" disabled={busy !== null} onClick={() => run('refresh', async () => { setC(await backend.refreshMetaAccounts()); toast('Ad account lists refreshed.'); })}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh accounts'}</button>
            {linkedClients > 0 && <button type="button" className="btn gold" disabled={busy !== null} onClick={syncAll}>{busy === 'all' ? 'Syncing…' : `Sync all ${linkedClients}`}</button>}
          </div>
        )}
      </header>

      <section className="fn-panel">
        <div className="fn-ph">
          Connections
          {anyConn && !adding && <button type="button" className="ob-link" onClick={() => setAdding(true)}>+ Add another connection</button>}
        </div>
        {c.connections.map((k) => <ConnRow key={k.id} k={k} busy={busy} run={run} setC={setC} load={load} />)}
        {(!anyConn || adding) && <ConnForm first={!anyConn} onCancel={anyConn ? () => setAdding(false) : undefined} onDone={(next) => { setC(next); setAdding(false); }} />}
        {anyConn && <p className="ap-hint">Most clients sit under one Business Manager, so one connection is usually enough. Add another for clients whose ad accounts are in a different Business Manager (each one needs its own System User token).</p>}
      </section>

      {!anyConn ? <Setup /> : (
        <section className="fn-panel">
          <div className="fn-ph">
            Clients
            <span className="mc-ph-r">
              <span className="mc-count">{linkedClients} of {c.clients.length} linked{unlinked ? ` · ${unlinked} ad account${unlinked === 1 ? '' : 's'} not linked yet` : ''}</span>
              {c.clients.length > 8 && <input className="ob-input mc-search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />}
            </span>
          </div>
          <div className="ad-scroll">
            <table className="ad-table mc-table">
              <thead><tr><th>CLIENT</th><th>LINKED AD ACCOUNTS</th><th /></tr></thead>
              <tbody>
                {shown.map((x) => (
                  <tr key={x.clientId} className={x.links.length ? 'mc-linked' : ''}>
                    <td className="mc-client">{x.clientName}</td>
                    <td>
                      {!x.links.length ? <span className="mc-none">Not linked</span> : (
                        <ul className="mc-links">
                          {x.links.map((l) => (
                            <li key={l.accountId}>
                              <div className="mc-link-t">
                                <b>{l.accountName ?? l.accountId}</b>
                                {l.filter && <span className="fn-tag">Campaigns containing “{l.filter}”</span>}
                              </div>
                              <div className="mc-sub">
                                {l.accountId}{c.connections.length > 1 && l.connectionLabel ? ` · via ${l.connectionLabel}` : ''}
                                {' · '}{l.missing ? <span className="mc-err">connection removed</span> : l.lastSyncError ? <span className="mc-err" title={l.lastSyncError}>sync failed: {l.lastSyncError.slice(0, 70)}{l.lastSyncError.length > 70 ? '…' : ''}</span> : l.lastSyncAt ? `synced ${fmtWhen(l.lastSyncAt)}` : 'not synced yet'}
                              </div>
                              <span className="mc-link-a">
                                <button type="button" className="ob-link" onClick={() => setLinkFor(x.clientId)}>Change</button>
                                <button type="button" className="ob-link fn-del" disabled={busy !== null} onClick={() => {
                                  if (!window.confirm(`Unlink ${l.accountName ?? l.accountId} from ${x.clientName}? Results already pulled in stay.`)) return;
                                  run(`un-${x.clientId}`, async () => { setC(await backend.unlinkMetaAccount(x.clientId, l.accountId)); toast('Unlinked.'); });
                                }}>Unlink</button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="num mc-row-a">
                      <button type="button" className="btn sm" onClick={() => setLinkFor(x.clientId)}>{x.links.length ? '+ Link another' : '+ Link ad account'}</button>
                      {x.links.length > 0 && <button type="button" className="btn sm" disabled={busy !== null} onClick={() => sync(x.clientId, x.clientName)}>{busy === `sync-${x.clientId}` ? 'Syncing…' : 'Sync now'}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ap-hint">Linking pulls in the last 90 days. After that, each sync updates the last 7 days, because Meta keeps adjusting recent numbers. Clients&apos; own Meta ads pages also refresh when they open them.</p>
        </section>
      )}

      {target && (
        <LinkAccount client={target} connections={c.connections} onClose={() => setLinkFor(null)}
          onLinked={async (next) => {
            setC(next); setLinkFor(null);
            toast('Linked. Pulling in results…');
            await sync(target.clientId, target.clientName);
          }} />
      )}
    </div>
  );
}

function ConnRow({ k, busy, run, setC, load }: { k: Conn; busy: string | null; run: (key: string, fn: () => Promise<void>) => Promise<void>; setC: (c: MetaConnectionPublic) => void; load: () => Promise<void> }) {
  const { toast } = useData();
  const [replacing, setReplacing] = useState(false);
  return (
    <div className="mc-conn-row">
      <div className="mc-conn-h">
        <span className={`mc-dot${k.error ? '' : ' on'}`} aria-hidden="true" />
        <div className="mc-conn-t">
          <b>{k.label}</b>
          <span>Connected as {k.name} · {k.accounts.length} ad account{k.accounts.length === 1 ? '' : 's'} · list refreshed {fmtWhen(k.refreshedAt)}</span>
          {k.error && <span className="mc-err">Last error: {k.error}</span>}
        </div>
        {!replacing && (
          <span className="mc-conn-a">
            <button type="button" className="ob-link" onClick={() => setReplacing(true)}>Rename or replace token</button>
            <button type="button" className="ob-link fn-del" disabled={busy !== null} onClick={() => {
              if (!window.confirm(`Remove the “${k.label}” connection? Clients linked through it stop updating until they're linked through another connection. Results already pulled in stay.`)) return;
              run(`disc-${k.id}`, async () => { await backend.disconnectMeta(k.id); await load(); toast('Connection removed.'); });
            }}>Remove</button>
          </span>
        )}
      </div>
      {replacing && <ConnForm existing={k} onCancel={() => setReplacing(false)} onDone={(next) => { setC(next); setReplacing(false); }} />}
    </div>
  );
}

/** Add a connection, or rename one / replace its token. */
function ConnForm({ existing, first, onCancel, onDone }: { existing?: Conn; first?: boolean; onCancel?: () => void; onDone: (c: MetaConnectionPublic) => void }) {
  const { toast } = useData();
  const [label, setLabel] = useState(existing?.label ?? (first ? 'REPS Business Manager' : ''));
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const before = new Set<string>();
      const next = await backend.connectMeta({ id: existing?.id, label, token: token.trim() || undefined });
      const k = existing ? next.connections.find((x) => x.id === existing.id) : next.connections.find((x) => !before.has(x.id) && x.label === (label.trim() || x.label)) ?? next.connections[next.connections.length - 1];
      toast(existing && !token.trim() ? 'Renamed.' : `Connected. ${k?.accounts.length ?? 0} ad account${k?.accounts.length === 1 ? '' : 's'} found.`);
      onDone(next);
    } catch (x) { toast(x instanceof Error ? x.message : 'Could not connect.'); } finally { setBusy(false); }
  };
  return (
    <form className="mc-form" onSubmit={submit}>
      <input className="ob-input mc-label" placeholder="Name, e.g. REPS Business Manager" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Connection name" />
      <input className="ob-input sp-mono" type="password" autoComplete="off" spellCheck={false} placeholder={existing ? 'New token (leave blank to just rename)' : 'System User access token, starts EAA…'} value={token} onChange={(e) => setToken(e.target.value)} aria-label="Meta access token" />
      <button type="submit" className="btn gold" disabled={busy || (!existing && !token.trim())}>{busy ? 'Checking…' : existing ? 'Save' : 'Connect'}</button>
      {onCancel && <button type="button" className="ob-link" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

/** Pick an ad account (from any connection) for a client, with an optional campaign filter. */
export function LinkAccount({ client, connections, onClose, onLinked }: {
  client: MetaConnectionPublic['clients'][number]; connections: Conn[]; onClose: () => void; onLinked: (c: MetaConnectionPublic) => void;
}) {
  const { toast } = useData();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<{ connectionId: string; accountId: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const linkedHere = new Map(client.links.map((l) => [l.accountId, l]));
  // Likely matches first: accounts whose name shares a word with the client's name.
  const words = useMemo(() => client.clientName.toLowerCase().split(/\W+/).filter((w) => w.length > 2), [client.clientName]);
  const options = connections.flatMap((k) => k.accounts.map((a) => ({ ...a, connectionId: k.id, connectionLabel: k.label })))
    .filter((a) => !q.trim() || `${a.name} ${a.id} ${a.business ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .map((a) => ({ ...a, score: (linkedHere.has(a.id) ? 2 : 0) + (words.some((w) => `${a.name} ${a.business ?? ''}`.toLowerCase().includes(w)) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const choose = (connectionId: string, accountId: string) => { setPick({ connectionId, accountId }); setFilter(linkedHere.get(accountId)?.filter ?? ''); };
  const save = async () => {
    if (!pick) return;
    setBusy(true);
    try { onLinked(await backend.linkMetaAccount(client.clientId, { ...pick, filter })); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not link it.'); setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal lg-modal mc-modal" role="dialog" aria-modal="true" aria-labelledby="mc-link-t">
        <div id="mc-link-t" className="m-t">Link an ad account to {client.clientName}</div>
        <input className="ob-input" placeholder="Search ad accounts by name, ID or business" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search ad accounts" />
        <div className="mc-pick-list" role="listbox" aria-label="Ad accounts">
          {!options.length && <p className="cm-none">No ad accounts match. If one is missing, assign it to the System User in Business Settings, then Refresh accounts.</p>}
          {options.map((a) => {
            const on = pick?.accountId === a.id && pick.connectionId === a.connectionId;
            return (
              <button key={`${a.connectionId}-${a.id}`} type="button" role="option" aria-selected={on} className={`mc-opt${on ? ' on' : ''}`} onClick={() => choose(a.connectionId, a.id)}>
                <span className="mc-opt-t"><b>{a.name}</b>{linkedHere.has(a.id) && <span className="fn-tag">Linked</span>}</span>
                <span className="mc-sub">{a.id}{a.business ? ` · ${a.business}` : ''} · {a.currency}{connections.length > 1 ? ` · ${a.connectionLabel}` : ''}</span>
                <span className={`stbadge sm ${a.status === 'active' ? 'st-approved' : 'st-review'}`}>{STATUS[a.status] ?? a.status}</span>
              </button>
            );
          })}
        </div>
        {pick && (
          <label className="ae-f"><span>Only campaigns containing (optional)</span>
            <input className="ob-input" placeholder="e.g. Dailey" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <span className="ap-hint">Use this when one ad account runs ads for several clients. Only campaigns whose name contains this go to {client.clientName}. Leave blank for the whole account.</span>
          </label>
        )}
        <div className="cp-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn gold" disabled={!pick || busy} onClick={save}>{busy ? 'Linking…' : linkedHere.has(pick?.accountId ?? '') ? 'Save' : 'Link'}</button>
        </div>
      </div>
    </div>
  );
}

/** What to do in Meta to get a token. */
function Setup() {
  return (
    <section className="fn-panel mc-setup">
      <div className="fn-ph">Getting the token (once, about 15 minutes)</div>
      <ol>
        <li>In <b>Meta Business Settings</b> (business.facebook.com/settings), go to <b>Users › System users</b> and add one, e.g. “REPS Dashboard”, with the <b>Admin</b> role.</li>
        <li>In <b>Meta for Developers</b> (developers.facebook.com/apps), create an app of type <b>Business</b>, connected to the same Business Manager.</li>
        <li>Back in Business Settings, under <b>Accounts › Apps</b>, add that app to the System User.</li>
        <li>Under <b>Accounts › Ad accounts</b>, assign each client&apos;s ad account to the System User with at least <b>View performance</b>.</li>
        <li>On the System User, click <b>Generate new token</b>, pick the app, set expiry to <b>Never</b>, tick <b>ads_read</b> (and <b>business_management</b>), then copy the token.</li>
        <li>Paste it above and click <b>Connect</b>. Then link each client to their ad accounts.</li>
      </ol>
      <p className="ap-hint">Client ad accounts only show if they&apos;re shared with your Business Manager (not just your personal profile). If one is missing, ask the client to add your Business Manager as a partner on their ad account.</p>
    </section>
  );
}
