/* ===== DAILY ENTRY ===== */
function loadEntry(){
  const d=document.getElementById('entryDate').value;const e=E[d]||{};
  document.getElementById('eUtility').value=e.utility||'';document.getElementById('eLoad').value=e.load||'';document.getElementById('eLoadKVA').value=e.loadKVA||'';document.getElementById('eSolar1').value=e.solar1||'';document.getElementById('eSolar2').value=e.solar2||'';
  document.getElementById('wMeter').value=e.water||'';document.getElementById('wNotes').value=e.wNotes||'';
  document.getElementById('sPower').value=e.power||'up';document.getElementById('sInternet').value=e.internet||'up';document.getElementById('sServer').value=e.server||'up';document.getElementById('sSolar').value=e.solar||'operational';
  updateWaterCalc();
  const saved=e.saved||{};
  lockSection('energy',!!saved.energy);lockSection('water',!!saved.water);lockSection('systems',!!saved.systems);
  toast(E[d]?'Loaded entry for '+fmt(d):'New entry for '+fmt(d));
}
function clearEntry(){
  ['eUtility','eLoad','eLoadKVA','eSolar1','eSolar2','wMeter','wNotes'].forEach(x=>document.getElementById(x).value='');
  ['sPower','sInternet','sServer','sSolar'].forEach(x=>document.getElementById(x).value=document.getElementById(x).options[0].value);
  document.getElementById('wCalc').innerHTML='Enter the current meter reading above to see calculated consumption.';
  lockSection('energy',false);lockSection('water',false);lockSection('systems',false);
}
function ensureEntry(d){if(!E[d])E[d]={utility:null,load:null,loadKVA:null,solar1:0,solar2:0,water:null,wNotes:'',power:'up',internet:'up',server:'up',solar:'operational',saved:{}};if(!E[d].saved)E[d].saved={};return E[d];}
function lockSection(name,locked){
  document.querySelectorAll('#'+name+'Section input,#'+name+'Section select,#'+name+'Section textarea').forEach(el=>el.disabled=locked);
  document.getElementById(name+'SaveBtn').style.display=locked?'none':'';
  document.getElementById(name+'EditBtn').style.display=locked?'':'none';
  document.getElementById(name+'SavedBadge').style.display=locked?'':'none';
}
function editSection(name){lockSection(name,false);}
function saveEnergySection(){
  const d=document.getElementById('entryDate').value;if(!d){toast('Select a date');return;}
  const rec=ensureEntry(d);
  rec.utility=Number(document.getElementById('eUtility').value)||null;
  rec.load=Number(document.getElementById('eLoad').value)||null;
  rec.loadKVA=Number(document.getElementById('eLoadKVA').value)||null;
  rec.solar1=Number(document.getElementById('eSolar1').value)||0;
  rec.solar2=Number(document.getElementById('eSolar2').value)||0;
  rec.saved.energy=true;
  logActivity('update_entry','Saved energy readings: '+d);
  updateAll();lockSection('energy',true);toast('Energy readings saved · '+fmt(d));
}
function saveWaterSection(){
  const d=document.getElementById('entryDate').value;if(!d){toast('Select a date');return;}
  const rec=ensureEntry(d);
  rec.water=Number(document.getElementById('wMeter').value)||null;
  rec.wNotes=document.getElementById('wNotes').value;
  rec.saved.water=true;
  logActivity('update_entry','Saved water reading: '+d);
  updateAll();lockSection('water',true);toast('Water reading saved · '+fmt(d));
}
function saveSystemsSection(){
  const d=document.getElementById('entryDate').value;if(!d){toast('Select a date');return;}
  const rec=ensureEntry(d);
  rec.power=document.getElementById('sPower').value;
  rec.internet=document.getElementById('sInternet').value;
  rec.server=document.getElementById('sServer').value;
  rec.solar=document.getElementById('sSolar').value;
  rec.saved.systems=true;
  logActivity('update_entry','Saved systems status: '+d);
  updateAll();lockSection('systems',true);toast('Systems status saved · '+fmt(d));
}
async function deleteEntry(d){if(!requirePerm(['admin','superadmin']))return;if(!confirm('Delete entry for '+fmt(d)+'?'))return;delete E[d];logActivity('delete_entry','Deleted daily entry: '+d);await save();updateAll();toast('Deleted.');}
function editEntryDate(d){document.getElementById('entryDate').value=d;loadEntry();window.scrollTo(0,0);}
function renderAllEntries(){
  const sorted=Object.entries(E).sort(([a],[b])=>b.localeCompare(a));
  const{daily}=getWaterData();
  const waterMap=Object.fromEntries(daily.filter(x=>x.consM3!=null).map(x=>[x.date,x]));
  document.getElementById('allEntriesTable').innerHTML=sorted.length===0?'<div class="empty">No entries yet. Fill in the form and Save.</div>':`
    <table class="tbl"><tr><th>Date</th><th>Utility (kWh)</th><th>Load (kWh)</th><th>Load (kVAh)</th><th>Solar (kWh)</th><th>Meter (m³)</th><th>Water (m³)</th><th>Power</th><th></th></tr>
    ${sorted.map(([d,v])=>{const w=waterMap[d];return`<tr>
      <td>${fmt(d)}</td><td>${v.utility||'—'}</td><td>${v.load||'—'}</td><td>${v.loadKVA||'—'}</td><td>${(Number(v.solar1)||0)+(Number(v.solar2)||0)}</td>
      <td style="font-family:monospace;font-size:11px">${v.water?(v.water/1000).toFixed(3):'—'}</td>
      <td style="color:var(--wc)">${w?w.consM3.toFixed(3):v.water?'Baseline':'—'}</td>
      <td>${v.power||'—'}</td>
      <td style="display:flex;gap:5px"><button class="bts btn" onclick="editEntryDate('${d}')">Edit</button><button class="btd btn role-gate-admin" onclick="deleteEntry('${d}')">Del</button></td>
    </tr>`}).join('')}
    </table>`;}

