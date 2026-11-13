import { buildPageMap } from './pagemap';
import type { NodeRect, SdkConfig, SnapshotEnvelope, SnapshotNode } from './types';

/**
 * Operator-only page snapshot capture (`lo-capture.js`).
 *
 * This module is a SEPARATE bundle that the core SDK lazy-loads only when the
 * page is opened with `?lo_capture=1` — real visitors never download or
 * execute it, so the core bundle stays small. It rasterizes the current page
 * (via SVG foreignObject, no external dependency), records the document-space
 * bounding box of every page-map node, and downloads a file for dashboard upload.
 * The screenshot + element geometry pair is what the dashboard heatmap draws
 * its layers on, so heat zones stay aligned with the image forever.
 *
 * Privacy: form values are cleared, password inputs and `[data-lo-ignore]`
 * elements become empty layout placeholders, and cross-origin
 * images that cannot be read are replaced with neutral placeholders.
 */

const MAX_IMAGE_BASE64_CHARS = 4_000_000; // ~3 MB decoded
const MAX_DOC_HEIGHT_PX = 15000;
const MAX_RENDER_WIDTH_PX = 1400;
const MAX_STYLED_ELEMENTS = 4000;
const MAX_NODES = 150;

/** Collect document-space rects for page-map nodes; drops invisible nodes. */
export function collectNodeRects(
  nodes: Array<{ selector: string; role: string }>,
): SnapshotNode[] {
  const out: SnapshotNode[] = [];
  for (const node of nodes) {
    if (out.length >= MAX_NODES) break;
    let el: Element | null = null;
    try {
      el = document.querySelector(node.selector);
    } catch {
      continue;
    }
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    // Clamp to the wire contract: coordinates non-negative, sizes ≥ 1px
    // (a single out-of-range node would reject the whole envelope).
    const rect: NodeRect = [
      Math.max(0, Math.round(r.left + window.scrollX)),
      Math.max(0, Math.round(r.top + window.scrollY)),
      Math.max(1, Math.round(r.width)),
      Math.max(1, Math.round(r.height)),
    ];
    out.push({ selector: node.selector, role: node.role, rect });
  }
  return out;
}

async function capture(config: SdkConfig): Promise<void> {
  const badge = showBadge('Landing Optimizer: preparando captura…');
  try {
    await settle();

    const map = buildPageMap();
    const nodes = collectNodeRects(map.nodes);

    const doc = document.documentElement;
    const width = clamp(doc.scrollWidth || window.innerWidth, 320, 2000);
    const height = clamp(doc.scrollHeight || window.innerHeight, 200, MAX_DOC_HEIGHT_PX);

    const image = await rasterize(width, height);
    if (!image) {
      badge.textContent = 'Landing Optimizer: não foi possível gerar a imagem. Recarregue para tentar novamente.';
      return;
    }

    const envelope: SnapshotEnvelope = {
      v: 1,
      siteId: config.siteId,
      path: location.pathname || '/',
      width,
      height,
      contentType: image.contentType,
      image: image.base64,
      nodes,
    };

    const url = URL.createObjectURL(new Blob([JSON.stringify(envelope)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'landing-optimizer-captura.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    badge.textContent = 'Landing Optimizer: arquivo de captura baixado. Entre no dashboard e envie o arquivo em Experiência do usuário.';
  } catch {
    badge.textContent = 'Landing Optimizer: falha na captura. Confira sua conexão e recarregue para tentar novamente.';
  } finally {
    setTimeout(() => badge.remove(), 8000);
  }
}

interface RasterResult {
  base64: string;
  contentType: SnapshotEnvelope['contentType'];
}

async function rasterize(width: number, height: number): Promise<RasterResult | null> {
  const svg = buildSvgSnapshot(width, height);
  if (!svg) return null;

  const img = await loadSvgImage(svg);
  if (!img) return null;

  // Try progressively smaller scales until the payload fits the cap.
  for (const scale of [Math.min(1, MAX_RENDER_WIDTH_PX / width), 0.75, 0.5]) {
    const dataUrl = drawToDataUrl(img, width, height, scale);
    if (!dataUrl) continue;
    const comma = dataUrl.indexOf(',');
    const base64 = dataUrl.slice(comma + 1);
    if (base64.length > MAX_IMAGE_BASE64_CHARS) continue;
    const contentType = dataUrl.startsWith('data:image/webp')
      ? 'image/webp'
      : dataUrl.startsWith('data:image/jpeg')
        ? 'image/jpeg'
        : 'image/png';
    return { base64, contentType };
  }
  return null;
}

function drawToDataUrl(
  img: HTMLImageElement,
  width: number,
  height: number,
  scale: number,
): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Prefer webp; browsers without webp encoding silently return png.
    const webp = canvas.toDataURL('image/webp', 0.8);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL('image/png');
  } catch {
    return null; // tainted canvas or encoding failure
  }
}

function buildSvgSnapshot(width: number, height: number): string | null {
  try {
    const source = document.documentElement;
    const clone = source.cloneNode(true) as HTMLElement;

    // Order matters: styles and images are matched to the live tree by
    // document order, so both must run before scrubbing mutates the clone.
    inlineStyles(source, clone);
    inlineImages(source, clone);
    scrubClone(source, clone);

    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    const html = new XMLSerializer().serializeToString(clone);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">${html}</foreignObject></svg>`
    );
  } catch {
    return null;
  }
}

/**
 * Copy computed styles from the live tree onto the clone as inline styles so
 * the rasterized document does not depend on external stylesheets (which do
 * not load inside an SVG image context). Best-effort and element-capped.
 */
function inlineStyles(source: Element, clone: Element): void {
  const src = walk(source);
  const dst = walk(clone);
  const count = Math.min(src.length, dst.length, MAX_STYLED_ELEMENTS);
  for (let i = 0; i < count; i++) {
    const from = src[i];
    const to = dst[i];
    if (!from || !to || !(to instanceof HTMLElement || to instanceof SVGElement)) continue;
    try {
      const computed = window.getComputedStyle(from);
      let cssText = computed.cssText;
      if (!cssText) {
        // Firefox returns '' for cssText on computed styles; rebuild it.
        const parts: string[] = [];
        for (let p = 0; p < computed.length; p++) {
          const prop = computed.item(p);
          parts.push(`${prop}:${computed.getPropertyValue(prop)};`);
        }
        cssText = parts.join('');
      }
      to.setAttribute('style', cssText);
    } catch {
      /* skip element */
    }
  }
}

/** Document-order element list; clone and source share order before scrubbing. */
function walk(root: Element): Element[] {
  const out: Element[] = [root];
  const els = root.querySelectorAll('*');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el) out.push(el);
  }
  return out;
}

/** Remove active/sensitive content from the clone. Runs after style inlining. */
function scrubClone(source: HTMLElement, clone: HTMLElement): void {
  const originals = walk(source);
  // Keep the original boxes: deleting private/media nodes moves the screenshot away from its rects.
  walk(clone).forEach((el, index) => {
    if (!el.matches('iframe, video, audio, canvas, [data-lo-ignore], input[type="password"], input[type="hidden"]')) return;
    const original = originals[index];
    if (!original) return;
    const placeholder = document.createElement(original instanceof HTMLInputElement ? 'input' : 'div');
    placeholder.setAttribute('style', el.getAttribute('style') ?? '');
    if (window.getComputedStyle(original).display === 'inline') {
      const rect = original.getBoundingClientRect();
      placeholder.style.display = 'inline-block';
      placeholder.style.boxSizing = 'border-box';
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      if (!original.matches('iframe, video, audio, canvas')) placeholder.textContent = '\u00a0';
    }
    placeholder.style.setProperty('visibility', 'hidden', 'important');
    el.replaceWith(placeholder);
  });
  clone.querySelectorAll('script, noscript').forEach((el) => el.remove());
  clone.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el instanceof HTMLInputElement) {
      el.removeAttribute('value');
      el.removeAttribute('checked');
    }
    if (el instanceof HTMLTextAreaElement) el.textContent = '';
    if (el instanceof HTMLSelectElement) {
      el.querySelectorAll('option').forEach((o) => o.removeAttribute('selected'));
    }
  });
}

/**
 * Replace every `img` src in the clone with an inlined data URL read from the
 * live image. Cross-origin images that taint the canvas become neutral
 * placeholders instead of failing the whole snapshot.
 */
function inlineImages(source: Element, clone: Element): void {
  const srcImgs = Array.from(source.querySelectorAll('img'));
  const dstImgs = Array.from(clone.querySelectorAll('img'));
  // Runs before scrubbing, so both trees share document order 1:1.
  const count = Math.min(srcImgs.length, dstImgs.length);
  for (let i = 0; i < count; i++) {
    const from = srcImgs[i];
    const to = dstImgs[i];
    if (!from || !to) continue;
    to.removeAttribute('srcset');
    to.removeAttribute('loading');
    const inlined = imageToDataUrl(from);
    if (inlined) {
      to.setAttribute('src', inlined);
    } else {
      to.removeAttribute('src');
      const w = from.width || 1;
      const h = from.height || 1;
      to.setAttribute(
        'style',
        `${to.getAttribute('style') ?? ''};background:#e5e7eb;width:${w}px;height:${h}px;`,
      );
    }
  }
}

function imageToDataUrl(img: HTMLImageElement): string | null {
  try {
    if (!img.complete || img.naturalWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null; // cross-origin without CORS — caller substitutes placeholder
  }
}

function loadSvgImage(svg: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const done = (result: HTMLImageElement | null): void => {
        clearTimeout(timer);
        resolve(result);
      };
      img.onload = () => done(img);
      img.onerror = () => done(null);
      const timer = setTimeout(() => done(null), 15000);
      // Chromium taints canvases drawn from blob-backed SVG foreignObject images.
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch {
      resolve(null);
    }
  });
}

/** Wait for full load plus a short settle so late images/layout are included. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    const after = (): void => {
      setTimeout(resolve, 400);
    };
    if (document.readyState === 'complete') after();
    else window.addEventListener('load', after, { once: true });
  });
}

function showBadge(text: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-lo-ignore', '');
  el.setAttribute('role', 'status');
  el.textContent = text;
  el.setAttribute(
    'style',
    'position:fixed;top:12px;right:12px;z-index:2147483647;background:#111827;' +
      'color:#fff;padding:8px 12px;border-radius:8px;font:12px/1.4 system-ui,sans-serif;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;',
  );
  try {
    document.body.appendChild(el);
  } catch {
    /* body may not exist yet; badge is cosmetic */
  }
  return el;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Install the entry point the core SDK calls after lazy-loading this bundle.
if (typeof window !== 'undefined') {
  window.__loCapture = (config: SdkConfig): void => {
    void capture(config);
  };
}
