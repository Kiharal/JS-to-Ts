/* ===== TABS ===== */
const TABS=['dashboard','updates','entry','energy','water','events','incidents','downtime','maintenance','compliance','users','settings'] as const;
let currentTab: TabName='dashboard';
function renderTab(t: TabName): void{
  if(t==='updates')buildGUTab();
  if(t==='energy')buildEnergyTab();
  if(t==='water')buildWaterTab();
  if(t==='events')buildEventsTab();
  if(t==='incidents')buildIncidents();
  if(t==='downtime')buildDowntimeTab();
  if(t==='maintenance')buildMaintTab();
  if(t==='compliance')buildCompTab();
  if(t==='users'&&hasRole('superadmin'))buildUsersTab();
  if(t==='settings'){buildPrintMonths();toggleReportPeriod();}
}
function sw(t: TabName): void{
  if(t==='users'&&!hasRole('superadmin')){toast('Users & activity log are visible to Super Admins only.');return;}
  if(t==='settings'&&!hasRole('admin','superadmin')){toast('Sync & storage settings are visible to Admins only.');return;}
  currentTab=t;
  document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',TABS[i]===t));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  byId('pane-'+t).classList.add('active');
  renderTab(t);
}

