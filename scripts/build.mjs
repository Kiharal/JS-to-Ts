// Build: type-check + compile src/*.ts with tsc, then inline the result into the HTML template.
// Output is ONE self-contained file (dist/TEC_Facility_Dashboard.html), as before: no bundler, no extra assets.
//
// The source files are global scripts (no import/export) on purpose: the markup has ~110 inline
// onclick="fn(...)" handlers (plus more inside generated HTML) that look functions up on `window`.
// tsc emits one .js per source file; they are concatenated in filename order (00-, 01-, ... 99-main).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '/*@@APP_SCRIPT@@*/';

// 1. Compile (fails the build on any type error: tsconfig sets noEmitOnError).
rmSync(join(root, 'build'), { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' });

// 2. Concatenate the emitted files. tsc adds a "use strict" prologue to each file; keep only the first one
//    (a directive is only meaningful at the very top of a script).
const files = readdirSync(join(root, 'build')).filter((f) => f.endsWith('.js')).sort();
const js = files
  .map((f, i) => {
    const text = readFileSync(join(root, 'build', f), 'utf8');
    return i === 0 ? text : text.replace(/^"use strict";\r?\n/, '');
  })
  .join('');

// 3. Inline into the template.
const template = readFileSync(join(root, 'src', 'template.html'), 'utf8');
if (!template.includes(MARKER)) throw new Error(`template.html is missing ${MARKER}`);
if (/<\/script/i.test(js)) throw new Error('compiled JS contains "</script", which would terminate the inline script');
mkdirSync(join(root, 'dist'), { recursive: true });
// Replacer function: "$&"-style sequences inside the JS must never be interpreted by String.replace.
const out = template.replace(MARKER, () => js.replace(/\n$/, ''));
writeFileSync(join(root, 'dist', 'TEC_Facility_Dashboard.html'), out);
console.log(`built dist/TEC_Facility_Dashboard.html: ${(out.length / 1024).toFixed(0)} KB from ${files.length} compiled files`);
