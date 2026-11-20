/* ===== FILE ATTACHMENTS (generic, used across Updates / Events / Incidents / Downtime / Maintenance / Routine Checks / Compliance) ===== */
const MAX_ATTACH_BYTES=4*1024*1024;      // embedded-in-JSON limit (no Drive connected)
const MAX_DRIVE_BYTES=20*1024*1024;      // uploaded-to-Drive limit
let pendingAttachments: Record<string, Attachment[]>={};
function resetAttachments(key: string): void{pendingAttachments[key]=[];}
function loadAttachments(key: string, list: Attachment[] | null | undefined): void{pendingAttachments[key]=(list||[]).map(a=>({...a}));}
function fileToBase64(file: File): Promise<string>{return new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=()=>rej(new Error('Could not read '+file.name));r.readAsDataURL(file);});}
function fileToBase64Raw(file: File): Promise<string>{return new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',').pop()??'');r.onerror=()=>rej(new Error('Could not read '+file.name));r.readAsDataURL(file);});}
function fmtBytes(n: number): string{if(n<1024)return n+' B';if(n<1024*1024)return(n/1024).toFixed(1)+' KB';return(n/1024/1024).toFixed(2)+' MB';}

/* ---- Google Drive bridge (Apps Script Web App) ---- */
/* Fill this in once you have your Apps Script Web App URL (Settings → Photo & file storage → Google Drive) and this file "just works" for
   everyone you share it with — no one has to paste anything into Settings. Leave both blank to require each device to set it up individually instead. */
const DEFAULT_DRIVE_CFG: DriveConfig={url:'',rootId:''};
const DK='tec:drivecfg';
function isDriveConfig(v: unknown): v is DriveConfig{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function getDriveCfg(): DriveConfig{const c=readStored<DriveConfig>(DK,{},isDriveConfig);return c.url?c:(DEFAULT_DRIVE_CFG.url?DEFAULT_DRIVE_CFG:c);}
function setDriveCfg(c: DriveConfig): void{localStorage.setItem(DK,JSON.stringify(c));}
function driveConfigured(): boolean{return!!getDriveCfg().url;}

/* Which Drive sub-folder a given form's uploads should land in, mirroring the tab/category structure */
function attachFolderPath(key: string): string[]{
  if(key==='gu'||key.indexOf('gu_')===0)return['General Updates'];
  if(key==='comp'){const v=byIdOrNull('cCat');return['Compliance',(v&&v.value)||'General'];}
  if(key==='ev'){const v=byIdOrNull('evCat');return['Events',(v&&v.value)||'General'];}
  if(key==='inc'){const v=byIdOrNull('iCat');return['Incidents',(v&&v.value)||'General'];}
  if(key==='dt'){const v=byIdOrNull('dtCat');return['Downtime',(v&&v.value)||'General'];}
  if(key==='ml'){const id=parseInt(byIdOrNull('logAssetId')?.value??'')||0;const a=MA.find(x=>x.id===id);return['Maintenance',a?a.name:'General'];}
  if(key==='rc'){const id=parseInt(byIdOrNull('rcAsset')?.value??'')||0;const a=MA.find(x=>x.id===id);return['Routine Checks',a?a.name:'General'];}
  if(key==='asset'){const v=byIdOrNull('aType');const t=v?(v.value==='Other'?byIdOrNull('aTypeOther')?.value:v.value):'';return['Maintenance','Equipment Register',t||'General'];}
  return['General'];
}
async function uploadToDrive(file: File, folderPath: string[]): Promise<BridgeResponse | null>{
  const cfg=getDriveCfg();
  if(!cfg.url)return null;
  const base64=await fileToBase64Raw(file);
  const res=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fileName:file.name,mimeType:file.type||'application/octet-stream',base64,folderPath,rootFolderId:cfg.rootId||''})});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const d=await readBridge(res);
  if(!d||!d.ok)throw new Error((d&&d.error)||'Upload failed');
  return d;
}
async function testDriveConnection(): Promise<void>{
  const cfg=getDriveCfg();
  if(!cfg.url){toast('Enter and save the Web App URL first.');return;}
  toast('Testing connection…',2000);
  try{const res=await fetch(cfg.url,{method:'GET'});const d=await res.json();if(d&&d.ok)toast('✓ Connected to the Drive bridge.',3000);else toast('Reached the URL but got an unexpected response — check the Apps Script deployment.',5000);}
  catch(e){toast('Could not reach that URL: '+errorMessage(e),5000);}
}
async function saveDriveCfg(): Promise<void>{
  if(!requirePerm(['admin','superadmin']))return;
  const url=byId('driveUrl').value.trim();
  const rootId=byId('driveRoot').value.trim();
  if(!url){toast('Enter the Apps Script Web App URL');return;}
  setDriveCfg({url,rootId});
  updateDriveStatusUI();
  toast('Drive storage settings saved — checking data sync…');
  // Pull whatever is already shared BEFORE anything on this device has a chance to push — logActivity()
  // (and any other save()) queues a push the instant driveConfigured() is true, so it must wait until
  // after this device has merged in the existing shared data, or it would overwrite it with an empty/
  // stale local copy the moment someone connects a second device.
  lastRemoteUpdatedAt=null;dataLoadedOnce=false;
  const r=await pullCloud(false);
  if(r.ok){await pushCloud();updateAll();renderTab(currentTab);toast('Connected — data sync is live.');}
  startAutoSync();
  logActivity('update_drive_cfg','Configured Drive photo/file storage & data sync');
}
function disconnectDrive(): void{
  if(!requirePerm(['superadmin']))return;
  if(!confirm('Stop syncing photos/files and data via Drive on this device? Nothing already saved is deleted.'))return;
  localStorage.removeItem(DK);
  byId('driveUrl').value='';byId('driveRoot').value='';
  updateDriveStatusUI();
  if(syncTimer){clearInterval(syncTimer);syncTimer=null;}
  setSyncUI('no','Not synced');
  logActivity('update_drive_cfg','Disconnected Drive photo/file storage & data sync');
  toast('Disconnected on this device.');
}
function updateDriveStatusUI(): void{
  const el=byIdOrNull('driveStatus');if(!el)return;
  const cfg=getDriveCfg();
  el.innerHTML=cfg.url?`<span style="color:var(--gt)">✓ Photos & files upload straight to Drive</span> · <span style="color:var(--tm)">${cfg.rootId?'Into folder ID '+cfg.rootId:'Into your Drive root'}</span>`:'<span style="color:var(--tm)">Not connected — attachments are embedded in the JSON instead (max 4MB each).</span>';
}
function copyScript(elId: string): void{const ta=byIdAs(elId,HTMLTextAreaElement);ta.select();ta.setSelectionRange(0,999999);try{document.execCommand('copy');}catch{}if(navigator.clipboard)navigator.clipboard.writeText(ta.value).catch(()=>{});toast('Script copied — paste it into the editor.');}
function showDriveProvider(name: 'zoho' | 'google'): void{
  byId('provZoho').style.display=name==='zoho'?'':'none';
  byId('provGoogle').style.display=name==='google'?'':'none';
  byId('btnProvZoho').classList.toggle('act',name==='zoho');
  byId('btnProvGoogle').classList.toggle('act',name==='google');
}

async function addAttachmentFiles(key: string, inputEl: HTMLInputElement, listElId: string): Promise<void>{
  const files=[...(inputEl.files||[])];
  if(!files.length)return;
  pendingAttachments[key]=pendingAttachments[key]||[];
  const useDrive=driveConfigured();
  for(const f of files){
    const limit=useDrive?MAX_DRIVE_BYTES:MAX_ATTACH_BYTES;
    if(f.size>limit){toast(`"${f.name}" is over ${useDrive?'20MB':'4MB'} and was skipped.`,5000);continue;}
    const item: Attachment={id:Date.now()+'_'+Math.random().toString(36).slice(2),name:f.name,type:f.type,size:f.size};
    if(useDrive){
      try{
        toast('Uploading '+f.name+'…',2500);
        const d=await uploadToDrive(f,attachFolderPath(key));
        if(!d)throw new Error('Drive is not configured');
        item.url=d.url;item.driveId=d.id;
      }catch(err){
        toast(`Drive upload failed for "${f.name}" (${errorMessage(err)}). `+(f.size<=MAX_ATTACH_BYTES?'Saved into the JSON instead so nothing is lost.':'File is too large to embed instead — try again once Drive is reachable.'),6000);
        if(f.size>MAX_ATTACH_BYTES)continue;
        try{item.data=await fileToBase64(f);}catch{toast('Could not attach '+f.name,3000);continue;}
      }
    }else{
      try{item.data=await fileToBase64(f);}catch{toast('Could not attach '+f.name,3000);continue;}
    }
    pendingAttachments[key].push(item);
  }
  inputEl.value='';
  renderAttachList(key,listElId);
}
function removeAttachment(key: string, id: string, listElId: string): void{pendingAttachments[key]=(pendingAttachments[key]||[]).filter(a=>a.id!==id);renderAttachList(key,listElId);}
function attachHref(a: Attachment): string | undefined{return a.url||a.data;}
function renderAttachList(key: string, listElId: string): void{
  const items=pendingAttachments[key]||[];
  const el=byIdOrNull(listElId);
  if(!el)return;
  el.innerHTML=items.length===0?'<div style="font-size:11px;color:var(--tm)">No files attached.</div>':items.map(a=>`
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">
      <i class="ti ${a.url?'ti-cloud-check':'ti-paperclip'}"></i>
      <a href="${attachHref(a)}" target="_blank" rel="noopener" ${a.url?'':`download="${a.name}"`} style="color:var(--ac);word-break:break-all">${a.name}</a>
      <span style="color:var(--tm);white-space:nowrap">(${fmtBytes(a.size)})</span>
      <button type="button" class="btn btd" style="padding:1px 6px;font-size:10px" onclick="removeAttachment('${key}','${a.id}','${listElId}')">Remove</button>
    </div>`).join('');
}
function renderAttachmentsView(attachments: Attachment[] | null | undefined): string{
  if(!attachments||!attachments.length)return'';
  return`<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px">${attachments.map(a=>`<a href="${attachHref(a)}" target="_blank" rel="noopener" ${a.url?'':`download="${a.name}"`} class="badge bn" style="text-decoration:none"><i class="ti ${a.url?'ti-cloud-check':'ti-paperclip'}"></i> ${a.name}</a>`).join('')}</div>`;
}
function m3(litres: number | null): number | null{return litres==null?null:(litres/1000);}
function fmtM3(v: number | null, dec = 2): string{return v==null?'—':(v).toFixed(dec)+' m³';}
function fmtL(v: number | null): string{return v==null?'—':v.toLocaleString()+' L';}

