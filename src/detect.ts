import type { BrowserCategory, DeviceCategory } from './types';

/**
 * Coarse, non-identifying environment detection. Everything here is a category,
 * never a fingerprint. We deliberately avoid canvas/font/plugin probing.
 */

export function detectDevice(): DeviceCategory {
  const ua = navigator.userAgent;
  if (/\b(iPad|Tablet)\b/i.test(ua) || (/\bAndroid\b/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet';
  }
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile';
  // Fall back to viewport width heuristic.
  const w = window.innerWidth || 1024;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function detectBrowser(): BrowserCategory {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\/|CriOS|Chromium/.test(ua)) return 'chromium';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';
  return 'other';
}

/**
 * Aggregate bot / AI-crawler heuristic. Used only to segment traffic in
 * analytics — never to profile a visitor.
 */
export function detectBot(): boolean {
  const ua = navigator.userAgent;
  const botRe =
    /(bot|crawler|spider|crawl|slurp|bingpreview|headless|phantom|puppeteer|playwright|python-requests|curl|wget|gptbot|claudebot|ccbot|anthropic|perplexity|google-extended)/i;
  if (botRe.test(ua)) return true;
  // webdriver flag is a strong signal of automation.
  if ((navigator as unknown as { webdriver?: boolean }).webdriver === true) return true;
  return false;
}

/** Two-letter language only (e.g. "en"), never region/locale specifics. */
export function detectLanguage(): string {
  const lang = navigator.language || 'en';
  return lang.slice(0, 2).toLowerCase();
}

/** Referrer host only; empty string if same-origin or unavailable. */
export function referrerHost(): string {
  try {
    if (!document.referrer) return '';
    const u = new URL(document.referrer);
    if (u.host === location.host) return '';
    return u.host;
  } catch {
    return '';
  }
}

/** Pathname only — the query string and hash are intentionally discarded. */
export function currentPath(): string {
  return location.pathname || '/';
}

/** Bucketed viewport to avoid precise fingerprinting. */
export function viewportBucket(): [number, number] {
  const bucket = (n: number): number => Math.round(n / 40) * 40;
  return [bucket(window.innerWidth || 0), bucket(window.innerHeight || 0)];
}
