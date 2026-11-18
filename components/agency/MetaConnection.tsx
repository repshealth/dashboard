'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import type { MetaConnectionPublic } from '@/lib/ads/types';

const STATUS: Record<string, string> = { active: 'Active', disabled: 'Disabled', unsettled: 'Payment due', closed: 'Closed', other: 'Not active' };

/**
 * Agency only: one Meta connection (a System User token from the REPS Business Manager) for every
 * client. Each ad account it can see is matched to a client, and that client's Meta ads fill in.
 */
export default function MetaConnection() {
  const { clients, toast } = useData();
  const [c, setC] = useState<MetaConnectionPublic | null>(null);
  const [err, setErr] = useState('');
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { setC(await backend.getMetaConnection()); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the Meta connection.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(null); }
  };

  const connect = (e: FormEvent) => {
    e.preventDefault();
    run('connect', async () => {
      const next = await backend.connectMeta(token);
      setC(next); setToken(''); setReplacing(false);
      toast(`Connected to Meta. ${next.accounts.length} ad account${next.accounts.length === 1 ? '' : 's'} found.`);
    });
  };

  const link = (accountId: string, clientId: string, name: string) => run(`link-${accountId}`, async () => {
    const holder = c?.accounts.find((a) => a.clientId === clientId && a.id !== accountId);
    if (holder && !window.confirm(`${clients.find((x) => x.id === clientId)?.name} is linked to ${holder.name}. Link it to ${name} instead?`)) return;
    setC(await backend.linkMetaAccount(accountId, clientId));
    if (!clientId) { toast('Unlinked. Results already pulled in stay on the client’s account.'); return; }
    toast('Linked. Pulling in the last 90 days…');
    try {
      const r = await backend.syncMetaAds(clientId);
      toast(`Pulled in ${r.rows} row${r.rows === 1 ? '' : 's'} of results.`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Linked, but the first sync failed.'); }
    await load();
  });

  const sync = (clientId: string) => run(`sync-${clientId}`, async () => {
    const r = await backend.syncMetaAds(clientId);
    toast(`Synced. ${r.rows} row${r.rows === 1 ? '' : 's'} updated.`);
    await load();
  });

  const syncAll = () => run('all', async () => {
    const linked = c?.accounts.filter((a) => a.clientId) ?? [];
    let ok = 0; const failed: string[] = [];
    for (const a of linked) {
      try { await backend.syncMetaAds(a.clientId!); ok++; } catch { failed.push(a.clientName ?? a.name); }
    }
    await load();
    toast(failed.length ? `Synced ${ok}. Couldn’t sync ${failed.join(', ')}.` : `Synced all ${ok} linked account${ok === 1 ? '' : 's'}.`);
  });

  if (err) return <div className="view"><div className="form-msg err">{err}</div></div>;
  if (!c) return <div className="loading">Loading…</div>;

  const linked = c.accounts.filter((a) => a.clientId).length;
  const shown = c.accounts.filter((a) => !q.trim() || `${a.name} ${a.id} ${a.business ?? ''} ${a.clientName ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const used = new Map(c.accounts.filter((a) => a.clientId).map((a) => [a.clientId!, a.name]));

  return (
    <div className="view">
      <header>
        <div>
          <h1>Meta connection</h1>
          <p className="sub">Connect the REPS Meta account once, then pick which client each ad account belongs to. Their results show in that client&apos;s Meta ads section.</p>
        </div>
        {c.connected && (
          <div className="actions">
            <button type="button" className="btn" disabled={busy !== null} onClick={() => run('refresh', async () => { setC(await backend.refreshMetaAccounts()); toast('Ad account list refreshed.'); })}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh accounts'}</button>
            {linked > 0 && <button type="button" className="btn gold" disabled={busy !== null} onClick={syncAll}>{busy === 'all' ? 'Syncing…' : `Sync all ${linked}`}</button>}
          </div>
        )}
      </header>

      <section className="fn-panel mc-conn">
        <div className="mc-conn-h">
          <span className={`mc-dot${c.connected ? ' on' : ''}`} aria-hidden="true" />
          <div className="mc-conn-t">
            <b>{c.connected ? `Connected as ${c.name}` : 'Not connected'}</b>
            <span>{c.connected
              ? `Since ${fmtWhen(c.connectedAt ?? '')}. ${c.accounts.length} ad account${c.accounts.length === 1 ? '' : 's'} found, ${linked} linked to a client. List refreshed ${fmtWhen(c.refreshedAt ?? '')}.`
              : 'Paste a System User access token from your Meta Business Manager. It’s stored on the server and never shown to clients.'}</span>
            {c.error && <span className="mc-err">Last error: {c.error}</span>}
          </div>
          {c.connected && !replacing && (
            <span className="mc-conn-a">
              <button type="button" className="ob-link" onClick={() => setReplacing(true)}>Replace token</button>
              <button type="button" className="ob-link fn-del" disabled={busy !== null} onClick={() => {
                if (!window.confirm('Disconnect Meta? Results already pulled in stay, and the client links are remembered for when you reconnect.')) return;
                run('disc', async () => { await backend.disconnectMeta(); await load(); toast('Disconnected from Meta.'); });
              }}>Disconnect</button>
            </span>
          )}
        </div>
        {(!c.connected || replacing) && (
          <form className="mc-form" onSubmit={connect}>
            <input className="ob-input sp-mono" type="password" autoComplete="off" spellCheck={false} placeholder="EAA…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Meta access token" />
            <button type="submit" className="btn gold" disabled={!token.trim() || busy !== null}>{busy === 'connect' ? 'Checking…' : c.connected ? 'Save new token' : 'Connect'}</button>
            {replacing && <button type="button" className="ob-link" onClick={() => { setReplacing(false); setToken(''); }}>Cancel</button>}
          </form>
        )}
      </section>

      {!c.connected ? <Setup /> : (
        <section className="fn-panel">
          <div className="fn-ph">
            Ad accounts
            {c.accounts.length > 8 && <input className="ob-input mc-search" placeholder="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ad accounts" />}
          </div>
          {!c.accounts.length ? (
            <p className="cm-none">The token can&apos;t see any ad accounts. In Business Settings, assign the ad accounts to the System User (with at least “View performance”), then click Refresh accounts.</p>
          ) : (
            <div className="ad-scroll">
              <table className="ad-table mc-table">
                <thead><tr><th>AD ACCOUNT</th><th>STATUS</th><th>CLIENT ON THE DASHBOARD</th><th>LAST SYNC</th><th /></tr></thead>
                <tbody>
                  {shown.map((a) => (
                    <tr key={a.id} className={a.clientId ? 'mc-linked' : ''}>
                      <td>
                        <div className="mc-name">{a.name}</div>
                        <div className="mc-sub">{a.id}{a.business ? ` · ${a.business}` : ''} · {a.currency}</div>
                      </td>
                      <td><span className={`stbadge sm ${a.status === 'active' ? 'st-approved' : 'st-review'}`}>{STATUS[a.status] ?? a.status}</span></td>
                      <td>
                        <select className="ob-input mc-pick" value={a.clientId ?? ''} disabled={busy !== null} aria-label={`Client for ${a.name}`}
                          onChange={(e) => link(a.id, e.target.value, a.name)}>
                          <option value="">Not linked</option>
                          {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}{used.has(cl.id) && used.get(cl.id) !== a.name ? ` (linked to ${used.get(cl.id)})` : ''}</option>)}
                        </select>
                      </td>
                      <td className="mc-sync">
                        {a.lastSyncError ? <span className="mc-err" title={a.lastSyncError}>Failed: {a.lastSyncError.slice(0, 60)}{a.lastSyncError.length > 60 ? '…' : ''}</span>
                          : a.lastSyncAt ? fmtWhen(a.lastSyncAt) : a.clientId ? 'Not yet' : '–'}
                      </td>
                      <td className="num">
                        {a.clientId && <button type="button" className="btn sm" disabled={busy !== null} onClick={() => sync(a.clientId!)}>{busy === `sync-${a.clientId}` ? 'Syncing…' : 'Sync now'}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="ap-hint">Linking pulls in the last 90 days. After that, each sync updates the last 7 days, because Meta keeps adjusting recent numbers. Clients&apos; own Meta ads pages also refresh when they open them. A client missing from this list? Their ad account needs sharing with your Business Manager and assigning to the System User.</p>
        </section>
      )}
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
        <li>Paste it above and click <b>Connect</b>. Every ad account it can see is listed so you can link each one to a client.</li>
      </ol>
      <p className="ap-hint">Client ad accounts only show if they&apos;re shared with your Business Manager (not just your personal profile). If one is missing, ask the client to add your Business Manager as a partner on their ad account.</p>
    </section>
  );
}
