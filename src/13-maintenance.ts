/* ===== MAINTENANCE ===== */
function toggleAssetOtherType(): void{const v=byId('aType').value;byId('aTypeOtherWrap').style.display=v==='Other'?'block':'none';}
function resetAssetForm(): void{(['assetId','aName','aMake','aSerial','aNotes','aLast','aNext','aTypeOther'] as const).forEach(x=>byId(x).value='');byId('aType').value='Machine';byId('aFreq').value='Monthly';byId('assetPanelTitle').textContent='Add equipment';toggleAssetOtherType();resetAttachments('asset');renderAttachList('asset','assetAttachList');}
function saveAsset(): void{const id=parseInt(byId('assetId').value)||0;if(id){if(!requirePerm(['admin','superadmin']))return;}else if(!requireCreatePerm())return;const name=byId('aName').value.trim();if(!name){toast('Enter name');return;}const typeVal=byId('aType').value;const customType=typeVal==='Other'?byId('aTypeOther').value.trim():'';const obj: Asset={id:id||nextId(MA),name,type:typeVal,customType,frequency:byId('aFreq').value,lastMaint:byId('aLast').value,nextDue:byId('aNext').value,make:byId('aMake').value,serial:byId('aSerial').value,notes:byId('aNotes').value,attachments:pendingAttachments['asset']||[]};if(id){const idx=MA.findIndex(x=>x.id===id);if(idx>-1)MA[idx]=obj;const openEntry=assetOpenEntry(id);if(openEntry&&obj.nextDue)openEntry.nextDue=obj.nextDue;logActivity('update_asset','Updated asset: '+name);}else{MA.push(obj);logActivity('create_asset','Added asset: '+name);}save();buildMaintTab();buildDashboard();togglePanel('assetPanel');toast('Asset saved.');}
function editAsset(id: number): void{const a=MA.find(x=>x.id===id);if(!a)return;byId('assetId').value=String(a.id);byId('aName').value=a.name;byId('aType').value=a.type;toggleAssetOtherType();byId('aTypeOther').value=a.customType||'';byId('aFreq').value=a.frequency||'Monthly';byId('aLast').value=a.lastMaint||'';byId('aNext').value=a.nextDue||'';byId('aMake').value=a.make||'';byId('aSerial').value=a.serial||'';byId('aNotes').value=a.notes||'';loadAttachments('asset',a.attachments);renderAttachList('asset','assetAttachList');byId('assetPanelTitle').textContent='Edit equipment';const p=byId('assetPanel');if(!p.classList.contains('open'))p.classList.add('open');}
function deleteAsset(id: number): void{if(!requirePerm(['superadmin']))return;const a=MA.find(x=>x.id===id);if(!confirm('Delete asset and all its logs?'))return;MA=MA.filter(x=>x.id!==id);ML=ML.filter(x=>x.assetId!==id);logActivity('delete_asset','Deleted asset: '+(a?a.name:id));save();buildMaintTab();buildDashboard();toast('Deleted.');}
function openLogModal(id: number): void{const a=MA.find(x=>x.id===id);if(!a)return;byId('logAssetId').value=String(id);byId('logAssetName').textContent=a.name;byId('logDate').value=today();byId('logNext').value=assetSchedule(a).nextDue||'';(['logTech','logWork','logCost','logNotes'] as const).forEach(x=>byId(x).value='');resetAttachments('ml');renderAttachList('ml','logAttachList');byId('logModal').classList.add('open');}
function closeLogModal(): void{byId('logModal').classList.remove('open');}
function saveMaintenanceLog(): void{
  if(!requireCreatePerm())return;
  const assetId=parseInt(byId('logAssetId').value);
  const work=byId('logWork').value.trim();
  if(!work){toast('Describe work done');return;}
  const logDate=byId('logDate').value;
  const nextDue=byId('logNext').value;
  const costVal=byId('logCost').value;
  // This visit completes whatever was due — close out any entry still open for this asset, then open
  // a fresh one for what was just done. That new entry stays "open" (current) until it, in turn, is
  // closed by the next logged visit; its next-due date is what the asset register watches for overdue.
  ML.filter(l=>l.assetId===assetId&&(l.status||'open')==='open').forEach(l=>{l.status='closed';});
  ML.push({id:nextId(ML),assetId,date:logDate,work,technician:byId('logTech').value,cost:Number(costVal)||0,notes:byId('logNotes').value,nextDue,attachments:pendingAttachments['ml']||[],status:'open'});
  const a=MA.find(x=>x.id===assetId);
  if(a){a.lastMaint=logDate;a.nextDue=nextDue||a.nextDue;}
  logActivity('create_maintenance_log','Logged maintenance for '+(a?a.name:assetId)+(costVal?' · KES '+costVal:'')+(nextDue?' · next due '+fmt(nextDue):''));
  save();closeLogModal();buildMaintTab();toast('Maintenance logged'+(nextDue?' — next check due '+fmt(nextDue):'')+'.');buildDashboard();
}
function toggleMLStatus(id: number): void{
  if(!requirePerm(['admin','superadmin']))return;
  const l=ML.find(x=>x.id===id);if(!l)return;
  const reopening=(l.status||'open')==='closed';
  if(reopening){
    // keep the "at most one open cycle per asset" rule intact
    ML.filter(x=>x.assetId===l.assetId&&x.id!==l.id&&(x.status||'open')==='open').forEach(x=>{x.status='closed';});
  }
  l.status=reopening?'open':'closed';
  const a=MA.find(x=>x.id===l.assetId);
  if(a){const sch=assetSchedule(a);a.nextDue=sch.nextDue||a.nextDue;a.lastMaint=sch.lastMaint||a.lastMaint;}
  logActivity('update_maintenance_log',(l.status==='closed'?'Closed':'Reopened')+' maintenance log for '+(a?a.name:l.assetId));
  save();buildMaintTab();buildDashboard();toast(l.status==='closed'?'Marked as closed.':'Reopened as current.');
}
byId('logModal').addEventListener('click',e=>{if(e.target===byId('logModal'))closeLogModal();});
function filterAsset(f: string, btn: HTMLElement): void{assetFilter=f;document.querySelectorAll('#assetFilters .fbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');buildMaintTab();}
/* The asset's "current" maintenance cycle is whichever ML entry for it is still open — logging a new
   visit closes that entry (it becomes history) and opens a fresh one carrying the next-due date, so the
   asset register always tracks overdue status off the single latest open entry. Assets with no logged
   history yet fall back to the Next due / Last maintained typed directly on the asset. */
function assetOpenEntry(assetId: number): MaintenanceLog | null{const opens=ML.filter(l=>l.assetId===assetId&&(l.status||'open')==='open');if(!opens.length)return null;return opens.reduce((a,b)=>b.id>a.id?b:a);}
function assetSchedule(a: Asset): AssetSchedule{
  const open=assetOpenEntry(a.id);
  const closed=ML.filter(l=>l.assetId===a.id&&(l.status||'open')==='closed');
  const lastClosed=closed.length?closed.reduce((x,y)=>(y.date||'')>(x.date||'')?y:x):null;
  return{
    nextDue:open?(open.nextDue||''):(a.nextDue||''),
    lastMaint:open?(open.date||(lastClosed?lastClosed.date:'')||a.lastMaint||''):((lastClosed?lastClosed.date:'')||a.lastMaint||''),
    openEntry:open
  };
}
function assetRag(a: Asset): Rag{const dd=daysUntil(assetSchedule(a).nextDue);if(dd===null)return'dn';if(dd<0)return'dr';if(dd<=30)return'da';return'dg';}
function assetCost(id: number): number{return ML.filter(l=>l.assetId===id).reduce((a,l)=>a+(Number(l.cost)||0),0);}
function buildMaintTab(): void{
  const overdue=MA.filter(a=>{const s=assetSchedule(a);return !!s.nextDue&&(daysUntil(s.nextDue)??0)<0;}).length;
  const dueSoon=MA.filter(a=>{const d=daysUntil(assetSchedule(a).nextDue);return d!=null&&d>=0&&d<=30;}).length;
  const totalCost=ML.reduce((a,l)=>a+(Number(l.cost)||0),0);
  const nm=today().slice(0,7);
  const monthCost=ML.filter(l=>l.date&&l.date.startsWith(nm)).reduce((a,l)=>a+(Number(l.cost)||0),0);
  byId('maintKpis').innerHTML=`<div class="kpi"><div class="kl">Total assets</div><div class="kv">${MA.length}</div></div><div class="kpi"><div class="kl">Overdue</div><div class="kv">${overdue}</div><span class="badge ${overdue===0?'bg':'br'}">${overdue===0?'All current':'Action needed'}</span></div><div class="kpi"><div class="kl">Due ≤30 days</div><div class="kv">${dueSoon}</div></div><div class="kpi"><div class="kl">Total cost</div><div class="kv">KES ${totalCost.toLocaleString()}</div></div><div class="kpi"><div class="kl">This month</div><div class="kv">KES ${monthCost.toLocaleString()}</div></div>`;

  const months=[...new Set(ML.filter(l=>l.date).map(l=>l.date.slice(0,7)))].sort();
  const monthLbls=months.map(m=>{const[y,mo]=m.split('-').map(Number);return new Date(y,mo-1).toLocaleString('en-GB',{month:'short',year:'2-digit'});});
  const monthCosts=months.map(m=>ML.filter(l=>l.date&&l.date.startsWith(m)).reduce((a,l)=>a+(Number(l.cost)||0),0));
  dc('maintCostTrendChart');
  if(monthCosts.length>0){
    setChartVisible('maintCostTrendChart');
    charts.maintCostTrendChart=new Chart(byId('maintCostTrendChart'),{type:'line',data:{labels:monthLbls,datasets:[{label:'Cost (KES)',data:monthCosts,borderColor:'#eda100',backgroundColor:'rgba(237,161,0,0.1)',borderWidth:2,pointRadius:3,tension:.3,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'KES '+ctx.parsed.y.toLocaleString()}}},scales:{x:{ticks:{color:MU},grid:{display:false}},y:{ticks:{color:MU,callback:v=>'KES '+v.toLocaleString()},grid:{color:GR},beginAtZero:true}}}});
  }else{setChartEmpty('maintCostTrendChart','No maintenance cost logged yet.');}

  const assetCosts=MA.map(a=>({name:a.name,cost:assetCost(a.id)})).filter(x=>x.cost>0).sort((a,b)=>b.cost-a.cost).slice(0,8);
  dc('maintCostByAssetChart');
  if(assetCosts.length>0){
    setChartVisible('maintCostByAssetChart');
    charts.maintCostByAssetChart=new Chart(byId('maintCostByAssetChart'),{type:'bar',data:{labels:assetCosts.map(x=>x.name),datasets:[{label:'Cost (KES)',data:assetCosts.map(x=>x.cost),backgroundColor:'rgba(42,120,214,0.75)',borderRadius:4,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'KES '+ctx.parsed.x.toLocaleString()}}},scales:{x:{ticks:{color:MU,callback:v=>'KES '+v.toLocaleString()},grid:{color:GR},beginAtZero:true},y:{ticks:{color:MU,font:{size:10}},grid:{display:false}}}}});
  }else{setChartEmpty('maintCostByAssetChart','No maintenance cost logged yet.');}

  let list=assetFilter==='Overdue'?MA.filter(a=>{const s=assetSchedule(a);return !!s.nextDue&&(daysUntil(s.nextDue)??0)<0;}):assetFilter==='All'?[...MA]:MA.filter(a=>a.type===assetFilter);
  list.sort((a,b)=>(daysUntil(assetSchedule(a).nextDue)??999)-(daysUntil(assetSchedule(b).nextDue)??999));
  byId('assetList').innerHTML=list.length===0?'<div class="empty">No assets. Click "Add machine / equipment".</div>':list.map(a=>{
    const sch=assetSchedule(a);const dd=daysUntil(sch.nextDue);const rag=assetRag(a);
    const dueStr=dd===null?'No due date':dd<0?`Overdue by ${Math.abs(dd)} days`:dd===0?'Due today':`Due in ${dd} days`;
    const ac=assetCost(a.id);
    const hist=sortOpenClosed(ML.filter(l=>l.assetId===a.id),l=>l.status==='closed',l=>l.date);
    const histRows=hist.map(l=>{
      const isOpen=(l.status||'open')==='open';
      return`<div class="irow" style="padding:6px 0">
        <div class="ibody">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <span class="badge ${isOpen?'ba':'bn'}">${isOpen?'Current':'Closed'}</span>
            ${l.date?`<span style="font-size:11px;color:var(--ts)">${fmt(l.date)}</span>`:''}
            ${l.technician?`<span style="font-size:11px;color:var(--tm)">· ${l.technician}</span>`:''}
            ${l.cost?`<span style="font-size:11px;color:var(--tm)">· KES ${Number(l.cost).toLocaleString()}</span>`:''}
          </div>
          ${l.work?`<div style="font-size:12px;color:var(--ts)">${l.work}</div>`:''}
          ${l.notes?`<div style="font-size:11px;color:var(--tm);font-style:italic">${l.notes}</div>`:''}
          ${l.nextDue?`<div style="font-size:11px;color:var(--tm)">Next check: ${fmt(l.nextDue)}</div>`:''}
          ${renderAttachmentsView(l.attachments)}
        </div>
        <button class="bts btn role-gate-admin" style="padding:1px 6px;font-size:10px" onclick="toggleMLStatus(${l.id})">${isOpen?'Close':'Reopen'}</button>
      </div>`;
    }).join('');
    return`<div class="asset-card"><span class="asset-rag ${rag}"></span><div class="asset-body"><div class="asset-name">${a.name}</div><div class="asset-meta" style="margin-bottom:4px"><span class="badge bn">${a.customType?a.customType:a.type}</span>${a.make?` <span>${a.make}</span>`:''}${a.serial?` <span style="color:var(--tm)">· ${a.serial}</span>`:''}</div><div class="asset-meta">Freq: ${a.frequency||'—'} · Last: ${fmt(sch.lastMaint)} · <span class="${rag==='dr'?'exp-bad':rag==='da'?'exp-warn':'exp-ok'}">${dueStr}</span></div><div class="asset-meta">Total spent: <strong>KES ${ac.toLocaleString()}</strong></div>${a.notes?`<div class="asset-meta" style="margin-top:2px;font-style:italic">${a.notes}</div>`:''}${renderAttachmentsView(a.attachments)}${hist.length?`<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:.03em;border-top:.5px solid var(--bd);padding-top:6px">Maintenance history (${hist.length})</div>${histRows}</div>`:''}</div><div class="asset-actions"><button class="btp btn" onclick="openLogModal(${a.id})"><i class="ti ti-tool"></i> Log</button><button class="bts btn role-gate-admin" onclick="editAsset(${a.id})">Edit</button><button class="btd btn role-gate-superadmin" onclick="deleteAsset(${a.id})">Del</button></div></div>`;
  }).join('');
  buildRoutineChecksTab();
}

