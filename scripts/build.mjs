import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '/*@@APP_SCRIPT@@*/';


rmSync(join(root, 'build'), { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' });

const files = readdirSync(join(root, 'build')).filter((f) => f.endsWith('.js')).sort();
const js = files
  .map((f, i) => {
    const text = readFileSync(join(root, 'build', f), 'utf8');
    return i === 0 ? text : text.replace(/^"use strict";\r?\n/, '');
  })
  .join('');


const template = readFileSync(join(root, 'src', 'template.html'), 'utf8');
if (!template.includes(MARKER)) throw new Error(`template.html is missing ${MARKER}`);
if (/<\/script/i.test(js)) throw new Error('compiled JS contains "</script", which would terminate the inline script');
mkdirSync(join(root, 'dist'), { recursive: true });

//Test case?

const out = template.replace(MARKER, () => js.replace(/\n$/, ''));
writeFileSync(join(root, 'dist', 'TEC_Facility_Dashboard.html'), out);
console.log(`built dist/TEC_Facility_Dashboard.html: ${(out.length / 1024).toFixed(0)} KB from ${files.length} compiled files`);
