import type { SiteConfig } from './types';

const opaqueId = /^[A-Za-z0-9_-]{1,128}$/;

/** Relay one configured event without reading or forwarding the rest of the data layer. */
export function connectDataLayer(rule: NonNullable<NonNullable<SiteConfig['journey']>['globalEvent']>,
  emit: (goal: string, transactionId?: string) => void): void {
  const host = window as Window & { dataLayer?: unknown[] };
  const layer = host.dataLayer ?? (host.dataLayer = []);
  if (!Array.isArray(layer)) return;
  const seen = new WeakSet<object>();
  const relay = (entry: unknown): void => {
    if (!entry || typeof entry !== 'object' || seen.has(entry)) return;
    const { event, ecommerce, transaction_id, event_id } = entry as Record<string, unknown>;
    if (event !== rule.source) return;
    const id = (ecommerce as { transaction_id?: unknown } | null)?.transaction_id ?? transaction_id ?? event_id;
    const candidate = typeof id === 'number' && Number.isSafeInteger(id) && id >= 0 ? String(id) : id;
    const transactionId = typeof candidate === 'string' && opaqueId.test(candidate) ? candidate : undefined;
    if (rule.source === 'purchase' && !transactionId) return;
    seen.add(entry);
    emit(rule.goal, transactionId);
  };
  const push = layer.push;
  layer.push = function (...entries: unknown[]): number {
    const result = push.apply(this, entries);
    for (const entry of entries) {
      try { relay(entry); } catch { /* analytics must not affect the host */ }
    }
    return result;
  };
  for (const entry of layer.slice()) relay(entry);
}
