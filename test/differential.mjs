// Differential regression test.
//
// Boots the ORIGINAL single-file app and the REBUILT app in jsdom with identical stubs (frozen clock,
// seeded Math.random, fake Chart.js, WebCrypto), drives both through the same scripted scenario, and
// compares after every step: DOM markup, form-control values, localStorage and any uncaught errors.
// Any difference in behaviour makes the test fail and prints where the two runs diverged.
//
//   node test/differential.mjs [path/to/candidate.html]
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

process.env.TZ = 'UTC';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, 'legacy', 'TEC_Facility_Dashboard_v27_1.html');
const CANDIDATE = process.argv[2] ?? join(root, 'dist', 'TEC_Facility_Dashboard.html');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

const TABS = ['dashboard', 'updates', 'entry', 'energy', 'water', 'events', 'incidents', 'downtime', 'maintenance', 'compliance', 'users', 'settings'];
const SKIP_CLICK = /logoutUser|openUserMenu|resetLocal|disconnectDrive|location\./;

/* ------------------------------------------------------------------ boot one app instance */
async function boot(file) {
  const errors = [];
  let timers, virtualNow, timerSeq;
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.detail?.message ?? e.message).split('\n')[0]));
  const dom = new JSDOM(readFileSync(file, 'utf8'), {
    url: 'https://tec.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      
      const log = (kind, payload) => win.__log.push(kind + ' ' + JSON.stringify(payload, (k, v) => (typeof v === 'function' ? '[fn]' : v)));
      win.__log = [];
      win.Chart = class { constructor(ctx, cfg) { log('chart', { canvas: ctx && ctx.id, cfg }); } destroy() { win.__log.push('chart.destroy'); } update() {} static register() {} };
      win.jspdf = {
        jsPDF: class {
          constructor(o) { log('pdf.new', o); this.internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } }; this.lastAutoTable = { finalY: 100 };
            for (const m of ['text', 'setFontSize', 'setTextColor', 'addImage', 'addPage', 'autoTable', 'save']) this[m] = (...a) => { log('pdf.' + m, m === 'addImage' ? [a[1], ...a.slice(2)] : a); return this; }; }
          static API = { autoTable: true };
        },
      };
      win.XLSX = {
        utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: (rows) => ({ rows }), book_append_sheet: (wb, sh, name) => log('xlsx.sheet', { name, rows: sh.rows }) },
        writeFile: (wb, name) => log('xlsx.write', name),
      };
      win.HTMLCanvasElement.prototype.getContext = () => ({});
      win.HTMLElement.prototype.scrollIntoView = () => {};
      win.scrollTo = () => {};
      win.print = () => {};
      win.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} });
      win.confirm = () => true;
      win.alert = () => {};
      win.prompt = () => 'prompt-value';
      win.fetch = () => Promise.reject(new Error('offline (test harness)'));
      win.URL.createObjectURL = () => 'blob:stub';
      win.URL.revokeObjectURL = () => {};
      win.TextEncoder = TextEncoder;
      // Virtual clock: timers only fire when the scenario calls advance(), never on wall-clock time.
      timers = new Map(); virtualNow = 0; timerSeq = 1;
      const add = (fn, ms, iv, args) => { const id = timerSeq++; timers.set(id, { id, at: virtualNow + Math.max(0, Number(ms) || 0), iv, fn: () => fn(...args) }); return id; };
      win.setTimeout = (fn, ms, ...args) => add(fn, ms, null, args);
      win.setInterval = (fn, ms, ...args) => add(fn, ms, Math.max(1, Number(ms) || 1), args);
      win.clearTimeout = win.clearInterval = (id) => { timers.delete(id); };
      Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });
      // Deterministic time and randomness (same call order in both runs => same values).
      win.eval(`(() => {
        const RealDate = Date, FIXED = new RealDate('2026-11-19T10:30:00Z').getTime();
        class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); } static now() { return FIXED; } }
        Date = FakeDate;
        let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
      })()`);
    },
  });
  const win = dom.window;
  const doc = win.document;
  const trace = [];
  const bodies = new Map();
  let errMark = 0;

  const formState = () => [...doc.querySelectorAll('input,select,textarea')]
    .map((e) => `${e.id}:${e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.type === 'file' ? '' : e.value}`).join('|');
  const lsState = () => JSON.stringify(Object.keys(win.localStorage).sort().map((k) => [k, win.localStorage.getItem(k)]));

  const api = {
    win, doc, errors, trace,
    set(id, v) { const el = doc.getElementById(id); if (!el) throw new Error(`harness: #${id} not found`); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; },
    advance(ms) {
      const target = virtualNow + ms;
      for (;;) {
        const due = [...timers.values()].filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        virtualNow = due.at;
        if (due.iv) due.at += due.iv; else timers.delete(due.id);
        try { due.fn(); } catch (e) { errors.push(`timer: ${e.message}`); }
      }
      virtualNow = target;
    },
    async tick(ms = 12) { api.advance(ms); await sleep(6); },
    snap(label) {
      // Compare rendered DOM only: the <script> element holds the app's own source text, which legitimately differs.
      const clone = doc.body.cloneNode(true);
      clone.querySelectorAll('script').forEach((el) => el.remove());
      const body = clone.innerHTML + '\n#FORM#' + formState();
      const ls = lsState();
      const newErrors = errors.slice(errMark); errMark = errors.length;
      trace.push({ label, body: sha(body), ls: sha(ls), log: sha(win.__log.join('\n')), toast: doc.getElementById('toast')?.textContent ?? '', errors: newErrors.join(' || ') });
      bodies.set(label + '#' + (trace.length - 1), { body, ls });
    },
    bodyOf(i) { return bodies.get(trace[i].label + '#' + i); },
  };
  await sleep(80); // let async init() finish (hashing default user, restoring session)
  return api;
}


async function scenario(app) {
  const { win, doc, set, tick, snap } = app;
  const call = async (fn, ...args) => { try { await win[fn](...args); } catch (e) { app.errors.push(`call ${fn}: ${e.message}`); } await tick(); };

  snap('boot / login screen');

  // failed then successful login
  set('loginUser', 'admin'); set('loginPass', 'wrong'); await call('doLogin'); snap('login: bad password');
  set('loginUser', 'admin'); set('loginPass', 'admin123'); await call('doLogin'); await tick(40); snap('login: ok');

  // daily entries (energy + water + systems) over several days so consumption deltas exist
  for (let i = 0; i < 5; i++) {
    const d = `2026-11-${String(10 + i).padStart(2, '0')}`;
    set('entryDate', d); await call('loadEntry');
    set('eUtility', String(1000 + i * 55)); set('eLoad', String(300 + i * 7)); set('eLoadKVA', String(320 + i * 6)); set('eSolar1', String(40 + i)); set('eSolar2', String(35 + i * 2));
    set('entryDate', d); await call('saveEnergySection'); snap(`entry ${d}: energy`);
    set('entryDate', d); set('wMeter', String(50000 + i * 1200 + (i === 3 ? 500 : 0))); set('wNotes', `note ${i}`); await call('updateWaterCalc');
    set('entryDate', d); await call('saveWaterSection'); snap(`entry ${d}: water`);
    set('entryDate', d); set('sPower', i === 2 ? 'partial' : 'up'); set('sInternet', i === 3 ? 'degraded' : 'up'); set('sServer', 'up'); set('sSolar', i === 4 ? 'partial' : 'operational');
    await call('saveSystemsSection'); snap(`entry ${d}: systems`);
  }

  // every tab once, before any other records exist
  for (const t of TABS) { await call('sw', t); snap(`tab ${t} (empty records)`); }

  // events
  await call('sw', 'events');
  set('evId', ''); set('evCat', 'Meeting'); set('evTitle', 'Quarterly safety meeting'); set('evDate', '2026-11-12'); set('evDesc', 'Review'); set('evAttendees', 'A, B, C'); set('evNotes', 'n/a');
  await call('saveEvent'); snap('events: saved');

  // incidents
  await call('sw', 'incidents');
  set('incId', ''); set('iStartDate', '2026-11-13'); set('iStartTime', '08:15'); set('iEndDate', '2026-11-13'); set('iEndTime', '11:45');
  set('iCat', 'Power'); set('iType', 'Outage'); set('iSev', 'High'); set('iSystem', 'Generator'); set('iDesc', 'Grid failure'); set('iCause', 'Utility'); set('iAction', 'Switched to solar'); set('iStatus', 'Resolved');
  await call('saveIncident'); snap('incidents: saved resolved');
  set('incId', ''); set('iStartDate', '2026-11-18'); set('iStartTime', '09:00'); set('iEndDate', ''); set('iEndTime', '');
  set('iCat', 'Water'); set('iType', 'Leak'); set('iSev', 'Medium'); set('iSystem', 'Pump'); set('iDesc', 'Leak at pump'); set('iCause', 'Seal'); set('iAction', 'Ordered part'); set('iStatus', 'In Progress');
  await call('saveIncident'); snap('incidents: saved open');

  // downtime
  await call('sw', 'downtime');
  set('dtId', ''); set('dtStartDate', '2026-11-14'); set('dtStartTime', '07:30'); set('dtEndDate', '2026-11-14'); set('dtEndTime', '09:00');
  set('dtCat', 'Machine Breakdown'); set('dtArea', 'Line 2'); set('dtReason', 'Belt snapped'); set('dtDesc', 'Replaced belt');
  await call('saveDowntime'); snap('downtime: saved');

  // assets, maintenance log, routine check
  await call('sw', 'maintenance');
  set('assetId', ''); set('aName', 'Compressor A'); set('aType', 'Machine'); set('aTypeOther', ''); set('aFreq', 'Monthly'); set('aLast', '2026-10-20'); set('aNext', '2026-11-25');
  set('aMake', 'Atlas'); set('aSerial', 'SN-001'); set('aNotes', 'Main compressor');
  await call('saveAsset'); snap('maintenance: asset saved');
  set('assetId', ''); set('aName', 'Pump B'); set('aType', 'Other'); set('aTypeOther', 'Booster pump'); set('aFreq', 'Weekly'); set('aLast', '2026-11-01'); set('aNext', '2026-11-08');
  set('aMake', 'Grundfos'); set('aSerial', 'SN-002'); set('aNotes', ''); await call('saveAsset'); snap('maintenance: second asset saved');
  set('logAssetId', '1'); set('logDate', '2026-11-16'); set('logWork', 'Oil change'); set('logTech', 'Joe'); set('logCost', '120.50'); set('logNotes', 'ok'); set('logNext', '2026-12-16');
  await call('saveMaintenanceLog'); snap('maintenance: log saved');
  await call('renderRCAssetOptions');
  set('rcId', ''); set('rcAsset', '1'); set('rcItems', 'Belts, filters'); set('rcChecker', 'Sam'); set('rcDate', '2026-11-17'); set('rcComments', 'fine'); set('rcNextCheck', '2026-11-24');
  await call('saveRoutineCheck'); snap('routine check: saved');

  // compliance
  await call('sw', 'compliance');
  set('compId', ''); set('cName', 'Fire certificate'); set('cCat', 'Certification'); set('cBody', 'County'); set('cEquipment', 'Building'); set('cIssued', '2026-01-10');
  set('cExpiry', '2026-12-10'); set('cReportRef', 'REF-9'); set('cRemind', '30'); set('cNotes', 'renew early');
  await call('saveCompliance'); snap('compliance: saved');

  // general updates
  await call('sw', 'updates');
  set('guId', ''); set('guHeader', 'Roof inspection'); set('guDate', '2026-11-15'); set('guNote', 'Scheduled for Monday');
  await call('saveGU'); snap('updates: saved');

  // users (super admin only)
  await call('sw', 'users');
  set('uId', ''); set('uName', 'Test User'); set('uUsername', 'tuser'); set('uPass', 'secret12'); set('uPass2', 'secret12'); set('uRole', 'user'); set('uActive', true);
  await call('saveUser'); await tick(30); snap('users: saved');

  // all tabs again, now with data
  for (const t of TABS) { await call('sw', t); snap(`tab ${t} (with records)`); }

  // report exports: PDF / Excel / CSV / print preview, for a month and for a week
  await call('sw', 'settings');
  for (const [type, label] of [['month', 'month'], ['week', 'week']]) {
    set('reportPeriodType', type); await call('toggleReportPeriod');
    if (type === 'month') { await call('buildPrintMonths'); set('printMonth', '2026-11'); } else set('printWeekDate', '2026-11-12');
    await call('downloadReportPDF'); await tick(30); snap(`export ${label}: pdf`);
    await call('downloadReportExcel'); await tick(30); snap(`export ${label}: excel`);
    await call('downloadReportCSV'); snap(`export ${label}: csv`);
    await call('generatePrint'); snap(`export ${label}: print preview`);
  }

  // monkey sweep: click every inline-handler button in each pane, change every filter <select>
  let clicks = 0;
  for (const t of TABS) {
    await call('sw', t);
    for (let i = 0; i < 400; i++) {
      const els = [...doc.querySelectorAll(`#pane-${t} [onclick]`)];
      if (i >= els.length) break;
      const el = els[i];
      const code = el.getAttribute('onclick') ?? '';
      if (SKIP_CLICK.test(code)) continue;
      try { el.click(); } catch (e) { app.errors.push(`click ${code}: ${e.message}`); }
      await tick(4); clicks++;
      snap(`click[${t}#${i}] ${code.slice(0, 70)}`);
    }
    for (const sel of [...doc.querySelectorAll(`#pane-${t} select[onchange]`)]) {
      for (const opt of [...sel.options].slice(0, 5)) {
        sel.value = opt.value;
        sel.dispatchEvent(new win.Event('change', { bubbles: true }));
        await tick(4); clicks++;
        snap(`change[${t}#${sel.id}] ${opt.value}`);
      }
    }
  }
  snap(`final state after ${clicks} simulated interactions`);
}


function excerpt(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `first difference at char ${i}:\n   baseline : …${a.slice(Math.max(0, i - 70), i + 110)}…\n   candidate: …${b.slice(Math.max(0, i - 70), i + 110)}…`;
}

const base = await boot(BASELINE);
const cand = await boot(CANDIDATE);
await scenario(base);
await scenario(cand);

let failures = 0;
if (base.trace.length !== cand.trace.length) { console.log(`FAIL: trace length ${base.trace.length} vs ${cand.trace.length}`); failures++; }
for (let i = 0; i < Math.min(base.trace.length, cand.trace.length); i++) {
  const a = base.trace[i], b = cand.trace[i];
  const bad = [];
  if (a.label !== b.label) bad.push('label');
  if (a.body !== b.body) bad.push('DOM/form');
  if (a.ls !== b.ls) bad.push('localStorage');
  if (a.log !== b.log) bad.push('library calls (charts/pdf/xlsx)');
  if (a.toast !== b.toast) bad.push(`toast ("${a.toast}" vs "${b.toast}")`);
  if (a.errors !== b.errors) bad.push(`errors ("${a.errors}" vs "${b.errors}")`);
  if (bad.length) {
    failures++;
    console.log(`MISMATCH @${i} [${a.label}]: ${bad.join(', ')}`);
    if (bad.includes('DOM/form')) console.log('  ' + excerpt(base.bodyOf(i).body, cand.bodyOf(i).body));
    if (bad.includes('localStorage')) console.log('  ' + excerpt(base.bodyOf(i).ls, cand.bodyOf(i).ls));
    if (bad.includes('library calls (charts/pdf/xlsx)')) console.log('  ' + excerpt(base.win.__log.join('\n'), cand.win.__log.join('\n')));
  }
}

// Coverage visibility: what the baseline itself reported, so a "pass" can't hide a scenario that never ran.
const toasts = new Set(base.trace.map((t) => t.toast).filter(Boolean));
const baseErrs = base.trace.filter((t) => t.errors).length;
console.log(`\nsteps compared      : ${Math.min(base.trace.length, cand.trace.length)}`);
console.log(`baseline errors     : ${base.errors.length} (in ${baseErrs} steps; candidate must match exactly)`);
console.log(`distinct toasts seen: ${toasts.size}`);
for (const k of ['Event saved.', 'Saved.', 'Asset saved.']) console.log(`  saw "${k}": ${toasts.has(k)}`);
const ls = JSON.parse(JSON.stringify([...Object.keys(base.win.localStorage)].sort().map((k) => [k, base.win.localStorage.getItem(k).length])));
const kinds = {}; for (const l of base.win.__log) { const k = l.split(' ')[0]; kinds[k] = (kinds[k] ?? 0) + 1; }
console.log(`library calls logged: ${Object.entries(kinds).map(([k, n]) => `${k}×${n}`).join(' ')}`);
console.log(`localStorage keys   : ${ls.map(([k, n]) => `${k}(${n})`).join(' ')}`);
console.log(failures ? `\nRESULT: FAIL (${failures} difference${failures > 1 ? 's' : ''})` : '\nRESULT: PASS - candidate behaves identically to the original');
process.exit(failures ? 1 : 0);
