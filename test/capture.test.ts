import { afterEach, describe, expect, it, vi } from 'vitest';

import { collectNodeRects } from '../src/capture';
import { Blob as NodeBlob } from 'node:buffer';
import type { SdkConfig } from '../src/types';

describe('capture download', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('uses an origin-clean SVG source, strips private content and downloads a file without credentials', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    document.body.innerHTML = '<h1>Public heading</h1><input value="PRIVATE_INPUT"><textarea>PRIVATE_TEXT</textarea><input type="password" value="PRIVATE_PASSWORD"><div data-lo-ignore style="height:200px">PRIVATE_IGNORED</div><span data-lo-ignore style="display:inline">PRIVATE_INLINE</span><iframe src="https://private.example.com" style="height:150px"></iframe><button id="cta">Send</button>';
    let imageSource = '';
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement, value: string) {
      imageSource = value;
      queueMicrotask(() => this.dispatchEvent(new Event('load')));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(`data:image/webp;base64,${'A'.repeat(64)}`);
    const upload = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', upload);
    let downloaded!: NodeBlob;
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', { createObjectURL: (blob: NodeBlob) => { downloaded = blob; return 'blob:capture'; }, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    window.__loCapture!({ siteId: 'test-site', ingestKey: 'test-key', ingestUrl: 'https://ingest.example.com/v1/events' } as SdkConfig);
    await vi.advanceTimersByTimeAsync(400);

    // A blob: SVG source causes SecurityError on Chromium canvas export.
    expect(imageSource).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeURIComponent(imageSource.slice(imageSource.indexOf(',') + 1));
    expect(svg).toContain('Public heading');
    expect(svg).not.toContain('PRIVATE_');
    expect(svg).not.toContain('preparando captura');
    expect(svg).not.toContain('private.example.com');
    const captured = new DOMParser().parseFromString(svg, 'text/html');
    const placeholders = [...captured.querySelectorAll('div')].filter(el => el.style.visibility === 'hidden');
    expect(placeholders.some(el => el.style.height === '200px')).toBe(true);
    expect(placeholders.some(el => el.style.height === '150px')).toBe(true);
    expect(placeholders.some(el => el.style.display === 'inline-block' && el.textContent === '\u00a0')).toBe(true);
    const maskedPassword = [...captured.querySelectorAll('input')].find(el => el.style.visibility === 'hidden');
    expect(maskedPassword).toBeDefined();
    expect(maskedPassword!.type).toBe('text');
    expect(maskedPassword!.hasAttribute('value')).toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
    const content = JSON.parse(await downloaded.text());
    expect(content).toMatchObject({ siteId: 'test-site', contentType: 'image/webp', image: 'A'.repeat(64) });
    expect(content).not.toHaveProperty('ik');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('arquivo de captura baixado');
    expect(vi.getTimerCount()).toBe(2); // Badge dismissal and object URL cleanup.
  });
});

describe('collectNodeRects', () => {
  it('records document-space rects and skips invisible or missing nodes', () => {
    document.body.innerHTML =
      '<div id="hero">Hero</div><div id="hidden">Hidden</div>';

    const hero = document.getElementById('hero') as HTMLElement;
    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({
      left: 10.4,
      top: 20.6,
      width: 300,
      height: 150,
      right: 310,
      bottom: 170,
      x: 10.4,
      y: 20.6,
      toJSON: () => ({}),
    } as DOMRect);
    // #hidden keeps jsdom's default zero-size rect and must be dropped.

    const rects = collectNodeRects([
      { selector: '#hero', role: 'hero' },
      { selector: '#hidden', role: 'section' },
      { selector: '#missing', role: 'cta' },
      { selector: ':::not-a-selector', role: 'cta' },
    ]);

    expect(rects).toEqual([
      { selector: '#hero', role: 'hero', rect: [10, 21, 300, 150] },
    ]);
  });
});
