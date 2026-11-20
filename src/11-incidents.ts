/* ===== INCIDENTS ===== */
function updateIncType(): void{const c=byId('iCat').value;const hints: Lookup<string>={'Health & Safety':'Fire drill, Near miss, Injury, Hazard',Power:'Mains outage, Generator failure, Overload',Equipment:'Pump breakdown, UPS fault, AC failure',Water:'Burst pipe, Leak, Low pressure, Contamination'};byId('iTypeHint').textContent=hints[c]?`— ${hints[c]}`:'';byId('iType').placeholder=hints[c]||'Specify the incident';}
function saveIncident(): void{
  const id=parseInt(byId('incId').value)||0;
  if(id){if(!requirePerm(['admin','superadmin']))return;}else if(!requireCreatePerm())return;
  const cat=byId('iCat').value;
  const type=byId('iType').value.trim();
  if(!cat||!type){toast('Category and incident type required');return;}
  const start=combineDT('iStartDate','iStartTime');
  if(!start){toast('Enter the start date');return;}
  let end=combineDT('iEndDate','iEndTime');
  const status=byId('iStatus').value;
  if(end&&end<start){toast('Resolved time cannot be before the start time');return;}
  if(status==='Resolved'&&!end){end=nowLocalDT();splitDT(end,'iEndDate','iEndTime');toast('Resolved time set to now.',3000);}
  const obj: Incident={id:id||nextId(I),date:start.slice(0,10),start,end,category:cat,type,severity:byId('iSev').value,system:byId('iSystem').value,description:byId('iDesc').value,cause:byId('iCause').value,action:byId('iAction').value,status,attachments:pendingAttachments['inc']||[]};
  if(id){const idx=I.findIndex(x=>x.id===id);if(idx>-1)I[idx]=obj;logActivity('update_incident','Updated incident: '+type);}else{I.push(obj);logActivity('create_incident','Logged incident: '+type);}
  save();buildIncidents();togglePanel('incPanel');clearIncForm();toast('Incident saved.');buildDashboard();
}
function clearIncForm(): void{(['incId','iEndDate','iEndTime','iType','iSystem','iDesc','iCause','iAction'] as const).forEach(x=>byId(x).value='');splitDT(nowLocalDT(),'iStartDate','iStartTime');byId('iCat').value='';byId('iSev').value='Low';byId('iStatus').value='Pending';byId('iTypeHint').textContent='';resetAttachments('inc');renderAttachList('inc','incAttachList');}
function editIncident(id: number): void{const i=I.find(x=>x.id===id);if(!i)return;byId('incId').value=String(i.id);splitDT(i.start||(i.date?i.date+'T00:00':''),'iStartDate','iStartTime');splitDT(i.end||'','iEndDate','iEndTime');byId('iCat').value=i.category||'';byId('iType').value=i.type||'';updateIncType();byId('iSev').value=i.severity;byId('iSystem').value=i.system||'';byId('iDesc').value=i.description||'';byId('iCause').value=i.cause||'';byId('iAction').value=i.action||'';byId('iStatus').value=i.status||'Pending';loadAttachments('inc',i.attachments);renderAttachList('inc','incAttachList');const p=byId('incPanel');if(!p.classList.contains('open'))p.classList.add('open');}
function deleteInc(id: number): void{if(!requirePerm(['admin','superadmin']))return;const i=I.find(x=>x.id===id);if(!confirm('Delete?'))return;I=I.filter(x=>x.id!==id);logActivity('delete_incident','Deleted incident: '+(i?i.type:id));save();buildIncidents();buildDashboard();toast('Deleted.');}
function filterInc(f: string, btn: HTMLElement): void{incFilter=f;document.querySelectorAll('#pane-incidents .filter-row .fbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');buildIncidents();}
function toggleIncidentStatus(id: number): void{
  if(!requirePerm(['admin','superadmin']))return;
  const i=I.find(x=>x.id===id);if(!i)return;
  if(i.status==='Resolved'){i.status='Pending';i.end=null;}
  else{i.status='Resolved';if(!i.end)i.end=nowLocalDT();}
  logActivity('update_incident',(i.status==='Resolved'?'Resolved':'Reopened')+' incident: '+i.type);
  save();buildIncidents();toast(i.status==='Resolved'?'Marked as resolved.':'Reopened.');
}
const svCol: Lookup<string>={Critical:'br',High:'br',Medium:'ba',Low:'bn'};
const catCol: Lookup<string>={'Health & Safety':'#d03b3b',Power:'#eda100',Equipment:'#2a78d6',Water:'#0ea5e9'};
function buildIncidents(): void{
  const ct: Record<string, number>={Critical:0,High:0,Medium:0,Low:0};I.forEach(i=>{if(ct[i.severity]!==undefined)ct[i.severity]++;});
  const totalHrs=I.reduce((a,i)=>a+incidentManHours(i),0);
  byId('incKpis').innerHTML=`<div class="kpi"><div class="kl">Total</div><div class="kv">${I.length}</div></div><div class="kpi"><div class="kl">Critical/High</div><div class="kv">${ct.Critical+ct.High}</div></div><div class="kpi"><div class="kl">Downtime</div><div class="kv">${totalHrs.toFixed(2)}</div><div class="ks">man-hrs · 7am–5pm, Mon–Sat</div></div><div class="kpi"><div class="kl">Open/Pending</div><div class="kv">${I.filter(x=>x.status!=='Resolved').length}</div></div>`;
  let filtered=incFilter==='Pending'?I.filter(i=>i.status!=='Resolved'):incFilter==='All'?[...I]:I.filter(i=>i.category===incFilter);
  const list=sortOpenClosed(filtered,i=>i.status==='Resolved',i=>i.date);
  byId('incidentList').innerHTML=list.length===0?'<div class="empty">No incidents matching filter.</div>':list.map(i=>{const mh=incidentManHours(i);return`
    <div class="irow"><div class="ibody">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <span class="badge" style="background:${catCol[i.category]||'#888'}22;color:${catCol[i.category]||'#888'}">${i.category}</span>
        <span class="badge ${svCol[i.severity]||'bn'}">${i.severity}</span>
        <span class="pill">${i.status}</span>
        <span style="font-size:11px;color:var(--tm)">${mh.toFixed(2)} man-hrs${i.status!=='Resolved'?' (ongoing)':''}</span>
      </div>
      <div style="font-size:13px;font-weight:500;margin-bottom:2px">${i.type}</div>
      ${i.start?`<div style="font-size:11px;color:var(--tm)">Start: ${fmtDT(i.start)} · ${i.end?'Resolved: '+fmtDT(i.end):'Not yet resolved'}</div>`:''}
      ${i.description?`<div style="font-size:12px;color:var(--ts)">${i.description}</div>`:''}
      ${i.cause?`<div style="font-size:11px;color:var(--tm);margin-top:2px">Cause: ${i.cause}</div>`:''}
      ${i.action?`<div style="font-size:11px;color:var(--gt);margin-top:2px">Action: ${i.action}</div>`:''}
      ${renderAttachmentsView(i.attachments)}
    </div>
    <div style="display:flex;flex-direction:column;gap:5px">
      <button class="bts btn role-gate-admin" onclick="toggleIncidentStatus(${i.id})">${i.status==='Resolved'?'Reopen':'Mark resolved'}</button>
      <button class="bts btn role-gate-admin" onclick="editIncident(${i.id})">Edit</button>
      <button class="btd btn role-gate-admin" onclick="deleteInc(${i.id})">Del</button>
    </div></div>`;}).join('');
}

