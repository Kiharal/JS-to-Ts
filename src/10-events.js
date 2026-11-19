/* ===== EVENTS ===== */
function saveEvent(){const id=parseInt(document.getElementById('evId').value)||0;if(id){if(!requirePerm(['admin','superadmin']))return;}else if(!requireCreatePerm())return;const cat=document.getElementById('evCat').value;const title=document.getElementById('evTitle').value.trim();if(!cat||!title){toast('Category and title required');return;}const obj={id:id||nextId(EV),date:document.getElementById('evDate').value||today(),category:cat,title,description:document.getElementById('evDesc').value,attendees:document.getElementById('evAttendees').value,notes:document.getElementById('evNotes').value,attachments:pendingAttachments['ev']||[],status:id?(EV.find(e=>e.id===id)||{}).status||'open':'open'};if(id){const idx=EV.findIndex(e=>e.id===id);if(idx>-1)EV[idx]=obj;logActivity('update_event','Updated event: '+title);}else{EV.push(obj);logActivity('create_event','Created event: '+title);}save();buildEventsTab();togglePanel('evPanel');clearEvForm();toast('Event saved.');}
function clearEvForm(){['evId','evDate','evTitle','evDesc','evAttendees','evNotes'].forEach(x=>document.getElementById(x).value='');document.getElementById('evCat').value='';resetAttachments('ev');renderAttachList('ev','evAttachList');}
function editEvent(id){const e=EV.find(x=>x.id===id);if(!e)return;document.getElementById('evId').value=e.id;document.getElementById('evDate').value=e.date;document.getElementById('evCat').value=e.category;document.getElementById('evTitle').value=e.title;document.getElementById('evDesc').value=e.description||'';document.getElementById('evAttendees').value=e.attendees||'';document.getElementById('evNotes').value=e.notes||'';loadAttachments('ev',e.attachments);renderAttachList('ev','evAttachList');const p=document.getElementById('evPanel');if(!p.classList.contains('open'))p.classList.add('open');}
function deleteEvent(id){if(!requirePerm(['admin','superadmin']))return;const e=EV.find(x=>x.id===id);if(!confirm('Delete?'))return;EV=EV.filter(x=>x.id!==id);logActivity('delete_event','Deleted event: '+(e?e.title:id));save();buildEventsTab();toast('Deleted.');}
function filterEv(f,btn){evFilter=f;document.querySelectorAll('#evFilters .fbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');buildEventsTab();}
function toggleEventStatus(id){if(!requirePerm(['admin','superadmin']))return;const e=EV.find(x=>x.id===id);if(!e)return;e.status=(e.status||'open')==='open'?'closed':'open';logActivity('update_event',(e.status==='closed'?'Closed':'Reopened')+' event: '+e.title);save();buildEventsTab();toast(e.status==='closed'?'Marked as closed.':'Reopened.');}
const evColors={'Facility Visit':'#2a78d6','Meeting':'#1baf7a','Training':'#eda100','Celebration':'#d03b3b'};
function buildEventsTab(){
  const filtered=(evFilter==='All'?[...EV]:EV.filter(e=>e.category===evFilter));
  const list=sortOpenClosed(filtered,e=>e.status==='closed',e=>e.date);
  document.getElementById('evList').innerHTML=list.length===0?'<div class="empty">No events logged.</div>':list.map(e=>`
    <div class="irow"><div class="ibody">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap">
        <span class="badge" style="background:${evColors[e.category]||'#888'}22;color:${evColors[e.category]||'#888'}">${e.category}</span>
        ${statusBadge(e.status==='closed')}
        <span style="font-size:11px;color:var(--tm)">${fmt(e.date)}${e.attendees?` · <i class="ti ti-users"></i> ${e.attendees}`:''}</span>
      </div>
      <div style="font-size:13px;font-weight:500;margin-bottom:2px">${e.title}</div>
      ${e.description?`<div style="font-size:12px;color:var(--ts)">${e.description}</div>`:''}
      ${e.notes?`<ul style="margin:4px 0 0 16px;padding:0;font-size:11px;color:var(--tm)">${e.notes.split('\n').map(n=>n.trim()).filter(Boolean).map(n=>`<li style="margin-bottom:1px">${n}</li>`).join('')}</ul>`:''}
      ${renderAttachmentsView(e.attachments)}
    </div>
    <div style="display:flex;flex-direction:column;gap:5px">
      <button class="bts btn role-gate-admin" onclick="toggleEventStatus(${e.id})">${e.status==='closed'?'Reopen':'Mark closed'}</button>
      <button class="bts btn role-gate-admin" onclick="editEvent(${e.id})">Edit</button>
      <button class="btd btn role-gate-admin" onclick="deleteEvent(${e.id})">Del</button>
    </div></div>`).join('');
}

