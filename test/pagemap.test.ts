import { afterEach, describe, expect, it } from 'vitest';
import { buildPageMap, detectCtas, stableSelector } from '../src/pagemap';
import { applyChange } from '../src/experiments';
import { isSafeSelector } from '../src/sanitize';

afterEach(() => { document.body.innerHTML = ''; });

describe('manual page mapping', () => {
  it('maps all supported roles in DOM order without guessing from text or tags', () => {
    const roles = ['navigation', 'hero', 'heading', 'cta', 'form', 'pricing',
      'testimonials', 'faq', 'section', 'footer'];
    document.body.innerHTML = '<button>Untracked</button>' + roles.map((role) =>
      `<${role === 'form' ? 'form' : 'div'} data-lo-role="${role}" data-lo-id="main-${role}">Preços</${role === 'form' ? 'form' : 'div'}>`,
    ).join('');
    const map = buildPageMap();
    expect(map.nodes.map((n) => n.role)).toEqual(roles);
    for (const node of map.nodes) {
      expect(isSafeSelector(node.selector)).toBe(true);
      expect(document.querySelectorAll(node.selector)).toHaveLength(1);
    }
    expect(detectCtas()).toEqual([document.querySelector('[data-lo-id="main-cta"]')]);
  });

  it('rejects unknown roles, missing/unsafe/duplicate IDs, fake forms and ignored subtrees', () => {
    document.body.innerHTML = `
      <h1>Do not automatically map me</h1>
      <div data-lo-role="unknown" data-lo-id="unknown"></div>
      <div data-lo-role="pricing"></div>
      <div data-lo-role="faq" data-lo-id="bad id"></div>
      <div data-lo-role="cta" data-lo-id="customer-123456789"></div>
      <div data-lo-role="cta" data-lo-id="duplicate"></div><div data-lo-id="duplicate"></div>
      <div data-lo-role="form" data-lo-id="fake-form"></div>
      <div data-lo-ignore><div data-lo-role="hero" data-lo-id="private"></div></div>
      <input type="password" data-lo-role="section" data-lo-id="password">
      <section data-lo-role="faq" data-lo-id="main-faq">Perguntas</section>`;
    expect(buildPageMap().nodes.map((n) => n.selector)).toEqual(['[data-lo-id="main-faq"]']);
    expect(detectCtas()).toEqual([]);
  });

  it('keeps multiple sections and stable identity after copy and DOM changes', () => {
    document.body.innerHTML = `
      <section id="legacy" data-lo-role="pricing" data-lo-id="monthly">Monthly</section>
      <section data-lo-role="pricing" data-lo-id="annual">Annual</section>`;
    const first = document.querySelector('section')!;
    const selector = stableSelector(first);
    expect(selector).toBe('[data-lo-id="monthly"]');
    document.body.prepend(document.createElement('aside'));
    expect(applyChange({ selector, op: 'set_text', value: 'Mensal' })).toBe(true);
    expect(stableSelector(first)).toBe(selector);
    expect(buildPageMap().counts.pricing).toBe(2);
  });

  it('removes ignored descendant copy from parent text and hashes', () => {
    document.body.innerHTML = `<section data-lo-role="hero" data-lo-id="hero">Public<span data-lo-ignore>Secret</span></section>`;
    const before = buildPageMap().nodes[0];
    document.querySelector('span')!.textContent = 'Changed secret';
    expect(before?.text).toBe('Public');
    expect(buildPageMap().nodes[0]?.textHash).toBe(before?.textHash);
  });

  it('skips IDs with trailing whitespace without breaking the map', () => {
    document.body.innerHTML = '<div data-lo-role="hero" data-lo-id="hero&#10;">Bad</div>';
    expect(buildPageMap().nodes).toEqual([]);
  });

  it('retains heuristic mapping on unlabeled pages and respects ignored content', () => {
    document.body.innerHTML = `<h1>Hello</h1><button>Start</button>
      <section id="pricing">Plans</section>
      <div data-lo-ignore><h2>Private</h2></div>`;
    expect(buildPageMap().nodes.some((n) => n.role === 'pricing')).toBe(true);
    expect(buildPageMap().nodes.some((n) => n.text === 'Private')).toBe(false);
    expect(detectCtas()).toHaveLength(1);
  });
});

describe('instrumentation selector boundary', () => {
  it.each([
    '[data-lo-id="hero-signup"]', '[data-lo-id="a"]',
  ])('accepts %s', (selector) => { expect(isSafeSelector(selector)).toBe(true); });

  it.each([
    '[data-lo-role="cta"]', '[data-lo-id="bad id"]', '[data-lo-id="Uppercase"]',
    '[data-lo-id="customer-123456789"]', '[data-lo-id="hero"] button',
    '[data-lo-id^="hero"]', '[data-lo-id="hero"],input',
    `[data-lo-id="${'a'.repeat(65)}"]`, '[value="secret"]',
  ])('rejects %s', (selector) => { expect(isSafeSelector(selector)).toBe(false); });
});
