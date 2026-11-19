/* ===== UTILS ===== */
function toLocalISO(dt){return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
function addDaysISO(dateStr,n){const dt=new Date(dateStr+'T00:00:00');dt.setDate(dt.getDate()+n);return toLocalISO(dt);}
function lastMonthStr(m){const[y,mo]=m.split('-').map(Number);const dt=new Date(y,mo-2,1);return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;}
function today(){return toLocalISO(new Date());}
function nowLocalDT(){const d=new Date();const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function combineDT(dateId,timeId){const d=document.getElementById(dateId).value;const t=document.getElementById(timeId).value;if(!d)return'';return d+'T'+(t||'00:00');}
function splitDT(str,dateId,timeId){if(!str){document.getElementById(dateId).value='';document.getElementById(timeId).value='';return;}const[d,t]=str.split('T');document.getElementById(dateId).value=d||'';document.getElementById(timeId).value=t?t.slice(0,5):'';}
function fmtDT(s){if(!s)return'—';const d=new Date(s);if(isNaN(d.getTime()))return'—';return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function fmtDuration(mins){if(mins==null||isNaN(mins))return'—';mins=Math.max(0,Math.round(mins));const h=Math.floor(mins/60),m=mins%60;return h>0?`${h}h ${m}m`:`${m}m`;}
function downtimeMinutes(x){
  if(!x.start)return Number(x.duration)||0;
  const s=new Date(x.start);const e=x.end?new Date(x.end):new Date();
  if(isNaN(s.getTime())||isNaN(e.getTime())||e<=s)return 0;
  return Math.round((e-s)/60000);
}
function calcManHours(startStr,endStr){
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
      if(segEnd>segStart)totalMs+=(segEnd-segStart);
    }
    day=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1);
  }
  return totalMs/3600000;
}
function incidentManHours(i){
  if(i.start)return calcManHours(i.start,i.end);
  return(Number(i.downtime)||0)/60;
}
function fmt(d){if(!d)return'—';return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function fmtM(m){const[y,mo]=m.split('-');return new Date(y,mo-1).toLocaleString('en-GB',{month:'long',year:'numeric'});}
function daysUntil(d){if(!d)return null;return Math.round((new Date(d+'T00:00:00')-new Date())/86400000);}
function toast(msg,dur=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function dc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
/* Chart canvases used to get replaced outright by an "empty" message div when there was no data yet —
   which permanently deleted the canvas element, so the NEXT rebuild (e.g. after adding one asset, or an
   auto-sync refresh) threw trying to look it up again and silently aborted the rest of that render. These
   two keep the canvas in the DOM and just toggle a message next to it instead. */
function setChartEmpty(canvasId,msg){const canvas=document.getElementById(canvasId);if(!canvas)return;canvas.style.display='none';let e=canvas.parentElement.querySelector('.chart-empty-msg');if(!e){e=document.createElement('div');e.className='empty chart-empty-msg';canvas.parentElement.appendChild(e);}e.textContent=msg;}
function setChartVisible(canvasId){const canvas=document.getElementById(canvasId);if(!canvas)return;canvas.style.display='';const e=canvas.parentElement.querySelector('.chart-empty-msg');if(e)e.remove();}
function togglePanel(id){document.getElementById(id).classList.toggle('open');}
function nextId(arr){return arr.length?Math.max(...arr.map(x=>x.id))+1:1;}
/* Open items first (newest date first within the group), closed items after (also newest first within their group) */
function sortOpenClosed(list,isClosedFn,dateFn){
  const byDateDesc=(a,b)=>String(dateFn(b)||'').localeCompare(String(dateFn(a)||''))||(b.id-a.id);
  const open=list.filter(x=>!isClosedFn(x)).sort(byDateDesc);
  const closed=list.filter(x=>isClosedFn(x)).sort(byDateDesc);
  return[...open,...closed];
}
function statusBadge(closed){return closed?'<span class="badge bn">Closed</span>':'<span class="badge ba">Open</span>';}

