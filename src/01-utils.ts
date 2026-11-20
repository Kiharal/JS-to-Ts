/* ===== UTILS ===== */
function toLocalISO(dt: Date): string{return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
function addDaysISO(dateStr: string, n: number): string{const dt=new Date(dateStr+'T00:00:00');dt.setDate(dt.getDate()+n);return toLocalISO(dt);}
function lastMonthStr(m: string): string{const[y,mo]=m.split('-').map(Number);const dt=new Date(y,mo-2,1);return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;}
function today(): string{return toLocalISO(new Date());}
function nowLocalDT(): string{const d=new Date();const p=(n: number)=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function combineDT(dateId: string, timeId: string): string{const d=byIdAs(dateId,HTMLInputElement).value;const t=byIdAs(timeId,HTMLInputElement).value;if(!d)return'';return d+'T'+(t||'00:00');}
function splitDT(str: string, dateId: string, timeId: string): void{const dateEl=byIdAs(dateId,HTMLInputElement),timeEl=byIdAs(timeId,HTMLInputElement);if(!str){dateEl.value='';timeEl.value='';return;}const[d,t]=str.split('T');dateEl.value=d||'';timeEl.value=t?t.slice(0,5):'';}
function fmtDT(s: string | null | undefined): string{if(!s)return'—';const d=new Date(s);if(isNaN(d.getTime()))return'—';return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function fmtDuration(mins: number | null | undefined): string{if(mins==null||isNaN(mins))return'—';mins=Math.max(0,Math.round(mins));const h=Math.floor(mins/60),m=mins%60;return h>0?`${h}h ${m}m`:`${m}m`;}
function downtimeMinutes(x: DowntimeRecord): number{
  if(!x.start)return Number(x.duration)||0;
  const s=new Date(x.start);const e=x.end?new Date(x.end):new Date();
  if(isNaN(s.getTime())||isNaN(e.getTime())||e<=s)return 0;
  return Math.round((e.getTime()-s.getTime())/60000);
}
function calcManHours(startStr: string, endStr?: string | null): number{
  if(!startStr)return 0;
  const start=new Date(startStr);const end=endStr?new Date(endStr):new Date();
  if(isNaN(start.getTime())||isNaN(end.getTime())||end<=start)return 0;
  const WS=7,WE=17;let totalMs=0;
  let day=new Date(start.getFullYear(),start.getMonth(),start.getDate());
  const endDay=new Date(end.getFullYear(),end.getMonth(),end.getDate());
  while(day<=endDay){
    if(day.getDay()!==0){
      const workStart=new Date(day.getFullYear(),day.getMonth(),day.getDate(),WS,0,0);
      const workEnd=new Date(day.getFullYear(),day.getMonth(),day.getDate(),WE,0,0);
      const segStart=start>workStart?start:workStart;
      const segEnd=end<workEnd?end:workEnd;
      if(segEnd>segStart)totalMs+=(segEnd.getTime()-segStart.getTime());
    }
    day=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1);
  }
  return totalMs/3600000;
}
function incidentManHours(i: Incident): number{
  if(i.start)return calcManHours(i.start,i.end);
  return(Number(i.downtime)||0)/60;
}
function fmt(d: string | null | undefined): string{if(!d)return'—';return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function fmtM(m: string): string{const[y,mo]=m.split('-').map(Number);return new Date(y,mo-1).toLocaleString('en-GB',{month:'long',year:'numeric'});}
function daysUntil(d: string | null | undefined): number | null{if(!d)return null;return Math.round((new Date(d+'T00:00:00').getTime()-new Date().getTime())/86400000);}
/* Persisted JSON is trusted by contract: these checks only verify the container KIND (object vs array), never the
   shape of each element. Anything else falls back to empty, exactly like the old try/catch-around-JSON.parse did. */
function isEntryMap(v: unknown): v is EntryMap{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function isList<T>(v: unknown): v is T[]{return Array.isArray(v);}
function isPersistedState(v: unknown): v is Partial<PersistedState>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function isBridgeResponse(v: unknown): v is BridgeResponse{return typeof v==='object'&&v!==null;}
function readStored<T>(key: string,fallback: T,isValid: (v: unknown)=>v is T): T{try{const v: unknown=JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));return isValid(v)?v:fallback;}catch{return fallback;}}
/** Parse a Drive-bridge reply; null when it is not a JSON object. */
async function readBridge(res: Response): Promise<BridgeResponse | null>{const v: unknown=await res.json();return isBridgeResponse(v)?v:null;}
/** The signed-in user. Only valid after login; throws otherwise (this used to be an implicit null dereference). */
function requireUser(): User{if(!currentUser)throw new Error('No signed-in user');return currentUser;}
/** Narrow a <select> value to a known union member without a cast; unknown values fall back to `fallback` (the form default). */
function oneOf<T extends string>(allowed: readonly T[],v: string,fallback: T): T{return allowed.find(a=>a===v)??fallback;}
/** Message of a caught value. Duck-typed (not instanceof Error) so errors from other frames/realms still work. */
function errorMessage(e: unknown): string{if(typeof e==='object'&&e!==null&&'message' in e)return String(e.message);return String(e);}
function toast(msg: string, dur = 2500): void{const t=byId('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function dc(id: string): void{if(charts[id]){charts[id].destroy();delete charts[id];}}
/* Chart canvases used to get replaced outright by an "empty" message div when there was no data yet —
   which permanently deleted the canvas element, so the NEXT rebuild (e.g. after adding one asset, or an
   auto-sync refresh) threw trying to look it up again and silently aborted the rest of that render. These
   two keep the canvas in the DOM and just toggle a message next to it instead. */
function setChartEmpty(canvasId: string, msg: string): void{const canvas=byIdOrNull(canvasId);const parent=canvas?.parentElement;if(!canvas||!parent)return;canvas.style.display='none';let e=parent.querySelector('.chart-empty-msg');if(!e){e=document.createElement('div');e.className='empty chart-empty-msg';parent.appendChild(e);}e.textContent=msg;}
function setChartVisible(canvasId: string): void{const canvas=byIdOrNull(canvasId);if(!canvas)return;canvas.style.display='';const e=canvas.parentElement?.querySelector('.chart-empty-msg');if(e)e.remove();}
function togglePanel(id: string): void{byId(id).classList.toggle('open');}
function nextId(arr: readonly { id: number }[]): number{return arr.length?Math.max(...arr.map(x=>x.id))+1:1;}
/* Open items first (newest date first within the group), closed items after (also newest first within their group) */
function sortOpenClosed<T extends { id: number }>(list: T[], isClosedFn: (x: T) => boolean, dateFn: (x: T) => string | null | undefined): T[]{
  const byDateDesc=(a: T,b: T)=>String(dateFn(b)||'').localeCompare(String(dateFn(a)||''))||(b.id-a.id);
  const open=list.filter(x=>!isClosedFn(x)).sort(byDateDesc);
  const closed=list.filter(x=>isClosedFn(x)).sort(byDateDesc);
  return[...open,...closed];
}
function statusBadge(closed: boolean): string{return closed?'<span class="badge bn">Closed</span>':'<span class="badge ba">Open</span>';}

