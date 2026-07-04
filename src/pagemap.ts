import { truncate } from './sanitize';

/**
 * Builds a lightweight, sanitized structural map of the page. We record roles,
 * stable selectors, and short text snippets/hashes — never full private page
 * dumps. This map powers AI section-level recommendations.
 */

export type SectionRole =
  | 'hero'
  | 'pricing'
  | 'testimonials'
  | 'faq'
  | 'navigation'
  | 'footer'
  | 'form'
  | 'cta'
  | 'heading'
  | 'section';

export interface MappedNode {
  role: SectionRole;
  selector: string;
  text?: string;
  textHash?: number;
  tag: string;
}

export interface PageMap {
  path: string;
  nodes: MappedNode[];
  counts: Record<string, number>;
}

const MAX_NODES = 120;
const MAX_TEXT = 80;

export function buildPageMap(): PageMap {
  const nodes: MappedNode[] = [];
  const seen = new Set<Element>();

  const push = (el: Element | null, role: SectionRole): void => {
    if (!el || seen.has(el) || nodes.length >= MAX_NODES) return;
    seen.add(el);
    const text = shortText(el);
    const node: MappedNode = {
      role,
      selector: stableSelector(el),
      tag: el.tagName.toLowerCase(),
    };
    if (text) {
      node.text = text;
      node.textHash = hash32(el.textContent ?? '');
    }
    nodes.push(node);
  };

  // Landmarks
  push(document.querySelector('nav, [role="navigation"], header nav'), 'navigation');
  push(document.querySelector('footer, [role="contentinfo"]'), 'footer');
  push(detectHero(), 'hero');

  // Headings
  document.querySelectorAll('h1, h2, h3').forEach((h) => push(h, 'heading'));

  // CTAs
  detectCtas().forEach((c) => push(c, 'cta'));

  // Forms
  document.querySelectorAll('form').forEach((f) => push(f, 'form'));

  // Semantic sections by keyword
  push(sectionByKeyword(['pricing', 'plans', 'price']), 'pricing');
  push(sectionByKeyword(['testimonial', 'review', 'customers', 'trusted']), 'testimonials');
  push(sectionByKeyword(['faq', 'questions', 'frequently']), 'faq');

  const counts: Record<string, number> = {};
  for (const n of nodes) counts[n.role] = (counts[n.role] ?? 0) + 1;

  return { path: location.pathname || '/', nodes, counts };
}

function detectHero(): Element | null {
  // First large section containing an h1 near the top of the page.
  const h1 = document.querySelector('h1');
  if (!h1) return document.querySelector('header, section, main > *');
  return h1.closest('section, header, div[class*="hero" i], main > *') ?? h1.parentElement;
}

export function detectCtas(): Element[] {
  const selectors = [
    'a[class*="btn" i]',
    'button',
    'a[role="button"]',
    'input[type="submit"]',
    'a[href*="signup" i]',
    'a[href*="sign-up" i]',
    'a[href*="get-started" i]',
    'a[href*="demo" i]',
    'a[href*="trial" i]',
  ];
  const out: Element[] = [];
  const seen = new Set<Element>();
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      if (seen.has(el)) return;
      const t = (el.textContent ?? '').trim().toLowerCase();
      const looksCta =
        el.tagName === 'BUTTON' ||
        /start|sign up|sign-up|signup|get|try|demo|buy|subscribe|join|book|contact/.test(t);
      if (looksCta) {
        seen.add(el);
        out.push(el);
      }
    });
  }
  return out.slice(0, 25);
}

function sectionByKeyword(keywords: string[]): Element | null {
  const sections = document.querySelectorAll('section, div[id], div[class]');
  for (const s of Array.from(sections)) {
    const hay = `${s.id} ${s.className}`.toLowerCase();
    if (keywords.some((k) => hay.includes(k))) return s;
    const heading = s.querySelector('h1, h2, h3');
    const ht = (heading?.textContent ?? '').toLowerCase();
    if (keywords.some((k) => ht.includes(k))) return s;
  }
  return null;
}

function shortText(el: Element): string | undefined {
  const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return truncate(t, MAX_TEXT);
}

/**
 * Produce a reasonably stable, safe selector for an element. Prefers id, then
 * a single stable class, then nth-of-type path. Never emits attribute-value
 * selectors.
 */
export function stableSelector(el: Element): string {
  if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return `#${el.id}`;
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === Node.ELEMENT_NODE && depth < 5) {
    let part = node.tagName.toLowerCase();
    const cls = stableClass(node);
    if (cls) part += `.${cls}`;
    else {
      const idx = indexOfType(node);
      if (idx > 0) part += `:nth-of-type(${idx + 1})`;
    }
    parts.unshift(part);
    if (node.id && /^[a-zA-Z][\w-]*$/.test(node.id)) {
      parts[0] = `#${node.id}`;
      break;
    }
    node = node.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

function stableClass(el: Element): string | null {
  const classes = Array.from(el.classList).filter(
    (c) => /^[a-zA-Z][\w-]*$/.test(c) && !/\d{3,}/.test(c) && c.length < 30,
  );
  return classes[0] ?? null;
}

function indexOfType(el: Element): number {
  let i = 0;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) i++;
    sib = sib.previousElementSibling;
  }
  return i;
}

/** Small, fast non-cryptographic hash for change-detection only. */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
