import { defineConfig } from 'tsup';

/**
 * Two build outputs:
 *  - `lo.js`   : the full SDK bundle loaded async from the CDN (IIFE, minified).
 *  - `loader.js`: the tiny inline loader that customers paste (also generated
 *                 server-side per site; this is the canonical source).
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
]);
