import { describe, expect, it } from 'vitest';
import { applyChange, bucket, canonicalJson } from '../src/experiments';

describe('bucket', () => {
  it('is deterministic and within [0,1)', () => {
    const a = bucket('sid:exp');
    const b = bucket('sid:exp');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
  it('differs across seeds', () => {
    expect(bucket('a')).not.toBe(bucket('b'));
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively and is stable', () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
});

describe('applyChange', () => {
  it('sets text on matched elements', () => {
    document.body.innerHTML = '<div id="hero"><h1>Old</h1></div>';
    const changed = applyChange({ selector: '#hero h1', op: 'set_text', value: 'New' });
    expect(changed).toBe(true);
    expect(document.querySelector('#hero h1')?.textContent).toBe('New');
  });

  it('refuses unsafe selectors', () => {
    document.body.innerHTML = '<input value="secret">';
    const changed = applyChange({
      selector: 'input[value="secret"]',
      op: 'set_text',
      value: 'x',
    });
    expect(changed).toBe(false);
  });

  it('hides elements', () => {
    document.body.innerHTML = '<div class="banner">hi</div>';
    applyChange({ selector: '.banner', op: 'hide' });
    const el = document.querySelector('.banner') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('adds only valid classes', () => {
    document.body.innerHTML = '<button class="a">x</button>';
    applyChange({ selector: 'button', op: 'add_class', value: 'primary bad!name' });
    const el = document.querySelector('button')!;
    expect(el.classList.contains('primary')).toBe(true);
    expect(el.classList.contains('bad!name')).toBe(false);
  });
});
