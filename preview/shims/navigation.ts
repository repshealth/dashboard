// Stand-in for next/navigation in the single-file preview. Routing is held in memory,
// with a plain #token (#leads, #website) so a link can open a specific screen.
import { useSyncExternalStore } from 'react';

const fromHash = () => {
  try {
    const t = window.location.hash.replace(/^#\/?/, '');
    return t ? '/' + t : '/agency';
  } catch {
    return '/agency';
  }
};

let path = typeof window === 'undefined' ? '/agency' : fromHash();
const subs = new Set<() => void>();

export function navigate(to: string) {
  path = to === '/' ? '/agency' : to;
  try { history.replaceState(null, '', '#' + path.slice(1)); } catch {}
  subs.forEach((f) => f());
  try { window.scrollTo({ top: 0 }); } catch {}
}

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

export function usePathname() {
  return useSyncExternalStore(subscribe, () => path, () => path);
}

const router = { push: navigate, replace: navigate, back() {}, forward() {}, refresh() {}, prefetch() {} };
export function useRouter() {
  return router;
}

export function redirect(to: string): never {
  navigate(to);
  throw new Error('redirect');
}
