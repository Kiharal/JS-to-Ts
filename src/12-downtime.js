/* ===== DOWNTIME ===== */
function updateDowntimeFields(){
  const cat=document.getElementById('dtCat').value;
  const isDelay=cat==='Bus Delays'||cat==='Canteen Delays';
  document.getElementById('dtReasonGroup').style.display=isDelay?'':'none';
  document.getElementById('dtDescLabel').textContent=isDelay?'Additional notes':'Description';
  document.getElementById('dtDesc').placeholder=isDelay?'Any extra detail (optional)':'What happened, and the impact';
}
function clearDowntimeForm(){['dtId','dtEndDate','dtEndTime','dtArea','dtDesc','dtReason'].forEach(x=>document.getElementById(x).value='');splitDT(nowLocalDT(),'dtStartDate','dtStartTime');document.getElementById('dtCat').value='';document.getElementById('dtPanelTitle').textContent='Log / edit downtime';updateDowntimeFields();resetAttachments('dt');renderAttachList('dt','dtAttachList');}
function saveDowntime(){
  const id=parseInt(document.getElementById('dtId').value)||0;
  if(id){if(!requirePerm(['admin','superadmin']))return;}else if(!requireCreatePerm())return;
  const cat=document.getElementById('dtCat').value;
  if(!cat){toast('Select a category');return;}
  const start=combineDT('dtStartDate','dtStartTime');
  if(!start){toast('Enter the start date');return;}
  const end=combineDT('dtEndDate','dtEndTime');
  if(end&&end<start){toast('End time cannot be before the start time');return;}
  const obj={id:id||nextId(DT),date:start.slice(0,10),start,end,category:cat,area:document.getElementById('dtArea').value,reason:document.getElementById('dtReason').value,description:document.getElementById('dtDesc').value,status:end?'Resolved':'Ongoing',attachments:pendingAttachments['dt']||[]};
  if(id){const idx=DT.findIndex(x=>x.id===id);if(idx>-1)DT[idx]=obj;logActivity('update_downtime','Updated downtime: '+cat);}
  else{DT.push(obj);logActivity('create_downtime','Logged downtime: '+cat);}
  save();buildDowntimeTab();togglePanel('dtPanel');clearDowntimeForm();toast('Downtime logged.');
}
function editDowntime(id){
  const x=DT.find(d=>d.id===id);if(!x)return;
  document.getElementById('dtId').value=x.id;
  splitDT(x.start||(x.date?x.date+'T00:00':''),'dtStartDate','dtStartTime');
  splitDT(x.end||'','dtEndDate','dtEndTime');
  document.getElementById('dtCat').value=x.category||'';
  document.getElementById('dtArea').value=x.area||'';
  document.getElementById('dtReason').value=x.reason||'';
  document.getElementById('dtDesc').value=x.description||'';
  document.getElementById('dtPanelTitle').textContent='Edit downtime';
  updateDowntimeFields();
  loadAttachments('dt',x.attachments);renderAttachList('dt','dtAttachList');
  const p=document.getElementById('dtPanel');if(!p.classList.contains('open'))p.classList.add('open');
}
function deleteDowntime(id){if(!requirePerm(['admin','superadmin']))return;const x0=DT.find(x=>x.id===id);if(!confirm('Delete?'))return;DT=DT.filter(x=>x.id!==id);logActivity('delete_downtime','Deleted downtime: '+(x0?x0.category:id));save();buildDowntimeTab();toast('Deleted.');}
function filterDT(f,btn){dtFilter=f;document.querySelectorAll('#dtFilters .fbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');buildDowntimeTab();}
function toggleDowntimeStatus(id){
  if(!requirePerm(['admin','superadmin']))return;
  const x=DT.find(d=>d.id===id);if(!x)return;
  if(x.status==='Resolved'){x.status='Ongoing';x.end=null;}
  else{x.end=x.end||nowLocalDT();x.status='Resolved';}
  logActivity('update_downtime',(x.status==='Resolved'?'Ended':'Reopened')+' downtime: '+x.category);
  save();buildDowntimeTab();toast(x.status==='Resolved'?'Marked as ended.':'Reopened.');
}
function buildDowntimeTab(){
  const totalMin=DT.reduce((a,x)=>a+downtimeMinutes(x),0);
  const ongoing=DT.filter(x=>x.status!=='Resolved').length;
  const catCounts={};DT.forEach(x=>{catCounts[x.category]=(catCounts[x.category]||0)+downtimeMinutes(x);});
  const topCat=Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('downtimeKpis').innerHTML=`
    <div class="kpi"><div class="kl">Total events</div><div class="kv">${DT.length}</div></div>
    <div class="kpi"><div class="kl">Total downtime</div><div class="kv" style="font-size:19px">${fmtDuration(totalMin)}</div></div>
    <div class="kpi"><div class="kl">Ongoing</div><div class="kv">${ongoing}</div><span class="badge ${ongoing===0?'bg':'br'}">${ongoing===0?'None open':'Needs attention'}</span></div>
    <div class="kpi"><div class="kl">Top category</div><div class="kv" style="font-size:15px">${topCat?topCat[0]:'—'}</div><div class="ks">${topCat?fmtDuration(topCat[1]):''}</div></div>`;

  const cats=['Machine Breakdown','Power Outage','Health & Safety Incident','Bus Delays','Canteen Delays','Water Outage','Other'];
  const catData=cats.map(c=>catCounts[c]||0);
  dc('dtByCatChart');
  charts.dtByCatChart=new Chart(document.getElementById('dtByCatChart'),{type:'bar',data:{labels:cats.map(c=>c.replace(' Incident','')),datasets:[{label:'Minutes',data:catData,backgroundColor:cats.map(c=>dtCol[c]),borderRadius:4,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmtDuration(ctx.parsed.y)}}},scales:{x:{ticks:{color:MU,font:{size:10}},grid:{display:false}},y:{ticks:{color:MU},grid:{color:GR},beginAtZero:true}}}});

  const catsVisible=dtFilter==='Ongoing'?cats.filter(c=>DT.some(x=>x.category===c&&x.status!=='Resolved')):dtFilter==='All'?cats:cats.filter(c=>c===dtFilter);
  document.getElementById('downtimeList').innerHTML=catsVisible.length===0?'<div class="empty">No downtime events matching filter.</div>':catsVisible.map(cat=>{
    const events=sortOpenClosed(DT.filter(x=>x.category===cat),x=>x.status==='Resolved',x=>x.date);
    const ongoingCount=events.filter(x=>x.status!=='Resolved').length;
    const catMin=catCounts[cat]||0;
    const rag=ongoingCount>0?'dr':events.length?'dg':'dn';
    const rows=events.map(x=>`
      <div class="irow"><div class="ibody">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
          <span class="badge ${x.status==='Resolved'?'bn':'ba'}">${x.status}</span>
          <span style="font-size:11px;color:var(--tm)">${fmtDuration(downtimeMinutes(x))}${x.status!=='Resolved'?' (ongoing)':''}${x.area?' · '+x.area:''}</span>
        </div>
        ${x.start?`<div style="font-size:11px;color:var(--tm)">Start: ${fmtDT(x.start)} · ${x.end?'End: '+fmtDT(x.end):'Not yet resolved'}</div>`:''}
        ${x.reason?`<div style="font-size:12px;color:var(--ts)"><strong>Reason:</strong> ${x.reason}</div>`:''}
        ${x.description?`<div style="font-size:12px;color:var(--ts)">${x.description}</div>`:''}
        ${renderAttachmentsView(x.attachments)}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px">
        <button class="bts btn role-gate-admin" onclick="toggleDowntimeStatus(${x.id})">${x.status==='Resolved'?'Reopen':'Mark ended'}</button>
        <button class="bts btn role-gate-admin" onclick="editDowntime(${x.id})">Edit</button>
        <button class="btd btn role-gate-admin" onclick="deleteDowntime(${x.id})">Del</button>
      </div></div>`).join('');
    return`<div class="asset-card"><span class="asset-rag ${rag}"></span><div class="asset-body"><div class="asset-name">${cat}</div><div class="asset-meta" style="margin-bottom:4px"><span class="badge" style="background:${dtCol[cat]||'#888'}22;color:${dtCol[cat]||'#888'}">${cat}</span> ${ongoingCount>0?`<span class="badge br">Ongoing (${ongoingCount})</span>`:events.length?'<span class="badge bg">All resolved</span>':''}</div><div class="asset-meta">Events: ${events.length} · Total downtime: <strong>${fmtDuration(catMin)}</strong></div>${events.length?`<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:.03em;border-top:.5px solid var(--bd);padding-top:6px">Incident history (${events.length})</div>${rows}</div>`:`<div class="asset-meta" style="margin-top:4px;color:var(--tm)">No incidents logged.</div>`}</div></div>`;
  }).join('');
}

