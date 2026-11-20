# TEC Facility Dashboard (TypeScript)

Vanilla TypeScript version of `TEC_Facility_Dashboard_v27_1.html`. Same UI, same CSS, same data format,
no framework. The build still produces **one self-contained HTML file** you can share as before.

```
npm install          # typescript, jsdom (tests), chart.js (types only)
npm run typecheck    # strict type-check, no output
npm run build        # -> dist/TEC_Facility_Dashboard.html
npm test             # build + differential regression test vs the original
```

## Layout

| Path | What |
|---|---|
| `src/template.html` | The page: markup + CSS. `/*@@APP_SCRIPT@@*/` marks where the compiled script is inlined. |
| `src/NN-*.ts` | The app, split along the original section banners (state, utils, storage/cloud, auth, one file per tab...). Concatenated in filename order. |
| `src/types.d.ts` | Domain model: every persisted record, `PersistedState`, derived shapes. |
| `src/00-dom.ts` | `byId` / `byIdOrNull` / `byIdAs`: the only way the code touches `getElementById`. |
| `src/element-map.d.ts` | **Generated** from `template.html` (`npm run gen:ids`): id -> element type, so `byId('entryDate')` is an `HTMLInputElement`. |
| `src/vendor-globals.d.ts` | Types for CDN globals (Chart.js real types; jsPDF/autoTable/SheetJS minimal). |
| `legacy/` | The original file, untouched. The regression test uses it as the oracle. |

## Design decision: global scripts, not ES modules

The markup has ~110 inline `onclick="fn(...)"` handlers, and more inside generated HTML strings, that
resolve functions on `window`. The `.ts` files are therefore global scripts (no `import`/`export`) and are
concatenated rather than bundled. This keeps every handler working with zero markup changes.
The natural next step is ES modules + `addEventListener`/event delegation; it is a separate, riskier change.

## Type-safety rules enforced

`strict`, `noImplicitReturns`, `noUnusedLocals/Parameters`, `noEmitOnError`. No `any`, no type assertions (`x as T`;
only `as const` on literal id arrays), no `!` non-null operators, no `@ts-ignore` anywhere in `src/`.
* DOM: missing elements throw a descriptive error (`byId`) or are handled explicitly (`byIdOrNull`).
* `JSON.parse` results are `unknown` and checked for container kind (`isList`, `isEntryMap`, ...). Element
  shapes inside persisted data are trusted by contract, as before.
* `<select>` values become unions via `oneOf(...)`, not casts.

## Intentional behaviour differences (all in edge cases)

1. Persisted/remote JSON that is valid JSON but the wrong container kind (e.g. `null` where a list is expected) now falls back to empty instead of corrupting state.
2. Output is compiled in strict mode (`"use strict"`).
3. Missing-element and no-signed-in-user failures throw a named `Error` instead of `Cannot read properties of null`.
4. `hasRole()` returns `false` (not `null`) when logged out; `setChartEmpty()` returns quietly if a canvas has no parent.
5. Error messages from non-`Error` throws use `String(e)`.
6. Source uses LF line endings (the original used CRLF).

## Testing

`test/differential.mjs` boots the original and the rebuilt app in jsdom with a frozen clock, seeded RNG and
virtual timers, runs the same ~190-step scenario (login, daily entries, every form, every tab, a click on
every inline handler, PDF/Excel/CSV/print exports) and compares DOM, form values, localStorage, toasts,
uncaught errors and every call made to Chart.js / jsPDF / SheetJS. It was mutation-checked: injected bugs
in business rules, chart data, PDF and Excel output are all caught.

Not covered: a real browser (rendering/CSS), the real CDN libraries (they are faked), and live Drive-bridge
network calls. Do a manual smoke test in a browser before deploying.

## Known follow-ups

* `noUncheckedIndexedAccess` is off (59 sites would need explicit handling); worth enabling later.
* Move to ES modules + event delegation (see above).
