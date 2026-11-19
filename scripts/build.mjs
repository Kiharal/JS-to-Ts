// Stage-1 build: stitch src/*.js back into the HTML template (no compilation yet).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '/*@@APP_SCRIPT@@*/';

const files = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js')).sort();
const js = files.map((f) => readFileSync(join(root, 'src', f), 'utf8')).join('');
const template = readFileSync(join(root, 'src', 'template.html'), 'utf8');
if (!template.includes(MARKER)) throw new Error(`template.html is missing ${MARKER}`);

mkdirSync(join(root, 'dist'), { recursive: true });
// Use a replacer function so "$&"-style sequences inside the JS are never interpreted.
const out = template.replace(MARKER, () => js.replace(/\n$/, ''));
writeFileSync(join(root, 'dist', 'TEC_Facility_Dashboard.html'), out);
console.log(`built dist/TEC_Facility_Dashboard.html (${out.length} chars, ${files.length} script files)`);
