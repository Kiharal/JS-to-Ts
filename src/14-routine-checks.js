/* ===== ROUTINE CHECKS ===== */
function renderRCAssetOptions(){
  const sel=document.getElementById('rcAsset');
  const cur=sel.value;
  sel.innerHTML='<option value="">— select —</option>'+MA.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')+'<option value="__new__">+ Add new equipment…</option>';
  if(cur)sel.value=cur;
}
function rcAssetChanged(sel){
  if(sel.value!=='__new__')return;
  const name=(prompt('Name of the new machine / equipment:')||'').trim();
  if(!name){sel.value='';return;}
  const newAsset={id:nextId(MA),name,type:'Other',customType:'',make:'',serial:'',frequency:'',lastMaint:'',nextDue:'',notes:''};
  MA.push(newAsset);
  logActivity('create_asset','Added equipment via routine check: '+name);
  save();
  renderRCAssetOptions();
  sel.value=newAsset.id;
  toast('Added "'+name+'" — it will now appear in this list everywhere.');
}
function rcRag(x){const dd=daysUntil(x.nextCheck);if(dd===null)return'dn';if(dd<0)return'dr';if(dd<=7)return'da';return'dg';}
function resetRCForm(){['rcId','rcDate','rcItems','rcComments','rcChecker','rcNextCheck'].forEach(x=>document.getElementById(x).value='');renderRCAssetOptions();document.getElementById('rcAsset').value='';document.getElementById('rcPanelTitle').textContent='Log routine check';resetAttachments('rc');renderAttachList('rc','rcAttachList');}
function saveRoutineCheck(){
  const id=parseInt(document.getElementById('rcId').value)||0;
  if(id){if(!requirePerm(['admin','superadmin']))return;}else if(!requireCreatePerm())return;
  const assetId=parseInt(document.getElementById('rcAsset').value)||0;
  const items=document.getElementById('rcItems').value.trim();
  const checker=document.getElementById('rcChecker').value.trim();
  if(!assetId){toast('Select the machine / equipment checked');return;}
  if(!items){toast('List at least one item / area checked');return;}
  const obj={id:id||nextId(RC),date:document.getElementById('rcDate').value||today(),assetId,items,comments:document.getElementById('rcComments').value,checker,nextCheck:document.getElementById('rcNextCheck').value,attachments:pendingAttachments['rc']||[],status:id?(RC.find(x=>x.id===id)||{}).status||'open':'open'};
  const a=MA.find(x=>x.id===assetId);
  if(id){const idx=RC.findIndex(x=>x.id===id);if(idx>-1)RC[idx]=obj;logActivity('update_routine_check','Updated routine check: '+(a?a.name:assetId));}
  else{
    // this check supersedes whatever check was previously open for this asset
    RC.filter(x=>x.assetId===assetId&&(x.status||'open')==='open').forEach(x=>{x.status='closed';});
    RC.push(obj);logActivity('create_routine_check','Logged routine check: '+(a?a.name:assetId));
  }
  save();buildRoutineChecksTab();togglePanel('rcPanel');resetRCForm();toast('Routine check saved.');
}
function editRoutineCheck(id){const x=RC.find(r=>r.id===id);if(!x)return;renderRCAssetOptions();document.getElementById('rcId').value=x.id;document.getElementById('rcDate').value=x.date||'';document.getElementById('rcAsset').value=x.assetId;document.getElementById('rcItems').value=x.items||'';document.getElementById('rcComments').value=x.comments||'';document.getElementById('rcChecker').value=x.checker||'';document.getElementById('rcNextCheck').value=x.nextCheck||'';loadAttachments('rc',x.attachments);renderAttachList('rc','rcAttachList');document.getElementById('rcPanelTitle').textContent='Edit routine check';const p=document.getElementById('rcPanel');if(!p.classList.contains('open'))p.classList.add('open');}
function deleteRoutineCheck(id){if(!requirePerm(['admin','superadmin']))return;const x=RC.find(r=>r.id===id);if(!confirm('Delete this routine check?'))return;RC=RC.filter(r=>r.id!==id);const a=x?MA.find(m=>m.id===x.assetId):null;logActivity('delete_routine_check','Deleted routine check: '+(a?a.name:''));save();buildRoutineChecksTab();toast('Deleted.');}
function toggleRCStatus(id){
  if(!requirePerm(['admin','superadmin']))return;
  const x=RC.find(r=>r.id===id);if(!x)return;
  const reopening=(x.status||'open')==='closed';
  if(reopening)RC.filter(o=>o.assetId===x.assetId&&o.id!==x.id&&(o.status||'open')==='open').forEach(o=>{o.status='closed';});
  x.status=reopening?'open':'closed';
  const a=MA.find(m=>m.id===x.assetId);logActivity('update_routine_check',(x.status==='closed'?'Closed':'Reopened')+' routine check: '+(a?a.name:''));save();buildRoutineChecksTab();toast(x.status==='closed'?'Marked as closed.':'Reopened as current.');
}
function logRCFor(assetId){togglePanel('rcPanel');resetRCForm();document.getElementById('rcAsset').value=assetId;}
function buildRoutineChecksTab(){
  renderRCAssetOptions();
  const overdue=RC.filter(x=>x.nextCheck&&daysUntil(x.nextCheck)<0).length;
  const dueSoon=RC.filter(x=>{const d=daysUntil(x.nextCheck);return d!=null&&d>=0&&d<=7;}).length;
  document.getElementById('rcKpis').innerHTML=`<div class="kpi"><div class="kl">Checks logged</div><div class="kv">${RC.length}</div></div><div class="kpi"><div class="kl">Overdue</div><div class="kv">${overdue}</div><span class="badge ${overdue===0?'bg':'br'}">${overdue===0?'All current':'Action needed'}</span></div><div class="kpi"><div class="kl">Due ≤7 days</div><div class="kv">${dueSoon}</div></div>`;

  const assetIds=[...new Set(RC.map(x=>x.assetId))];
  const assets=assetIds.map(id=>MA.find(a=>a.id===id)||{id,name:'Unknown asset'});
  assets.sort((a,b)=>{
    const oa=RC.find(x=>x.assetId===a.id&&(x.status||'open')==='open');
    const ob=RC.find(x=>x.assetId===b.id&&(x.status||'open')==='open');
    return(daysUntil(oa?oa.nextCheck:null)??999)-(daysUntil(ob?ob.nextCheck:null)??999);
  });

  document.getElementById('routineCheckList').innerHTML=assets.length===0?'<div class="empty">No routine checks logged yet.</div>':assets.map(a=>{
    const checks=sortOpenClosed(RC.filter(x=>x.assetId===a.id),x=>x.status==='closed',x=>x.date);
    const openCheck=checks.find(x=>(x.status||'open')==='open');
    const rag=openCheck?rcRag(openCheck):'dn';
    const dd=openCheck?daysUntil(openCheck.nextCheck):null;
    const dueStr=!openCheck?'No open check':dd===null?'No next check set':dd<0?`Overdue by ${Math.abs(dd)} days`:dd===0?'Due today':`Due in ${dd} days`;
    const rows=checks.map(x=>{
      const items=(x.items||'').split('\n').map(i=>i.trim()).filter(Boolean);
      const isOpen=(x.status||'open')==='open';
      return`<div class="irow" style="padding:6px 0">
        <div class="ibody">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <span class="badge ${isOpen?'ba':'bn'}">${isOpen?'Current':'Closed'}</span>
            ${x.date?`<span style="font-size:11px;color:var(--ts)">${fmt(x.date)}</span>`:''}
            ${x.checker?`<span style="font-size:11px;color:var(--tm)">· Checked by ${x.checker}</span>`:''}
          </div>
          ${items.length?`<ul style="margin:2px 0 4px 16px;padding:0;font-size:12px;color:var(--ts)">${items.map(i=>`<li style="margin-bottom:1px">${i}</li>`).join('')}</ul>`:''}
          ${x.comments?`<div style="font-size:11px;color:var(--tm);font-style:italic">${x.comments}</div>`:''}
          ${x.nextCheck?`<div style="font-size:11px;color:var(--tm)">Next check: ${fmt(x.nextCheck)}</div>`:''}
          ${renderAttachmentsView(x.attachments)}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <button class="bts btn role-gate-admin" style="padding:1px 6px;font-size:10px" onclick="toggleRCStatus(${x.id})">${isOpen?'Close':'Reopen'}</button>
          <button class="bts btn role-gate-admin" style="padding:1px 6px;font-size:10px" onclick="editRoutineCheck(${x.id})">Edit</button>
          <button class="btd btn role-gate-admin" style="padding:1px 6px;font-size:10px" onclick="deleteRoutineCheck(${x.id})">Del</button>
        </div>
      </div>`;
    }).join('');
    return`<div class="asset-card"><span class="asset-rag ${rag}"></span><div class="asset-body"><div class="asset-name">${a.name}</div><div class="asset-meta" style="margin-bottom:4px">${openCheck?statusBadge(false):'<span class="badge bn">No open check</span>'} <span class="${rag==='dr'?'exp-bad':rag==='da'?'exp-warn':rag==='dg'?'exp-ok':''}">${dueStr}</span></div>${checks.length?`<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:.03em;border-top:.5px solid var(--bd);padding-top:6px">Routine check history (${checks.length})</div>${rows}</div>`:''}</div><div class="asset-actions"><button class="btp btn" onclick="logRCFor(${a.id})"><i class="ti ti-clipboard-check"></i> Log</button></div></div>`;
  }).join('');
}

