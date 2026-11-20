/* ===== DOMAIN MODEL =====
   These interfaces describe the JSON the app persists to localStorage (tec:*) and syncs through the Drive bridge
   (see payload() / applyRemoteState()). They are the single source of truth for record shapes. */

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
/** Lookup by a free-form string key: a missing key is a normal case (the callers supply a fallback with ||). */
type Lookup<V> = Partial<Record<string, V>>;

type Role = 'superadmin' | 'admin' | 'user';
/** Most record types are simply open until someone closes them. */
type OpenClosed = 'open' | 'closed';
/** RAG status class names used by the stylesheet: none / red / amber / green. */
type Rag = 'dn' | 'dr' | 'da' | 'dg';

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Set when the file was uploaded to Drive. */
  url?: string;
  driveId?: string;
  /** Set (as a data: URL) when the file is embedded in the JSON instead. */
  data?: string;
}

interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

interface ActivityEntry {
  id: number;
  ts: string;
  user: string;
  role: Role | '';
  action: string;
  details: string;
}

/* ---- daily readings ---- */
type PowerStatus = 'up' | 'partial' | 'down';
type LinkStatus = 'up' | 'degraded' | 'down';
type SolarStatus = 'operational' | 'partial' | 'down';
interface SavedSections { energy?: boolean; water?: boolean; systems?: boolean }

interface DayEntry {
  utility: number | null;
  load: number | null;
  loadKVA: number | null;
  solar1: number;
  solar2: number;
  /** Cumulative water meter reading in litres. */
  water: number | null;
  wNotes: string;
  power: PowerStatus;
  internet: LinkStatus;
  server: LinkStatus;
  solar: SolarStatus;
  saved: SavedSections;
}
/** Keyed by ISO date (YYYY-MM-DD). */
type EntryMap = Record<string, DayEntry>;
type LoadField = 'load' | 'loadKVA';

/* ---- records ---- */
interface Incident {
  id: number;
  date: string;
  start: string;
  end: string | null;
  category: string;
  type: string;
  severity: string;
  system: string;
  description: string;
  cause: string;
  action: string;
  status: string;
  attachments: Attachment[];
  /** Legacy records stored downtime as minutes instead of start/end. */
  downtime?: number;
}

interface DowntimeRecord {
  id: number;
  date: string;
  start: string;
  end: string | null;
  category: string;
  area: string;
  reason: string;
  description: string;
  status: 'Resolved' | 'Ongoing';
  attachments: Attachment[];
  /** Legacy records stored minutes directly. */
  duration?: number;
}

interface EventRecord {
  id: number;
  date: string;
  category: string;
  title: string;
  description: string;
  attendees: string;
  notes: string;
  attachments: Attachment[];
  status: OpenClosed;
}

interface Asset {
  id: number;
  name: string;
  type: string;
  customType: string;
  frequency: string;
  lastMaint: string;
  nextDue: string;
  make: string;
  serial: string;
  notes: string;
  attachments?: Attachment[];
}

interface MaintenanceLog {
  id: number;
  assetId: number;
  date: string;
  work: string;
  technician: string;
  cost: number;
  notes: string;
  nextDue: string;
  attachments: Attachment[];
  status: OpenClosed;
}

interface RoutineCheck {
  id: number;
  date: string;
  assetId: number;
  items: string;
  comments: string;
  checker: string;
  nextCheck: string;
  attachments: Attachment[];
  status: OpenClosed;
}

interface ComplianceItem {
  id: number;
  name: string;
  category: string;
  issuingBody: string;
  equipment: string;
  issued: string;
  expiry: string;
  reportRef: string;
  /** Days before expiry to start flagging. */
  remind: number;
  notes: string;
  attachments: Attachment[];
  status: OpenClosed;
}

interface UpdateReview {
  id: number;
  date: string;
  author: string;
  text: string;
  attachments: Attachment[];
}
/** A general facility update: a header plus a thread of reviews/notes. */
interface UpdateThread {
  id: number;
  header: string;
  date: string;
  status: OpenClosed;
  createdBy: string;
  reviews: UpdateReview[];
}

/** Everything that is saved / synced. Key names are the on-disk format - do not rename. */
interface PersistedState {
  entries: EntryMap;
  incidents: Incident[];
  events: EventRecord[];
  assets: Asset[];
  maintLog: MaintenanceLog[];
  compliance: ComplianceItem[];
  downtime: DowntimeRecord[];
  users: User[];
  activityLog: ActivityEntry[];
  routineChecks: RoutineCheck[];
  generalUpdates: UpdateThread[];
}

/* ---- Drive bridge (Google Apps Script web app) ---- */
interface DriveConfig { url?: string; rootId?: string }
interface BridgeResponse {
  ok?: boolean;
  error?: string;
  /** upload: link + file id of the stored file */
  url?: string;
  id?: string;
  /** data fetch: JSON string of PersistedState + its last-modified marker */
  data?: string;
  updatedAt?: string;
}
type SyncResult = { ok: true; skipped?: true } | { ok: false; error: string };
type SyncState = 'ok' | 'busy' | 'no';

/* ---- derived / computed shapes ---- */
interface EnergyDay { date: string; utility: number; solar: number; total: number; baseline: boolean }
interface LoadDay { date: string; val: number; baseline: boolean }
interface EnergyMonthSummary { total: number; avg: number; peak: EnergyDay | null; count: number }
interface LoadMonthSummary { total: number; count: number }

/** The first reading ever recorded is only a baseline: there is nothing earlier to subtract from. */
interface WaterBaselineDay { date: string; readingL: number; consL: null; consM3: null; note: string }
interface WaterMeasuredDay { date: string; readingL: number; prevDate: string; prevL: number; consL: number; consM3: number; note: string }
type WaterDay = WaterBaselineDay | WaterMeasuredDay;
/** Entries that passed the "has a usable meter reading" filter. */
type WithUtility = DayEntry & { utility: number };
type WithWater = DayEntry & { water: number };
interface WaterData { readings: [string, WithWater][]; daily: WaterDay[] }
interface WaterSummary { totalL: number; totalM3: number; avgM3: number; peak: WaterMeasuredDay | null; count: number }

interface MonthSnapshot {
  u: number; s: number; tot: number; cost: number;
  up: string | number; sp: string | number;
  oi: number; td: number;
  entries: [string, DayEntry][];
}

interface AssetSchedule { nextDue: string; lastMaint: string; openEntry: MaintenanceLog | null }

type TabName = typeof TABS[number];

interface GuReportRow { date: string; header: string; status: OpenClosed; note: string; files: number }
interface ReportRange { type: 'week' | 'month'; start: string; end: string; label: string; fileTag: string; titleWord: string }
interface ReportData {
  range: ReportRange;
  en: [string, DayEntry][];
  u: number; s: number; tot: number; cost: number; sp: string | number;
  ws: WaterSummary;
  mwd: WaterDay[];
  mi: Incident[]; td: number;
  mdt: DowntimeRecord[]; tdt: number;
  mev: EventRecord[];
  mml: MaintenanceLog[];
  mrc: RoutineCheck[];
  mgu: GuReportRow[];
  le: Partial<DayEntry>;
}

/** One row of a spreadsheet export. */
type SheetRow = (string | number)[];
