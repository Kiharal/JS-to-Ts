/* ===== TABS ===== */
/* ===== GENERAL FACILITY UPDATES ===== */
let guFilter='All';
function filterGU(f,btn){guFilter=f;document.querySelectorAll('#guFilters .fbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');buildGUTab();}
function resetGUForm(){['guId','guHeader','guNote'].forEach(x=>document.getElementById(x).value='');document.getElementById('guDate').value=today();document.getElementById('guPanelTitle').textContent='New facility update';document.getElementById('guNoteGroup').style.display='';document.getElementById('guAttachGroup').style.display='';resetAttachments('gu');renderAttachList('gu','guAttachList');}
function saveGU(){
  const id=parseInt(document.getElementById('guId').value)||0;
  if(id){if(!requirePerm(['admin','superadmin']))return;}else if(!requireCreatePerm())return;
  const header=document.getElementById('guHeader').value.trim();
  if(!header){toast('Enter a header / title');return;}
  const date=document.getElementById('guDate').value||today();
  const note=document.getElementById('guNote').value.trim();
  if(id){
    const idx=GU.findIndex(x=>x.id===id);
    if(idx>-1){GU[idx].header=header;GU[idx].date=date;logActivity('update_facility_update','Updated update header: '+header);}
  }else{
    const attachments=pendingAttachments['gu']||[];
    const obj={id:nextId(GU),header,date,status:'open',createdBy:currentUser?currentUser.username:'system',reviews:(note||attachments.length)?[{id:1,date,author:currentUser?currentUser.username:'system',text:note,attachments}]:[]};
    GU.push(obj);
    logActivity('create_facility_update','Created facility update: '+header);
  }
  save();buildGUTab();togglePanel('guPanel');resetGUForm();toast('Saved.');
}
function editGUHeader(id){const g=GU.find(x=>x.id===id);if(!g)return;document.getElementById('guId').value=g.id;document.getElementById('guHeader').value=g.header;document.getElementById('guDate').value=g.date;document.getElementById('guNote').value='';document.getElementById('guNoteGroup').style.display='none';document.getElementById('guAttachGroup').style.display='none';document.getElementById('guPanelTitle').textContent='Edit update header';const p=document.getElementById('guPanel');if(!p.classList.contains('open'))p.classList.add('open');}
function deleteGU(id){if(!requirePerm(['admin','superadmin']))return;const g=GU.find(x=>x.id===id);if(!confirm('Delete this entire update thread, including all its reviews?'))return;GU=GU.filter(x=>x.id!==id);logActivity('delete_facility_update','Deleted facility update: '+(g?g.header:id));save();buildGUTab();toast('Deleted.');}
function toggleGUStatus(id){
  if(!requirePerm(['admin','superadmin']))return;
  const g=GU.find(x=>x.id===id);if(!g)return;
  g.status=(g.status||'open')==='open'?'closed':'open';
  logActivity('update_facility_update',(g.status==='closed'?'Closed':'Reopened')+' facility update: '+g.header);
  save();buildGUTab();toast(g.status==='closed'?'Marked as closed.':'Reopened.');
}
function addGUReview(threadId){
  if(!requireCreatePerm())return;
  const ta=document.getElementById('guReviewInput_'+threadId);
  const text=ta.value.trim();
  const attachments=pendingAttachments['gu_'+threadId]||[];
  if(!text&&!attachments.length){toast('Enter the review text or attach a file');return;}
  const g=GU.find(x=>x.id===threadId);if(!g)return;
  g.reviews=g.reviews||[];
  g.reviews.push({id:nextId(g.reviews),date:today(),author:currentUser?currentUser.username:'system',text,attachments});
  logActivity('update_facility_update','Added a review to: '+g.header);
  resetAttachments('gu_'+threadId);
  save();buildGUTab();toast('Review added.');
}
function deleteGUReview(threadId,reviewId){
  if(!requirePerm(['admin','superadmin']))return;
  const g=GU.find(x=>x.id===threadId);if(!g)return;
  if(!confirm('Delete this review?'))return;
  g.reviews=(g.reviews||[]).filter(r=>r.id!==reviewId);
  logActivity('update_facility_update','Deleted a review from: '+g.header);
  save();buildGUTab();toast('Deleted.');
}
function buildGUTab(){
  const openCount=GU.filter(g=>(g.status||'open')==='open').length;
  const closedCount=GU.filter(g=>g.status==='closed').length;
  document.getElementById('guKpis').innerHTML=`<div class="kpi"><div class="kl">Total updates</div><div class="kv">${GU.length}</div></div><div class="kpi"><div class="kl">Open tasks</div><div class="kv">${openCount}</div><span class="badge ba">${openCount===0?'None':'In progress'}</span></div><div class="kpi"><div class="kl">Closed tasks</div><div class="kv">${closedCount}</div><span class="badge bg">${closedCount===0?'None yet':'Resolved'}</span></div>`;
  const filtered=GU.filter(g=>guFilter==='All'?true:guFilter==='Open'?(g.status||'open')==='open':g.status==='closed');
  const list=sortOpenClosed(filtered,g=>g.status==='closed',g=>g.date);
  document.getElementById('guList').innerHTML=list.length===0?'<div class="empty">No facility updates yet. Click "New update" to start one.</div>':list.map(g=>{
    const status=g.status||'open';
    const reviews=(g.reviews||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.id-b.id));
    resetAttachments('gu_'+g.id);
    return`<div class="card" style="margin-bottom:.875rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div>
          <p class="ct" style="margin-bottom:2px">${g.header} <span class="badge ${status==='open'?'ba':'bg'}">${status==='open'?'Open':'Closed'}</span></p>
          <div style="font-size:11px;color:var(--tm)">Opened ${fmt(g.date)}${g.createdBy?' · by '+g.createdBy:''}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="bts btn role-gate-admin" onclick="toggleGUStatus(${g.id})">${status==='open'?'Mark as closed':'Reopen'}</button>
          <button class="bts btn role-gate-admin" onclick="editGUHeader(${g.id})">Edit header</button>
          <button class="btd btn role-gate-admin" onclick="deleteGU(${g.id})">Delete</button>
        </div>
      </div>
      <div style="margin-top:.75rem;display:flex;flex-direction:column;gap:8px">
        ${reviews.length===0?'<div class="empty" style="padding:.5rem 0">No reviews yet.</div>':reviews.map((r,i)=>`
          <div style="border-left:2px solid var(--bds);padding:2px 0 2px 10px">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="badge bn">Review ${i+1}</span>
              <span style="font-size:11px;color:var(--tm)">${fmt(r.date)}${r.author?' · '+r.author:''}</span>
              <button class="btd btn role-gate-admin" style="padding:1px 6px;font-size:10px;margin-left:auto" onclick="deleteGUReview(${g.id},${r.id})">Remove</button>
            </div>
            <div style="font-size:13px;margin-top:2px;white-space:pre-wrap">${r.text||''}</div>
            ${renderAttachmentsView(r.attachments)}
          </div>`).join('')}
      </div>
      <div style="margin-top:.75rem;display:flex;flex-direction:column;gap:8px">
        <div><label class="fl">Add review ${reviews.length+1}</label><textarea id="guReviewInput_${g.id}" placeholder="What changed, decisions made, next steps"></textarea></div>
        <div>
          <label class="fl">Attachments <span style="color:var(--tm)">(images, documents — keep files under 4MB each)</span></label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <label class="btn btg" style="cursor:pointer"><i class="ti ti-file-upload"></i> Add file<input type="file" multiple style="display:none" onchange="addAttachmentFiles('gu_${g.id}',this,'guRevAttachList_${g.id}')"></label>
            <label class="btn btg" style="cursor:pointer"><i class="ti ti-camera"></i> Take a photo<input type="file" accept="image/*" capture="environment" style="display:none" onchange="addAttachmentFiles('gu_${g.id}',this,'guRevAttachList_${g.id}')"></label>
          </div>
          <div id="guRevAttachList_${g.id}" style="margin-top:6px"></div>
        </div>
        <button class="btn btp" onclick="addGUReview(${g.id})" style="align-self:flex-start"><i class="ti ti-plus"></i> Add</button>
      </div>
    </div>`;
  }).join('');
}

