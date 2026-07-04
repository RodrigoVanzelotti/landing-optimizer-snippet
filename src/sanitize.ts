import { LIMITS } from './config';

/**
 * Privacy safeguards executed in the browser BEFORE anything leaves the page.
 * The ingestion edge repeats these checks (defense in depth), but the SDK must
 * never be the source of a PII leak.
 */

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const CC = /\b(?:\d[ -]*?){13,16}\b/;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/;

/** True if a string looks like it contains PII and must be dropped. */
export function looksLikePii(value: string): boolean {
  return EMAIL.test(value) || PHONE.test(value) || CC.test(value) || SSN.test(value);
}

/**
 * Sanitize an arbitrary props object supplied by the customer via track()/
 * conversion(). Drops PII-shaped values, caps key count and string length, and
 * only keeps JSON-serializable primitives / shallow arrays.
 */
export function sanitizeProps(
  input: unknown,
): Record<string, unknown> | undefined {
  if (input == null || typeof input !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  let keys = 0;

  for (const [rawKey, rawVal] of Object.entries(input as Record<string, unknown>)) {
    if (keys >= LIMITS.maxPropKeys) break;
    const key = truncate(String(rawKey), 64);
    const val = sanitizeValue(rawVal);
    if (val === undefined) continue;
    out[key] = val;
    keys++;
  }
  return keys > 0 ? out : undefined;
}

function sanitizeValue(v: unknown): unknown {
  switch (typeof v) {
    case 'number':
      return Number.isFinite(v) ? v : undefined;
    case 'boolean':
      return v;
    case 'string': {
      if (looksLikePii(v)) return undefined;
      return truncate(v, LIMITS.maxStringLen);
    }
    default:
      if (Array.isArray(v)) {
        const arr = v
          .slice(0, 10)
          .map(sanitizeValue)
          .filter((x) => x !== undefined);
        return arr.length ? arr : undefined;
      }
      return undefined;
  }
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/* -------------------------------------------------------------------------- */
/* Selector validation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Allow a conservative subset of CSS selectors for variant targeting. We block
 * attribute-value selectors (which could exfiltrate values) and anything that
 * is not a plain id/class/tag chain with descendant/child/sibling combinators.
 * Supports compound selectors such as `.cta.primary` and `main > section h2`.
 */
const NAME = '[a-zA-Z][\\w-]*';
// A compound selector: optional tag/"*" then any number of .class / #id, OR one
// or more .class / #id on their own.
const COMPOUND = `(?:(?:${NAME}|\\*)(?:[.#]${NAME})*|(?:[.#]${NAME})+)`;
const COMBINATOR = '(?:\\s*[>+~]\\s*|\\s+)';
const SAFE_SELECTOR = new RegExp(`^${COMPOUND}(?:${COMBINATOR}${COMPOUND})*$`);

export function isSafeSelector(selector: string): boolean {
  if (typeof selector !== 'string' || selector.length === 0 || selector.length > 256) {
    return false;
  }
  // No attribute selectors, pseudo-classes, grouping, or JS-ish characters.
  // `>` `+` `~` are permitted as combinators; `<` stays blocked.
  if (/[\[\](){}<'"`;:,]/.test(selector)) return false;
  return SAFE_SELECTOR.test(selector.trim());
}

/* -------------------------------------------------------------------------- */
/* Minimal HTML sanitizer for `set_html_safe`                                  */
/* -------------------------------------------------------------------------- */

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'span', 'br', 'small', 'sub', 'sup', 'mark',
]);

/**
 * Sanitize HTML for the `set_html_safe` op: parse in an inert document, strip
 * disallowed tags/attributes entirely. No script, style, event handlers, or
 * URLs survive. Returns escaped text on any failure.
 */
export function sanitizeHtml(html: string): string {
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    scrub(tpl.content);
    return tpl.innerHTML;
  } catch {
    return escapeText(html);
  }
}

function scrub(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // Replace disallowed element with its text content.
        const text = document.createTextNode(el.textContent ?? '');
        el.replaceWith(text);
        continue;
      }
      // Strip all attributes (no href/src/style/on*).
      for (const attr of Array.from(el.attributes)) {
        el.removeAttribute(attr.name);
      }
      scrub(el);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child);
    }
  }
}

export function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
