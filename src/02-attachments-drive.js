/* ===== FILE ATTACHMENTS (generic, used across Updates / Events / Incidents / Downtime / Maintenance / Routine Checks / Compliance) ===== */
const MAX_ATTACH_BYTES=4*1024*1024;      // embedded-in-JSON limit (no Drive connected)
const MAX_DRIVE_BYTES=20*1024*1024;      // uploaded-to-Drive limit
let pendingAttachments={};
function resetAttachments(key){pendingAttachments[key]=[];}
function loadAttachments(key,list){pendingAttachments[key]=(list||[]).map(a=>({...a}));}
function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Could not read '+file.name));r.readAsDataURL(file);});}
function fileToBase64Raw(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',').pop());r.onerror=()=>rej(new Error('Could not read '+file.name));r.readAsDataURL(file);});}
function fmtBytes(n){if(n<1024)return n+' B';if(n<1024*1024)return(n/1024).toFixed(1)+' KB';return(n/1024/1024).toFixed(2)+' MB';}

/* ---- Google Drive bridge (Apps Script Web App) ---- */
/* Fill this in once you have your Apps Script Web App URL (Settings → Photo & file storage → Google Drive) and this file "just works" for
   everyone you share it with — no one has to paste anything into Settings. Leave both blank to require each device to set it up individually instead. */
const DEFAULT_DRIVE_CFG={url:'',rootId:''};
const DK='tec:drivecfg';
function getDriveCfg(){let c;try{c=JSON.parse(localStorage.getItem(DK)||'{}');}catch{c={};}return c.url?c:(DEFAULT_DRIVE_CFG.url?DEFAULT_DRIVE_CFG:c);}
function setDriveCfg(c){localStorage.setItem(DK,JSON.stringify(c));}
function driveConfigured(){return!!getDriveCfg().url;}

/* Which Drive sub-folder a given form's uploads should land in, mirroring the tab/category structure */
function attachFolderPath(key){
  if(key==='gu'||key.indexOf('gu_')===0)return['General Updates'];
  if(key==='comp'){const v=document.getElementById('cCat');return['Compliance',(v&&v.value)||'General'];}
  if(key==='ev'){const v=document.getElementById('evCat');return['Events',(v&&v.value)||'General'];}
  if(key==='inc'){const v=document.getElementById('iCat');return['Incidents',(v&&v.value)||'General'];}
  if(key==='dt'){const v=document.getElementById('dtCat');return['Downtime',(v&&v.value)||'General'];}
  if(key==='ml'){const id=parseInt((document.getElementById('logAssetId')||{}).value)||0;const a=MA.find(x=>x.id===id);return['Maintenance',a?a.name:'General'];}
  if(key==='rc'){const id=parseInt((document.getElementById('rcAsset')||{}).value)||0;const a=MA.find(x=>x.id===id);return['Routine Checks',a?a.name:'General'];}
  if(key==='asset'){const v=document.getElementById('aType');const t=v?(v.value==='Other'?(document.getElementById('aTypeOther')||{}).value:v.value):'';return['Maintenance','Equipment Register',t||'General'];}
  return['General'];
}
async function uploadToDrive(file,folderPath){
  const cfg=getDriveCfg();
  if(!cfg.url)return null;
  const base64=await fileToBase64Raw(file);
  const res=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fileName:file.name,mimeType:file.type||'application/octet-stream',base64,folderPath,rootFolderId:cfg.rootId||''})});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const d=await res.json();
  if(!d||!d.ok)throw new Error((d&&d.error)||'Upload failed');
  return d;
}
async function testDriveConnection(){
  const cfg=getDriveCfg();
  if(!cfg.url){toast('Enter and save the Web App URL first.');return;}
  toast('Testing connection…',2000);
  try{const res=await fetch(cfg.url,{method:'GET'});const d=await res.json();if(d&&d.ok)toast('✓ Connected to the Drive bridge.',3000);else toast('Reached the URL but got an unexpected response — check the Apps Script deployment.',5000);}
  catch(e){toast('Could not reach that URL: '+e.message,5000);}
}
async function saveDriveCfg(){
  if(!requirePerm(['admin','superadmin']))return;
  const url=document.getElementById('driveUrl').value.trim();
  const rootId=document.getElementById('driveRoot').value.trim();
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
function disconnectDrive(){
  if(!requirePerm(['superadmin']))return;
  if(!confirm('Stop syncing photos/files and data via Drive on this device? Nothing already saved is deleted.'))return;
  localStorage.removeItem(DK);
  document.getElementById('driveUrl').value='';document.getElementById('driveRoot').value='';
  updateDriveStatusUI();
  if(syncTimer){clearInterval(syncTimer);syncTimer=null;}
  setSyncUI('no','Not synced');
  logActivity('update_drive_cfg','Disconnected Drive photo/file storage & data sync');
  toast('Disconnected on this device.');
}
function updateDriveStatusUI(){
  const el=document.getElementById('driveStatus');if(!el)return;
  const cfg=getDriveCfg();
  el.innerHTML=cfg.url?`<span style="color:var(--gt)">✓ Photos & files upload straight to Drive</span> · <span style="color:var(--tm)">${cfg.rootId?'Into folder ID '+cfg.rootId:'Into your Drive root'}</span>`:'<span style="color:var(--tm)">Not connected — attachments are embedded in the JSON instead (max 4MB each).</span>';
}
function copyScript(elId){const ta=document.getElementById(elId);ta.select();ta.setSelectionRange(0,999999);try{document.execCommand('copy');}catch{}if(navigator.clipboard)navigator.clipboard.writeText(ta.value).catch(()=>{});toast('Script copied — paste it into the editor.');}
function showDriveProvider(name){
  document.getElementById('provZoho').style.display=name==='zoho'?'':'none';
  document.getElementById('provGoogle').style.display=name==='google'?'':'none';
  document.getElementById('btnProvZoho').classList.toggle('act',name==='zoho');
  document.getElementById('btnProvGoogle').classList.toggle('act',name==='google');
}

async function addAttachmentFiles(key,inputEl,listElId){
  const files=[...(inputEl.files||[])];
  if(!files.length)return;
  pendingAttachments[key]=pendingAttachments[key]||[];
  const useDrive=driveConfigured();
  for(const f of files){
    const limit=useDrive?MAX_DRIVE_BYTES:MAX_ATTACH_BYTES;
    if(f.size>limit){toast(`"${f.name}" is over ${useDrive?'20MB':'4MB'} and was skipped.`,5000);continue;}
    const item={id:Date.now()+'_'+Math.random().toString(36).slice(2),name:f.name,type:f.type,size:f.size};
    if(useDrive){
      try{
        toast('Uploading '+f.name+'…',2500);
        const d=await uploadToDrive(f,attachFolderPath(key));
        item.url=d.url;item.driveId=d.id;
      }catch(err){
        toast(`Drive upload failed for "${f.name}" (${err.message}). `+(f.size<=MAX_ATTACH_BYTES?'Saved into the JSON instead so nothing is lost.':'File is too large to embed instead — try again once Drive is reachable.'),6000);
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
function removeAttachment(key,id,listElId){pendingAttachments[key]=(pendingAttachments[key]||[]).filter(a=>a.id!==id);renderAttachList(key,listElId);}
function attachHref(a){return a.url||a.data;}
function renderAttachList(key,listElId){
  const items=pendingAttachments[key]||[];
  const el=document.getElementById(listElId);
  if(!el)return;
  el.innerHTML=items.length===0?'<div style="font-size:11px;color:var(--tm)">No files attached.</div>':items.map(a=>`
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">
      <i class="ti ${a.url?'ti-cloud-check':'ti-paperclip'}"></i>
      <a href="${attachHref(a)}" target="_blank" rel="noopener" ${a.url?'':`download="${a.name}"`} style="color:var(--ac);word-break:break-all">${a.name}</a>
      <span style="color:var(--tm);white-space:nowrap">(${fmtBytes(a.size)})</span>
      <button type="button" class="btn btd" style="padding:1px 6px;font-size:10px" onclick="removeAttachment('${key}','${a.id}','${listElId}')">Remove</button>
    </div>`).join('');
}
function renderAttachmentsView(attachments){
  if(!attachments||!attachments.length)return'';
  return`<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px">${attachments.map(a=>`<a href="${attachHref(a)}" target="_blank" rel="noopener" ${a.url?'':`download="${a.name}"`} class="badge bn" style="text-decoration:none"><i class="ti ${a.url?'ti-cloud-check':'ti-paperclip'}"></i> ${a.name}</a>`).join('')}</div>`;
}
function m3(litres){return litres==null?null:(litres/1000);}
function fmtM3(v,dec=2){return v==null?'—':(v).toFixed(dec)+' m³';}
function fmtL(v){return v==null?'—':v.toLocaleString()+' L';}

