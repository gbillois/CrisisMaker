#!/usr/bin/env node
/**
 * Build a single self-contained "inline" HTML file for CrisisMaker.
 *
 * The regular app loads its CSS, fonts, JS modules, third-party libs and the
 * default news video from separate files. Some hosting targets can only serve
 * ONE .html document, so this script produces an "inline" build where every
 * asset is embedded directly into the page:
 *
 *   - css/main.css and fonts/fonts.css  -> inline <style> (woff2 -> data: URIs)
 *   - js/lib/*.js and js/*.js           -> inline <script> blocks (same order)
 *   - media/anchor.mp4                  -> data: URI embedded in js/data.js
 *
 * The CDN fallback loader is dropped (everything is local/offline) and the
 * Video Debrief tab — a nested iframe sub-app that cannot be bundled into a
 * single file — shows an explanatory placeholder instead.
 *
 * Run locally:
 *     node tools/build_inline_html.mjs
 *
 * Or trigger the "Build inline HTML" GitHub Action and download the resulting
 * file from the workflow run's artifacts.
 *
 * Tunables (env vars, also exposed as workflow inputs):
 *     OUTPUT_FILE     output filename            (default crisismaker.html)
 *     INCLUDE_VIDEO   embed media/anchor.mp4     (default 1; set 0 to omit and
 *                                                 shrink the file by ~5 MB)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const OUTPUT_FILE = process.env.OUTPUT_FILE || 'crisismaker.html';
const INCLUDE_VIDEO = !['0', 'false', 'no'].includes(
  (process.env.INCLUDE_VIDEO || '1').toLowerCase()
);
const OUTPUT = resolve(ROOT, process.argv[2] || OUTPUT_FILE);

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readBase64 = (rel) => readFileSync(join(ROOT, rel)).toString('base64');

/** Escape a JS payload so it is safe to embed inside an inline <script> tag. */
const escapeForScript = (js) => js.replace(/<\/script/gi, '<\\/script');
/** Escape a CSS payload so it is safe to embed inside an inline <style> tag. */
const escapeForStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

// ---------------------------------------------------------------------------
// 1. Fonts: turn @font-face url('*.woff2') into embedded data: URIs.
// ---------------------------------------------------------------------------
function inlineFonts() {
  const css = read('fonts/fonts.css');
  return css.replace(/url\((['"]?)([^'")]+\.woff2)\1\)/g, (_m, _q, file) => {
    const b64 = readBase64(join('fonts', file));
    return `url('data:font/woff2;base64,${b64}')`;
  });
}

// ---------------------------------------------------------------------------
// 2. Per-file JS transforms applied before inlining.
// ---------------------------------------------------------------------------
const VIDEO_DEBRIEF_PLACEHOLDER =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    '<!doctype html><meta charset="utf-8">' +
      '<style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;' +
      'font-family:system-ui,sans-serif;background:#0f1b1e;color:#e6f2f4;text-align:center;padding:2rem;box-sizing:border-box}' +
      'div{max-width:520px;line-height:1.5}h2{font-weight:600;margin:0 0 .75rem}p{opacity:.8;margin:.25rem 0}</style>' +
      '<div><h2>Video Debrief indisponible</h2>' +
      '<p>Le studio Video Debrief n’est pas inclus dans la version fichier unique (standalone).</p>' +
      '<p>Video Debrief is not available in the single-file build. Use the full CrisisMaker app for this feature.</p></div>'
  );

const JS_TRANSFORMS = {
  // Embed (or drop) the default news video instead of pointing at media/anchor.mp4.
  'js/data.js': (src) => {
    const replacement = INCLUDE_VIDEO
      ? `data:video/mp4;base64,${readBase64('media/anchor.mp4')}`
      : '';
    return src.replace("'media/anchor.mp4'", `'${replacement}'`);
  },
  // The Video Debrief iframe cannot be bundled; point it at an inline placeholder.
  'js/views.js': (src) =>
    src.replace('video-debrief/index.html?integrated=2', VIDEO_DEBRIEF_PLACEHOLDER),
};

function inlineScript(rel) {
  let src = read(rel);
  if (JS_TRANSFORMS[rel]) src = JS_TRANSFORMS[rel](src);
  return `<script>\n${escapeForScript(src)}\n</script>`;
}

// ---------------------------------------------------------------------------
// 3. Transform index.html: replace every external <link>/<script> with inline.
// ---------------------------------------------------------------------------
let html = read('index.html');

// Drop the font preload hint (the file no longer exists standalone).
html = html.replace(/^\s*<link rel="preload"[^>]*>\s*$/m, '');

// Allow data: URIs as a media source so the embedded video plays under the CSP.
html = html.replace("media-src 'self' blob:", "media-src 'self' blob: data:");

// Inline the two stylesheets.
html = html.replace(
  '<link rel="stylesheet" href="css/main.css">',
  `<style>\n${escapeForStyle(read('css/main.css'))}\n</style>`
);
html = html.replace(
  '<link rel="stylesheet" href="fonts/fonts.css">',
  `<style>\n${escapeForStyle(inlineFonts())}\n</style>`
);

// Inline every <script src="..."> in document order; drop the CDN fallback.
html = html.replace(
  /<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
  (match, src) => {
    if (src === 'js/lib-fallback.js') return ''; // offline build: no CDN fallback
    return inlineScript(src);
  }
);

// Collapse blank lines left behind by removed tags.
html = html.replace(/\n{3,}/g, '\n\n');

// ---------------------------------------------------------------------------
// 4. Sanity check + write.
// ---------------------------------------------------------------------------
const tagRefs = [
  ...html.matchAll(
    /<(?:link|script|img|video|audio|source)\b[^>]*\b(?:src|href)="((?:css|js|fonts|media)\/[^"]+)"/g
  ),
].map((m) => m[1]);
if (tagRefs.length) {
  console.warn('WARNING: un-inlined asset references remain in tags:', tagRefs);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, html);

const bytes = Buffer.byteLength(html);
console.log(
  `Building ${OUTPUT_FILE}  (video ${INCLUDE_VIDEO ? 'embedded' : 'omitted'})`
);
console.log(`Wrote ${OUTPUT}`);
console.log(`Size: ${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`);
