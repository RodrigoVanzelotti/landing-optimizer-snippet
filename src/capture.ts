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
const MAX_DOC_HEIGHT_PX = 40000;
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
  const scroll = { x: window.scrollX, y: window.scrollY };
  try {
    if (scroll.x || scroll.y) window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    await settle();

    const map = buildPageMap();
    const nodes = collectNodeRects(map.nodes);

    const doc = document.documentElement;
    const width = Math.max(doc.scrollWidth, window.innerWidth);
    const height = Math.max(doc.scrollHeight, window.innerHeight);
    if (width > 4000 || height > MAX_DOC_HEIGHT_PX || walk(doc).length > MAX_STYLED_ELEMENTS) {
      badge.textContent = 'Landing Optimizer: página grande demais para uma captura fiel. Capture uma página menor.';
      return;
    }

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
    if (scroll.x || scroll.y) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
    setTimeout(() => badge.remove(), 8000);
  }
}

interface RasterResult {
  base64: string;
  contentType: SnapshotEnvelope['contentType'];
}

async function rasterize(width: number, height: number): Promise<RasterResult | null> {
  const svg = await buildSvgSnapshot(width, height);
  if (!svg) return null;

  const img = await loadSvgImage(svg);
  if (!img) return null;

  // Try progressively smaller scales until the payload fits the cap.
  const initialScale = Math.min(1, MAX_RENDER_WIDTH_PX / width, Math.sqrt(24_000_000 / (width * height)));
  for (const scale of [initialScale, initialScale * 0.75, initialScale * 0.5]) {
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

async function buildSvgSnapshot(width: number, height: number): Promise<string | null> {
  try {
    const source = document.documentElement;
    const clone = source.cloneNode(true) as HTMLElement;

    // Read styles before sanitizing; fetch resources only after private nodes are gone.
    inlineStyles(source, clone);
    scrubClone(source, clone);
    const resources = new Map<string, Promise<string | null>>();
    await inlineResources(clone, resources);
    await inlineFonts(clone, resources);

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
    if (from.parentElement?.closest('[data-lo-ignore], iframe, video, audio, canvas')) continue;
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
      if (from.matches('[data-lo-ignore], input[type="password"], input[type="hidden"], iframe, video, audio, canvas')) continue;
      if (from instanceof HTMLImageElement && to instanceof HTMLImageElement) {
        to.src = from.currentSrc || from.src;
        to.removeAttribute('srcset');
        to.removeAttribute('loading');
      }
      to.style.setProperty('animation', 'none', 'important');
      to.style.setProperty('transition', 'none', 'important');
      for (const pseudo of ['::before', '::after']) {
        const computedPseudo = window.getComputedStyle(from, pseudo);
        if (!computedPseudo.content || ['none', 'normal', '""'].includes(computedPseudo.content)) continue;
        const className = `lo-capture-${i}-${pseudo.slice(2)}`;
        to.classList.add(className);
        const rule = document.createElement('style');
        rule.setAttribute('data-lo-capture', '');
        const properties = Array.from(computedPseudo).map(prop => `${prop}:${computedPseudo.getPropertyValue(prop)} !important;`).join('');
        rule.textContent = `.${className}${pseudo}{${properties}animation:none !important;transition:none !important;}`;
        clone.appendChild(rule);
      }
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
    placeholder.setAttribute('data-lo-ignore', '');
    for (const property of Array.from(placeholder.style)) {
      if (placeholder.style.getPropertyValue(property).includes('url(')) placeholder.style.removeProperty(property);
    }
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
  clone.querySelectorAll('*').forEach(el => {
    for (const attribute of Array.from(el.attributes)) {
      if (attribute.name.startsWith('on')) el.removeAttribute(attribute.name);
    }
  });
}

function inlineResource(url: string, resources: Map<string, Promise<string | null>>): Promise<string | null> {
  if (url.startsWith('data:')) return Promise.resolve(url);
  const existing = resources.get(url);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.size > 3 * 1024 * 1024) return null;
      return await new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
    finally { clearTimeout(timer); }
  })();
  resources.set(url, request);
  return request;
}

async function inlineCssUrls(css: string, base: string, resources: Map<string, Promise<string | null>>): Promise<string> {
  const matches = Array.from(css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g));
  for (const match of matches) {
    const value = match[2];
    if (!value || value.startsWith('#')) continue;
    const data = await inlineResource(new URL(value, base).href, resources);
    css = css.replace(match[0], data ? `url("${data}")` : 'url("data:,")');
  }
  return css;
}

async function inlineResources(clone: HTMLElement, resources: Map<string, Promise<string | null>>): Promise<void> {
  clone.querySelectorAll('link[rel="stylesheet"], style:not([data-lo-capture])').forEach(el => el.remove());
  await Promise.all(walk(clone).map(async el => {
    if (el instanceof HTMLImageElement && el.getAttribute('src')) {
      const data = await inlineResource(el.src, resources);
      if (data) el.src = data;
      else { el.removeAttribute('src'); el.style.backgroundColor = '#e5e7eb'; }
    }
    const style = el.getAttribute('style');
    if (style?.includes('url(')) el.setAttribute('style', await inlineCssUrls(style, document.baseURI, resources));
    if (el.matches('style[data-lo-capture]')) el.textContent = await inlineCssUrls(el.textContent ?? '', document.baseURI, resources);
  }));
}

async function inlineFonts(clone: HTMLElement, resources: Map<string, Promise<string | null>>): Promise<void> {
  const families = walk(clone).map(el => el instanceof HTMLElement || el instanceof SVGElement ? el.style.fontFamily.toLowerCase() : '').join(',');
  const seen = new Set<CSSStyleSheet>();
  const rules: string[] = [];
  async function visit(sheet: CSSStyleSheet): Promise<void> {
    if (seen.has(sheet)) return;
    seen.add(sheet);
    const base = sheet.href || document.baseURI;
    let cssRules: CSSRuleList;
    try { cssRules = sheet.cssRules; }
    catch {
      if (!sheet.href) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(sheet.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
        if (!response.ok) return;
        const readable = new CSSStyleSheet();
        readable.replaceSync(await response.text());
        cssRules = readable.cssRules;
      } catch { return; }
      finally { clearTimeout(timer); }
    }
    for (const rule of Array.from(cssRules)) {
      if (rule instanceof CSSImportRule && rule.styleSheet) await visit(rule.styleSheet);
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').toLowerCase();
      if (family && families.includes(family)) rules.push(await inlineCssUrls(rule.cssText, base, resources));
    }
  }
  await Promise.all(Array.from(document.styleSheets).map(visit));
  const style = document.createElement('style');
  style.setAttribute('data-lo-capture', '');
  style.textContent = rules.join('\n');
  clone.appendChild(style);
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
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => {
    const after = (): void => {
      setTimeout(resolve, 400);
    };
    if (document.readyState === 'complete') after();
    else window.addEventListener('load', after, { once: true });
  });
  const images = Array.from(document.images).filter(img => !img.closest('[data-lo-ignore]'));
  const lazy = images.filter(img => img.loading === 'lazy');
  lazy.forEach(img => { img.loading = 'eager'; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled([document.fonts?.ready, ...images.map(img => img.decode?.())]),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 8000); }),
    ]);
  } finally {
    clearTimeout(timer);
    lazy.forEach(img => { img.loading = 'lazy'; });
  }
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

// Install the entry point the core SDK calls after lazy-loading this bundle.
if (typeof window !== 'undefined') {
  window.__loCapture = (config: SdkConfig): void => {
    void capture(config);
  };
}
