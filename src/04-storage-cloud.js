/* ===== STORAGE ===== */
function saveLocal(){localStorage.setItem('tec:e',JSON.stringify(E));localStorage.setItem('tec:i',JSON.stringify(I));localStorage.setItem('tec:ev',JSON.stringify(EV));localStorage.setItem('tec:ma',JSON.stringify(MA));localStorage.setItem('tec:ml',JSON.stringify(ML));localStorage.setItem('tec:co',JSON.stringify(CO));localStorage.setItem('tec:dt',JSON.stringify(DT));localStorage.setItem('tec:us',JSON.stringify(US));localStorage.setItem('tec:al',JSON.stringify(AL));localStorage.setItem('tec:rc',JSON.stringify(RC));localStorage.setItem('tec:gu',JSON.stringify(GU));}
function loadLocal(){try{E=JSON.parse(localStorage.getItem('tec:e')||'{}');}catch{E={};}try{I=JSON.parse(localStorage.getItem('tec:i')||'[]');}catch{I=[];}try{EV=JSON.parse(localStorage.getItem('tec:ev')||'[]');}catch{EV=[];}try{MA=JSON.parse(localStorage.getItem('tec:ma')||'[]');}catch{MA=[];}try{ML=JSON.parse(localStorage.getItem('tec:ml')||'[]');}catch{ML=[];}try{CO=JSON.parse(localStorage.getItem('tec:co')||'[]');}catch{CO=[];}try{DT=JSON.parse(localStorage.getItem('tec:dt')||'[]');}catch{DT=[];}try{US=JSON.parse(localStorage.getItem('tec:us')||'[]');}catch{US=[];}try{AL=JSON.parse(localStorage.getItem('tec:al')||'[]');}catch{AL=[];}try{RC=JSON.parse(localStorage.getItem('tec:rc')||'[]');}catch{RC=[];}try{GU=JSON.parse(localStorage.getItem('tec:gu')||'[]');}catch{GU=[];}}
function payload(){return{entries:E,incidents:I,events:EV,assets:MA,maintLog:ML,compliance:CO,downtime:DT,users:US,activityLog:AL,routineChecks:RC,generalUpdates:GU};}

/* ===== CLOUD (shared data sync, via the same Google Drive bridge as file storage) ===== */
let syncTimer=null,syncInFlight=false,lastRemoteUpdatedAt=null,dataLoadedOnce=false;
function setSyncUI(st,lbl){const d=document.getElementById('syncDot'),l=document.getElementById('syncLabel');d.className='sdot';if(st==='ok'){d.classList.add('sd-ok');l.textContent=lbl||'Live';}else if(st==='busy'){d.classList.add('sd-busy');l.textContent=lbl||'Syncing…';}else{d.classList.add('sd-no');l.textContent=lbl||'Not synced';}}
function driveDataUrl(action){const cfg=getDriveCfg();if(!cfg.url)return null;try{const u=new URL(cfg.url);u.searchParams.set('action',action);if(cfg.rootId)u.searchParams.set('rootFolderId',cfg.rootId);return u.toString();}catch{return null;}}
function applyRemoteState(parsed){E=parsed.entries||{};I=parsed.incidents||[];EV=parsed.events||[];MA=parsed.assets||[];ML=parsed.maintLog||[];CO=parsed.compliance||[];DT=parsed.downtime||[];US=parsed.users&&parsed.users.length?parsed.users:US;AL=parsed.activityLog||AL;RC=parsed.routineChecks||RC;GU=parsed.generalUpdates||GU;}
async function pullCloud(silent){
  if(!driveConfigured())return{ok:true,skipped:true};
  const url=driveDataUrl('data');if(!url)return{ok:false,error:'Bad bridge URL'};
  try{
    setSyncUI('busy','Checking…');
    const res=await fetch(url);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await res.json();
    if(!d||!d.ok)throw new Error((d&&d.error)||'Bad response from the bridge');
    if(d.data&&d.updatedAt!==lastRemoteUpdatedAt){
      applyRemoteState(JSON.parse(d.data));
      lastRemoteUpdatedAt=d.updatedAt||null;
      saveLocal();
      if(dataLoadedOnce)refreshAfterRemoteChange();
    }
    dataLoadedOnce=true;
    setSyncUI('ok','Live');
    document.getElementById('syncStatus')&&(document.getElementById('syncStatus').innerHTML=`<span style="color:var(--gt)">✓ Connected — last checked ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>`);
    return{ok:true};
  }catch(e){
    setSyncUI('no','Sync error');
    document.getElementById('syncStatus')&&(document.getElementById('syncStatus').textContent='Sync error: '+e.message);
    if(!silent)toast('Could not reach the Drive bridge: '+e.message,4500);
    return{ok:false,error:e.message};
  }
}
async function pushCloud(){
  if(!driveConfigured())return{ok:true,skipped:true};
  const cfg=getDriveCfg();
  try{
    setSyncUI('busy','Saving…');
    const res=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'save_data',data:payload(),rootFolderId:cfg.rootId||''})});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await res.json();
    if(!d||!d.ok)throw new Error((d&&d.error)||'Save failed');
    lastRemoteUpdatedAt=d.updatedAt||lastRemoteUpdatedAt;
    setSyncUI('ok','Live');
    return{ok:true};
  }catch(e){
    setSyncUI('no','Sync failed');
    return{ok:false,error:(e&&e.message)||'Network error'};
  }
}
async function syncNow(manual){
  if(!driveConfigured()){toast('Set up the Google Drive bridge first (Settings → Photo & file storage).');return;}
  if(syncInFlight)return;
  syncInFlight=true;
  const r=await pullCloud(!manual);
  syncInFlight=false;
  if(manual){if(r.ok)toast('Up to date.');else toast('Sync failed: '+r.error,4000);}
}
function startAutoSync(){
  if(syncTimer)clearInterval(syncTimer);
  if(!driveConfigured())return;
  syncTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!syncInFlight){syncInFlight=true;pullCloud(true).finally(()=>syncInFlight=false);}},20000);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&driveConfigured()&&!syncInFlight){syncInFlight=true;pullCloud(true).finally(()=>syncInFlight=false);}});
function refreshAfterRemoteChange(){updateAll();renderTab(currentTab);toast('Updated with the latest from your team.',2500);}
function exportJSON(){const a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(JSON.stringify({...payload(),exported:new Date().toISOString()},null,2));a.download=`TEC_Data_${today()}.json`;a.click();logActivity('export_data','Exported JSON backup');toast('Exported!');}
function importJSON(ev){if(!requirePerm(['admin','superadmin'])){ev.target.value='';return;}const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=async e=>{try{const d=JSON.parse(e.target.result);if(!d.entries)throw new Error('Invalid file');E=d.entries;I=d.incidents||[];EV=d.events||[];MA=d.assets||[];ML=d.maintLog||[];CO=d.compliance||[];DT=d.downtime||[];US=d.users&&d.users.length?d.users:US;AL=d.activityLog||AL;RC=d.routineChecks||RC;GU=d.generalUpdates||GU;saveLocal();await pushCloud();updateAll();logActivity('import_data','Imported JSON backup');toast('Imported!');}catch(err){toast('Import failed: '+err.message,4000);}};r.readAsText(f);ev.target.value='';}
function resetLocal(){if(!requirePerm(['superadmin']))return;if(!confirm((driveConfigured()?'This clears data for EVERYONE who syncs to this Drive bridge, not just this device.\n\n':'')+'Clear ALL operational data? (User accounts and the activity log are kept.)'))return;E={};I=[];EV=[];MA=[];ML=[];CO=[];DT=[];logActivity('reset_data','Cleared all operational data');save();updateAll();toast('Cleared.');}

