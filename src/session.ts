import { LIMITS } from './config';

/**
 * Short-lived, opaque session identifier.
 *
 * Privacy properties:
 *  - Random (crypto), not derived from any device/user attribute.
 *  - Stored in `sessionStorage` (per-tab, per-origin) so it cannot follow the
 *    visitor across sites and disappears when the tab closes.
 *  - Expires after a short idle TTL; a new id is minted afterwards.
 *  - Never persisted to a cookie or localStorage → not a long-term identifier.
 */

const KEY = '__lo_sid';
const TS_KEY = '__lo_sid_ts';

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function store(): Store | null {
  try {
    // Touch to trigger any access exceptions (e.g. blocked storage).
    const s = window.sessionStorage;
    const probe = '__lo_probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function getSessionId(): string {
  const s = store();
  const now = Date.now();

  if (!s) {
    // Storage unavailable: use an in-memory ephemeral id for this page only.
    return memorySid();
  }

  const existing = s.getItem(KEY);
  const tsRaw = s.getItem(TS_KEY);
  const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
  const fresh = existing && now - ts < LIMITS.sessionTtlMs;

  if (fresh && existing) {
    s.setItem(TS_KEY, String(now));
    return existing;
  }

  const sid = mint();
  s.setItem(KEY, sid);
  s.setItem(TS_KEY, String(now));
  return sid;
}

let _mem: string | null = null;
function memorySid(): string {
  if (!_mem) _mem = mint();
  return _mem;
}

function mint(): string {
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return 's_' + hex;
}
