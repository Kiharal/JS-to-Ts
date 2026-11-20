/* ===== STORAGE ===== */
function saveLocal(): void{localStorage.setItem('tec:e',JSON.stringify(E));localStorage.setItem('tec:i',JSON.stringify(I));localStorage.setItem('tec:ev',JSON.stringify(EV));localStorage.setItem('tec:ma',JSON.stringify(MA));localStorage.setItem('tec:ml',JSON.stringify(ML));localStorage.setItem('tec:co',JSON.stringify(CO));localStorage.setItem('tec:dt',JSON.stringify(DT));localStorage.setItem('tec:us',JSON.stringify(US));localStorage.setItem('tec:al',JSON.stringify(AL));localStorage.setItem('tec:rc',JSON.stringify(RC));localStorage.setItem('tec:gu',JSON.stringify(GU));}
function loadLocal(): void{E=readStored<EntryMap>('tec:e',{},isEntryMap);I=readStored<Incident[]>('tec:i',[],isList);EV=readStored<EventRecord[]>('tec:ev',[],isList);MA=readStored<Asset[]>('tec:ma',[],isList);ML=readStored<MaintenanceLog[]>('tec:ml',[],isList);CO=readStored<ComplianceItem[]>('tec:co',[],isList);DT=readStored<DowntimeRecord[]>('tec:dt',[],isList);US=readStored<User[]>('tec:us',[],isList);AL=readStored<ActivityEntry[]>('tec:al',[],isList);RC=readStored<RoutineCheck[]>('tec:rc',[],isList);GU=readStored<UpdateThread[]>('tec:gu',[],isList);}
function payload(): PersistedState{return{entries:E,incidents:I,events:EV,assets:MA,maintLog:ML,compliance:CO,downtime:DT,users:US,activityLog:AL,routineChecks:RC,generalUpdates:GU};}

/* ===== CLOUD (shared data sync, via the same Google Drive bridge as file storage) ===== */
let syncTimer: number | null=null,syncInFlight=false,lastRemoteUpdatedAt: string | null=null,dataLoadedOnce=false;
function setSyncUI(st: SyncState, lbl?: string): void{const d=byId('syncDot'),l=byId('syncLabel');d.className='sdot';if(st==='ok'){d.classList.add('sd-ok');l.textContent=lbl||'Live';}else if(st==='busy'){d.classList.add('sd-busy');l.textContent=lbl||'Syncing…';}else{d.classList.add('sd-no');l.textContent=lbl||'Not synced';}}
function driveDataUrl(action: string): string | null{const cfg=getDriveCfg();if(!cfg.url)return null;try{const u=new URL(cfg.url);u.searchParams.set('action',action);if(cfg.rootId)u.searchParams.set('rootFolderId',cfg.rootId);return u.toString();}catch{return null;}}
/** Parse the text of a backup / bridge payload. Only checks that it is a JSON object (see isPersistedState). */
function parsePersistedState(text: string,badMsg='Invalid file'): Partial<PersistedState>{const v: unknown=JSON.parse(text);if(!isPersistedState(v))throw new Error(badMsg);return v;}
function applyRemoteState(parsed: Partial<PersistedState>): void{E=parsed.entries||{};I=parsed.incidents||[];EV=parsed.events||[];MA=parsed.assets||[];ML=parsed.maintLog||[];CO=parsed.compliance||[];DT=parsed.downtime||[];US=parsed.users&&parsed.users.length?parsed.users:US;AL=parsed.activityLog||AL;RC=parsed.routineChecks||RC;GU=parsed.generalUpdates||GU;}
async function pullCloud(silent: boolean): Promise<SyncResult>{
  if(!driveConfigured())return{ok:true,skipped:true};
  const url=driveDataUrl('data');if(!url)return{ok:false,error:'Bad bridge URL'};
  try{
    setSyncUI('busy','Checking…');
    const res=await fetch(url);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await readBridge(res);
    if(!d||!d.ok)throw new Error((d&&d.error)||'Bad response from the bridge');
    if(d.data&&d.updatedAt!==lastRemoteUpdatedAt){
      applyRemoteState(parsePersistedState(d.data,'Bad data from the bridge'));
      lastRemoteUpdatedAt=d.updatedAt||null;
      saveLocal();
      if(dataLoadedOnce)refreshAfterRemoteChange();
    }
    dataLoadedOnce=true;
    setSyncUI('ok','Live');
    byIdOrNull('syncStatus')&&(byId('syncStatus').innerHTML=`<span style="color:var(--gt)">✓ Connected — last checked ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>`);
    return{ok:true};
  }catch(e){
    setSyncUI('no','Sync error');
    byIdOrNull('syncStatus')&&(byId('syncStatus').textContent='Sync error: '+errorMessage(e));
    if(!silent)toast('Could not reach the Drive bridge: '+errorMessage(e),4500);
    return{ok:false,error:errorMessage(e)};
  }
}
async function pushCloud(): Promise<SyncResult>{
  const cfg=getDriveCfg();
  if(!cfg.url)return{ok:true,skipped:true};
  try{
    setSyncUI('busy','Saving…');
    const res=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'save_data',data:payload(),rootFolderId:cfg.rootId||''})});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await readBridge(res);
    if(!d||!d.ok)throw new Error((d&&d.error)||'Save failed');
    lastRemoteUpdatedAt=d.updatedAt||lastRemoteUpdatedAt;
    setSyncUI('ok','Live');
    return{ok:true};
  }catch(e){
    setSyncUI('no','Sync failed');
    return{ok:false,error:(e?errorMessage(e):'')||'Network error'};
  }
}
async function syncNow(manual: boolean): Promise<void>{
  if(!driveConfigured()){toast('Set up the Google Drive bridge first (Settings → Photo & file storage).');return;}
  if(syncInFlight)return;
  syncInFlight=true;
  const r=await pullCloud(!manual);
  syncInFlight=false;
  if(manual){if(r.ok)toast('Up to date.');else toast('Sync failed: '+r.error,4000);}
}
function startAutoSync(): void{
  if(syncTimer)clearInterval(syncTimer);
  if(!driveConfigured())return;
  syncTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!syncInFlight){syncInFlight=true;pullCloud(true).finally(()=>syncInFlight=false);}},20000);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&driveConfigured()&&!syncInFlight){syncInFlight=true;pullCloud(true).finally(()=>syncInFlight=false);}});
function refreshAfterRemoteChange(): void{updateAll();renderTab(currentTab);toast('Updated with the latest from your team.',2500);}
function exportJSON(): void{const a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(JSON.stringify({...payload(),exported:new Date().toISOString()},null,2));a.download=`TEC_Data_${today()}.json`;a.click();logActivity('export_data','Exported JSON backup');toast('Exported!');}
function importJSON(ev: Event): void{
  const input=ev.target;
  if(!(input instanceof HTMLInputElement))return;
  if(!requirePerm(['admin','superadmin'])){input.value='';return;}
  const f=input.files?.[0];if(!f)return;
  const r=new FileReader();
  r.onload=async()=>{try{const d=parsePersistedState(String(r.result));if(!d.entries)throw new Error('Invalid file');E=d.entries;I=d.incidents||[];EV=d.events||[];MA=d.assets||[];ML=d.maintLog||[];CO=d.compliance||[];DT=d.downtime||[];US=d.users&&d.users.length?d.users:US;AL=d.activityLog||AL;RC=d.routineChecks||RC;GU=d.generalUpdates||GU;saveLocal();await pushCloud();updateAll();logActivity('import_data','Imported JSON backup');toast('Imported!');}catch(err){toast('Import failed: '+errorMessage(err),4000);}};
  r.readAsText(f);input.value='';}
function resetLocal(): void{if(!requirePerm(['superadmin']))return;if(!confirm((driveConfigured()?'This clears data for EVERYONE who syncs to this Drive bridge, not just this device.\n\n':'')+'Clear ALL operational data? (User accounts and the activity log are kept.)'))return;E={};I=[];EV=[];MA=[];ML=[];CO=[];DT=[];logActivity('reset_data','Cleared all operational data');save();updateAll();toast('Cleared.');}

