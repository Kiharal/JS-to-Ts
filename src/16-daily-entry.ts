/* ===== DAILY ENTRY ===== */
function loadEntry(): void{
  const d=byId('entryDate').value;const e=E[d]||{};
  byId('eUtility').value=String(e.utility||'');byId('eLoad').value=String(e.load||'');byId('eLoadKVA').value=String(e.loadKVA||'');byId('eSolar1').value=String(e.solar1||'');byId('eSolar2').value=String(e.solar2||'');
  byId('wMeter').value=String(e.water||'');byId('wNotes').value=e.wNotes||'';
  byId('sPower').value=e.power||'up';byId('sInternet').value=e.internet||'up';byId('sServer').value=e.server||'up';byId('sSolar').value=e.solar||'operational';
  updateWaterCalc();
  const saved=e.saved||{};
  lockSection('energy',!!saved.energy);lockSection('water',!!saved.water);lockSection('systems',!!saved.systems);
  toast(E[d]?'Loaded entry for '+fmt(d):'New entry for '+fmt(d));
}
function clearEntry(): void{
  (['eUtility','eLoad','eLoadKVA','eSolar1','eSolar2','wMeter','wNotes'] as const).forEach(x=>byId(x).value='');
  (['sPower','sInternet','sServer','sSolar'] as const).forEach(x=>byId(x).value=byId(x).options[0].value);
  byId('wCalc').innerHTML='Enter the current meter reading above to see calculated consumption.';
  lockSection('energy',false);lockSection('water',false);lockSection('systems',false);
}
function ensureEntry(d: string): DayEntry{if(!E[d])E[d]={utility:null,load:null,loadKVA:null,solar1:0,solar2:0,water:null,wNotes:'',power:'up',internet:'up',server:'up',solar:'operational',saved:{}};if(!E[d].saved)E[d].saved={};return E[d];}
function lockSection(name: string, locked: boolean): void{
  document.querySelectorAll<FormControl>('#'+name+'Section input,#'+name+'Section select,#'+name+'Section textarea').forEach(el=>el.disabled=locked);
  byId(name+'SaveBtn').style.display=locked?'none':'';
  byId(name+'EditBtn').style.display=locked?'':'none';
  byId(name+'SavedBadge').style.display=locked?'':'none';
}
function editSection(name: string): void{lockSection(name,false);}
function saveEnergySection(): void{
  const d=byId('entryDate').value;if(!d){toast('Select a date');return;}
  const rec=ensureEntry(d);
  rec.utility=Number(byId('eUtility').value)||null;
  rec.load=Number(byId('eLoad').value)||null;
  rec.loadKVA=Number(byId('eLoadKVA').value)||null;
  rec.solar1=Number(byId('eSolar1').value)||0;
  rec.solar2=Number(byId('eSolar2').value)||0;
  rec.saved.energy=true;
  logActivity('update_entry','Saved energy readings: '+d);
  updateAll();lockSection('energy',true);toast('Energy readings saved · '+fmt(d));
}
function saveWaterSection(): void{
  const d=byId('entryDate').value;if(!d){toast('Select a date');return;}
  const rec=ensureEntry(d);
  rec.water=Number(byId('wMeter').value)||null;
  rec.wNotes=byId('wNotes').value;
  rec.saved.water=true;
  logActivity('update_entry','Saved water reading: '+d);
  updateAll();lockSection('water',true);toast('Water reading saved · '+fmt(d));
}
function saveSystemsSection(): void{
  const d=byId('entryDate').value;if(!d){toast('Select a date');return;}
  const rec=ensureEntry(d);
  rec.power=oneOf(['up','partial','down'],byId('sPower').value,'up');
  rec.internet=oneOf(['up','degraded','down'],byId('sInternet').value,'up');
  rec.server=oneOf(['up','degraded','down'],byId('sServer').value,'up');
  rec.solar=oneOf(['operational','partial','down'],byId('sSolar').value,'operational');
  rec.saved.systems=true;
  logActivity('update_entry','Saved systems status: '+d);
  updateAll();lockSection('systems',true);toast('Systems status saved · '+fmt(d));
}
async function deleteEntry(d: string): Promise<void>{if(!requirePerm(['admin','superadmin']))return;if(!confirm('Delete entry for '+fmt(d)+'?'))return;delete E[d];logActivity('delete_entry','Deleted daily entry: '+d);await save();updateAll();toast('Deleted.');}
function editEntryDate(d: string): void{byId('entryDate').value=d;loadEntry();window.scrollTo(0,0);}
function renderAllEntries(): void{
  const sorted=Object.entries(E).sort(([a],[b])=>b.localeCompare(a));
  const{daily}=getWaterData();
  const waterMap=Object.fromEntries(daily.filter(x=>x.consM3!=null).map(x=>[x.date,x]));
  byId('allEntriesTable').innerHTML=sorted.length===0?'<div class="empty">No entries yet. Fill in the form and Save.</div>':`
    <table class="tbl"><tr><th>Date</th><th>Utility (kWh)</th><th>Load (kWh)</th><th>Load (kVAh)</th><th>Solar (kWh)</th><th>Meter (m³)</th><th>Water (m³)</th><th>Power</th><th></th></tr>
    ${sorted.map(([d,v])=>{const w=waterMap[d];return`<tr>
      <td>${fmt(d)}</td><td>${v.utility||'—'}</td><td>${v.load||'—'}</td><td>${v.loadKVA||'—'}</td><td>${(Number(v.solar1)||0)+(Number(v.solar2)||0)}</td>
      <td style="font-family:monospace;font-size:11px">${v.water?(v.water/1000).toFixed(3):'—'}</td>
      <td style="color:var(--wc)">${w?w.consM3.toFixed(3):v.water?'Baseline':'—'}</td>
      <td>${v.power||'—'}</td>
      <td style="display:flex;gap:5px"><button class="bts btn" onclick="editEntryDate('${d}')">Edit</button><button class="btd btn role-gate-admin" onclick="deleteEntry('${d}')">Del</button></td>
    </tr>`}).join('')}
    </table>`;}

