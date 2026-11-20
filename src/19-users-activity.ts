/* ===== USERS & ACTIVITY LOG ===== */
function resetUserForm(): void{(['uId','uName','uUsername','uPass','uPass2'] as const).forEach(x=>byId(x).value='');byId('uRole').value='user';byId('uActive').value='1';byId('userPanelTitle').textContent='Add user';}
async function saveUser(): Promise<void>{
  if(!requirePerm(['superadmin']))return;
  const id=parseInt(byId('uId').value)||0;
  const name=byId('uName').value.trim();
  const username=byId('uUsername').value.trim();
  const role=oneOf<Role>(['superadmin','admin','user'],byId('uRole').value,'user');
  const active=byId('uActive').value==='1';
  const pass=byId('uPass').value;
  const pass2=byId('uPass2').value;
  if(!name||!username){toast('Name and username required');return;}
  if(!id&&!pass){toast('Password required for a new user');return;}
  if(pass&&pass!==pass2){toast('Passwords do not match');return;}
  if(US.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.id!==id)){toast('Username already exists');return;}
  if(id){
    const idx=US.findIndex(u=>u.id===id);
    if(idx>-1){
      if(US[idx].role==='superadmin'&&(role!=='superadmin'||!active)){
        const others=US.filter(u=>u.role==='superadmin'&&u.id!==id&&u.active!==false).length;
        if(others===0){toast('At least one active Super Admin must remain');return;}
      }
      US[idx].name=name;US[idx].username=username;US[idx].role=role;US[idx].active=active;
      if(pass)US[idx].passwordHash=await sha256hex(pass);
      logActivity('update_user','Updated user '+username);
      if(currentUser&&currentUser.id===id)currentUser=US[idx];
    }
  }else{
    US.push({id:nextId(US),name,username,role,active,passwordHash:await sha256hex(pass),createdAt:today()});
    logActivity('create_user','Created user '+username+' ('+ROLE_LABEL[role]+')');
  }
  save();buildUsersTab();togglePanel('userPanel');toast('User saved.');
}
function editUser(id: number): void{const u=US.find(x=>x.id===id);if(!u)return;byId('uId').value=String(u.id);byId('uName').value=u.name;byId('uUsername').value=u.username;byId('uRole').value=u.role;byId('uActive').value=u.active===false?'0':'1';byId('uPass').value='';byId('uPass2').value='';byId('userPanelTitle').textContent='Edit user';const p=byId('userPanel');if(!p.classList.contains('open'))p.classList.add('open');}
function deleteUser(id: number): void{
  if(!requirePerm(['superadmin']))return;
  const u=US.find(x=>x.id===id);if(!u)return;
  if(currentUser&&u.id===currentUser.id){toast("You can't delete the account you're logged in as.");return;}
  if(u.role==='superadmin'){const others=US.filter(x=>x.role==='superadmin'&&x.id!==id&&x.active!==false).length;if(others===0){toast('At least one active Super Admin must remain');return;}}
  if(!confirm('Delete user '+u.username+'?'))return;
  US=US.filter(x=>x.id!==id);
  logActivity('delete_user','Deleted user '+u.username);
  save();buildUsersTab();toast('User deleted.');
}
function buildUsersTab(): void{
  byId('userKpis').innerHTML=`<div class="kpi"><div class="kl">Total users</div><div class="kv">${US.length}</div></div><div class="kpi"><div class="kl">Active</div><div class="kv">${US.filter(u=>u.active!==false).length}</div></div><div class="kpi"><div class="kl">Super Admins</div><div class="kv">${US.filter(u=>u.role==='superadmin').length}</div></div><div class="kpi"><div class="kl">Admins / Users</div><div class="kv" style="font-size:16px">${US.filter(u=>u.role==='admin').length} / ${US.filter(u=>u.role==='user').length}</div></div>`;
  byId('userList').innerHTML=US.length===0?'<div class="empty">No users.</div>':US.map(u=>`
    <div class="asset-card">
      <div class="asset-body">
        <div class="asset-name">${u.name} <span class="role-pill role-${u.role}">${ROLE_LABEL[u.role]}</span> ${u.active===false?'<span class="badge br">Disabled</span>':''}</div>
        <div class="asset-meta">@${u.username} · Added ${fmt(u.createdAt)}</div>
      </div>
      <div class="asset-actions">
        <button class="bts btn" onclick="editUser(${u.id})">Edit</button>
        <button class="btd btn" onclick="deleteUser(${u.id})">Del</button>
      </div>
    </div>`).join('');
  renderActivityLog();
}
function filterAL(f: string, btn: HTMLElement): void{alFilter=f;document.querySelectorAll('#alFilters .fbtn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');renderActivityLog();}
function renderActivityLog(): void{
  const authA=['login','logout','login_failed'];
  let list=[...AL];
  if(alFilter==='auth')list=list.filter(x=>authA.includes(x.action));
  else if(alFilter==='create')list=list.filter(x=>x.action.startsWith('create'));
  else if(alFilter==='update')list=list.filter(x=>x.action.startsWith('update'));
  else if(alFilter==='delete')list=list.filter(x=>x.action.startsWith('delete'));
  list=list.slice().reverse().slice(0,150);
  byId('activityLog').innerHTML=list.length===0?'<div class="empty">No activity recorded yet.</div>':`<table class="tbl"><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr>${list.map(x=>`<tr><td style="white-space:nowrap;font-size:11px">${new Date(x.ts).toLocaleString('en-GB')}</td><td>${x.user}</td><td>${ROLE_LABEL[x.role]||x.role||'—'}</td><td>${x.action.replace(/_/g,' ')}</td><td style="color:var(--ts)">${x.details||''}</td></tr>`).join('')}</table>`;
}

