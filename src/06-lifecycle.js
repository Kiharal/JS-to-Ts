/* ===== INIT ===== */
async function init(){
  document.getElementById('entryDate').max=today();
  loadLocal();
  await ensureDefaultUsers();
  const dc=getDriveCfg();
  document.getElementById('driveUrl').value=dc.url||'';
  document.getElementById('driveRoot').value=dc.rootId||'';
  updateDriveStatusUI();
  if(driveConfigured()){
    await pullCloud(true);
    startAutoSync();
  }else{
    setSyncUI('no','Not synced');
  }
  restoreSession();
}

/* ===== SAVE ===== */
async function save(){
  saveLocal();
  if(driveConfigured()){
    const r=await pushCloud();
    if(!r.ok)toast('Saved on this device, but cloud sync failed: '+r.error+'. Your entry is safe locally and will sync automatically once the connection is back.',6000);
  }
}

/* ===== FULL UPDATE ===== */
function updateAll(){
  const n=today();
  document.getElementById('todayDate').textContent=fmt(n);
  const lk=Object.keys(E).sort().pop();
  document.getElementById('lastUpdated').textContent=lk?'Last entry: '+fmt(lk):'No entries yet';
  document.getElementById('entryDate').value=n;
  buildDashboard();renderAllEntries();buildPrintMonths();
  if(!driveConfigured())setSyncUI('no','Not synced');
}

/* ===== DATA HELPERS ===== */
function getMonthEntries(m){return Object.entries(E).filter(([d])=>d.startsWith(m)).sort(([a],[b])=>a.localeCompare(b));}
function calcCons(entries){let u=0,s=0;for(let i=1;i<entries.length;i++){const p=entries[i-1][1],c=entries[i][1];if(c.utility&&p.utility&&c.utility>p.utility)u+=c.utility-p.utility;s+=(Number(c.solar1)||0)+(Number(c.solar2)||0);}if(entries.length===1)s=(Number(entries[0][1].solar1)||0)+(Number(entries[0][1].solar2)||0);return{u,s};}
function curMonthData(){const nm=today().slice(0,7);const en=getMonthEntries(nm);const{u,s}=calcCons([...en]);const tot=u+s;const up=tot>0?(u/tot*100).toFixed(1):0;const sp=tot>0?(s/tot*100).toFixed(1):0;const oi=I.filter(i=>i.status!=='Resolved').length;const td=I.reduce((a,i)=>a+incidentManHours(i),0);return{u,s,tot,cost:u*CPK,up,sp,oi,td,entries:en};}

