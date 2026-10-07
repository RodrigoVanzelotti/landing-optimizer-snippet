import { defineConfig } from 'tsup';

/**
 * Three build outputs:
 *  - `lo.js`        : the full SDK bundle loaded async from the CDN (IIFE, minified).
 *  - `loader.js`    : the tiny inline loader that customers paste (also generated
 *                     server-side per site; this is the canonical source).
 *  - `lo-capture.js`: operator-only snapshot capture, lazy-loaded by lo.js when
 *                     the page is opened with ?lo_capture=1. Never loaded for
 *                     real visitors, so it does not count against the core
 *                     bundle size budget.
 */
export default defineConfig([
  {
    entry: { 'lo': 'src/index.ts' },
    format: ['iife'],
    globalName: '__LandingOptimizerBundle',
    platform: 'browser',
    target: 'es2019',
    minify: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    outExtension: () => ({ js: '.js' }),
    publicDir: 'public'
  },
  {
    entry: { 'loader': 'src/loader.ts' },
    format: ['iife'],
    platform: 'browser',
    target: 'es2019',
    minify: true,
    sourcemap: false,
    clean: false,
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: { 'lo-capture': 'src/capture.ts' },
    format: ['iife'],
    globalName: '__LandingOptimizerCapture',
    platform: 'browser',
    target: 'es2019',
    minify: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    outExtension: () => ({ js: '.js' }),
  },
]);
