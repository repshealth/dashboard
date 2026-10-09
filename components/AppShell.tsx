'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DataProvider, useData } from './DataProvider';

const NAV = [
  {
    href: '/leads',
    label: 'Leads',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="2.5" width="3.5" height="11" rx="1" /><rect x="6.25" y="2.5" width="3.5" height="7" rx="1" /><rect x="11" y="2.5" width="3.5" height="9" rx="1" />
      </svg>
    ),
  },
  {
    href: '/website',
    label: 'Website',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M1.5 5.5h13" />
      </svg>
    ),
  },
  {
    href: '/emails',
    label: 'Emails',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" /><path d="M2 4l6 4.8L14 4" />
      </svg>
    ),
  },
  {
    href: '/meetings',
    label: 'Meetings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="4" width="9" height="8" rx="1.5" /><path d="M10.5 7l4-2.5v7l-4-2.5" />
      </svg>
    ),
  },
];

const AGENCY_NAV = [
  {
    href: '/agency',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M2 13.5h12M3.5 11V7.5M6.5 11V4.5M9.5 11V6.5M12.5 11V2.5" />
      </svg>
    ),
  },
  {
    href: '/agency/approvals',
    label: 'Approvals',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M5 8.2l2 2 4-4.2" />
      </svg>
    ),
  },
  {
    href: '/agency/emails',
    label: 'Emails',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" /><path d="M2 4l6 4.8L14 4" />
      </svg>
    ),
  },
  {
    href: '/agency/meetings',
    label: 'Meetings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="1.5" y="4" width="9" height="8" rx="1.5" /><path d="M10.5 7l4-2.5v7l-4-2.5" />
      </svg>
    ),
  },
  {
    href: '/agency/onboarding',
    label: 'Onboarding',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="3" y="1.5" width="10" height="13" rx="1.5" /><path d="M5.5 5h5M5.5 8h5M5.5 11h3" />
      </svg>
    ),
  },
];

const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 3.5l3 3 3-3" /></svg>
);

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

function ClientSwitcher() {
  const { clients, client, setClientId, viewer } = useData();
  const { open, setOpen, ref } = usePopover();
  if (!client) return null;
  // Client logins with a single account just see their own name.
  if (!viewer?.isAdmin || clients.length < 2) return <span className="client-static">{client.name}</span>;
  return (
    <div className="client" ref={ref}>
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="cl">Client</span>
        <span className="cn">{client.name}</span>
        <Chevron />
      </button>
      <div className={`menu${open ? ' open' : ''}`} role="menu">
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            role="menuitem"
            className={c.id === client.id ? 'on' : ''}
            onClick={() => { setClientId(c.id); setOpen(false); }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountMenu() {
  const { viewer, mode, signOut } = useData();
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="acct-wrap" ref={ref}>
      <button type="button" className="acct" aria-label="Account" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="8" cy="5.5" r="2.8" /><path d="M2.5 14c.8-2.7 3-4 5.5-4s4.7 1.3 5.5 4" /></svg>
      </button>
      <div className={`menu acct-menu${open ? ' open' : ''}`} role="menu">
        <div className="who">{viewer?.name}{viewer?.email ? <><br />{viewer.email}</> : null}</div>
        {mode === 'live'
          ? <button type="button" role="menuitem" onClick={signOut}>Sign out</button>
          : <button type="button" role="menuitem" disabled>Example data (no sign in yet)</button>}
      </div>
    </div>
  );
}

/** Copies the public onboarding link, ready to send to a new client. */
function CopyFormLink() {
  const { mode, toast } = useData();
  const [shown, setShown] = useState<string | null>(null);
  if (mode === 'demo') return <p className="nav-note">The shareable link works once the dashboard is online.</p>;
  const url = `${window.location.origin}/onboarding`;
  return (
    <>
      <button type="button" className="nav-copy" onClick={async () => {
        try { await navigator.clipboard.writeText(url); toast('Form link copied. Send it to your new client.'); }
        catch { setShown(url); }
      }}>Copy link to send</button>
      {shown && <input className="nav-url" readOnly value={shown} onFocus={(e) => e.target.select()} aria-label="Onboarding form link" />}
    </>
  );
}

function NavLink({ href, label, icon, exact, count }: { href: string; label: string; icon: ReactNode; exact?: boolean; count?: number }) {
  const pathname = usePathname();
  const on = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
      {icon}{label}
      {count ? <span className="nav-count" aria-label={`${count} waiting`}>{count}</span> : null}
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { ready, error, mode, viewer, client, approvalsCount, emailsCount, meetingsCount } = useData();
  const pathname = usePathname();
  const onAgency = pathname.startsWith('/agency');
  const admin = Boolean(viewer?.isAdmin);
  return (
    <div className={`app${onAgency ? ' agency' : ''}`}>
      <aside className="side">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/reps-logo.png" alt="REPS" />
          <div className="os">SCALING OS</div>
        </div>
        {admin && (
          <nav className="nav" aria-label="Agency">
            <div className="nav-h">AGENCY</div>
            <NavLink {...AGENCY_NAV[0]} exact />
            <NavLink {...AGENCY_NAV[1]} count={approvalsCount} />
            <NavLink {...AGENCY_NAV[2]} count={emailsCount} />
            <NavLink {...AGENCY_NAV[3]} count={meetingsCount} />
            <NavLink {...AGENCY_NAV[4]} />
            <Link href="/onboarding">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
              New client form
            </Link>
            <CopyFormLink />
          </nav>
        )}
        <nav className="nav" aria-label={admin ? 'Client account' : 'Main'}>
          {admin && <div className="nav-h">CLIENT ACCOUNT{client ? <span className="nav-client">{client.name}</span> : null}</div>}
          {NAV.map((n) => <NavLink key={n.href} {...n} />)}
        </nav>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="top-left">
            {onAgency ? <span className="agency-tag">REPS Agency</span> : <ClientSwitcher />}
            {mode === 'demo' && <span className="demo-badge" title="Set NEXT_PUBLIC_LIVE=true in Cloudflare to switch to live data">EXAMPLE DATA</span>}
          </div>
          <AccountMenu />
        </div>
        <main className="content">
          {error ? <div className="loading">Something went wrong loading your dashboard: {error}</div>
            : ready ? children : <div className="loading">Loading…</div>}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
