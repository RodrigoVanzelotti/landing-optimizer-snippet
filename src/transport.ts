import { LIMITS } from './config';
import type { EventEnvelope, SdkConfig, WireContext, WireEvent } from './types';

/**
 * Buffers events and flushes them to the ingestion edge. Fire-and-forget:
 * uses `navigator.sendBeacon` where possible, falling back to `fetch` with
 * `keepalive`. Never blocks the page and never throws to callers.
 */
export class Transport {
  private buffer: WireEvent[] = [];
  private context: WireContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: SdkConfig,
    private readonly ctx: () => WireContext,
    private readonly sid: () => string,
    private readonly eventBaseAt?: number,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), LIMITS.flushIntervalMs);
    // Flush on page hide / unload so we don't lose the tail of a session.
    const flushNow = (): void => this.flush(true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow();
    });
    window.addEventListener('pagehide', flushNow);
  }

  enqueue(event: WireEvent, eventPath: string): void {
    const path = eventPath.slice(0, 512);
    if (this.context && this.context.path !== path) this.flush();
    this.context ??= { ...this.ctx(), path };
    this.buffer.push(event);
    if (this.buffer.length >= LIMITS.batchMaxEvents) this.flush();
  }

  flush(useBeacon = false): void {
    if (!this.context || this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, LIMITS.batchMaxEvents);
    const envelope: EventEnvelope = {
      v: 1,
      siteId: this.config.siteId,
      ik: this.config.ingestKey,
      sid: this.sid(),
      sentAt: Date.now(),
      ...(this.eventBaseAt === undefined ? {} : { eventBaseAt: this.eventBaseAt }),
      ctx: this.context,
      events: batch,
    };
    this.context = null;
    this.send(envelope, useBeacon);
  }

  private send(envelope: EventEnvelope, useBeacon: boolean): void {
    let body: string;
    try {
      body = JSON.stringify(envelope);
    } catch {
      return; // never let serialization break the page
    }

    try {
      if (useBeacon && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(this.config.ingestUrl, blob);
        if (ok) return;
      }
    } catch {
      /* fall through to fetch */
    }

    try {
      void fetch(this.config.ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
        mode: 'cors',
      }).catch(() => undefined);
    } catch {
      /* fail silently — analytics must never break the host page */
    }
  }
}
