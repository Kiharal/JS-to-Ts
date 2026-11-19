/* ===== PRINT ===== */
function getGUReportRows(start,end){
  const inRange=dt=>dt&&dt>=start&&dt<=end;
  const rows=[];
  GU.forEach(g=>{
    const revsInRange=(g.reviews||[]).filter(r=>inRange(r.date));
    if(revsInRange.length){
      revsInRange.forEach(r=>rows.push({date:r.date,header:g.header,status:g.status||'open',note:r.text||'(No note)',files:(r.attachments||[]).length}));
    }else if(inRange(g.date)){
      rows.push({date:g.date,header:g.header,status:g.status||'open',note:'Update opened',files:0});
    }
  });
  rows.sort((a,b)=>b.date.localeCompare(a.date)||a.header.localeCompare(b.header));
  return rows;
}
function buildReportData(range){
  const{start,end}=range;
  const inRange=dt=>dt&&dt>=start&&dt<=end;
  const en=Object.entries(E).filter(([dt])=>inRange(dt)).sort(([a],[b])=>a.localeCompare(b));
  const{u,s}=calcCons([...en]);const tot=u+s;const cost=u*CPK;const sp=tot>0?(s/tot*100).toFixed(1):0;
  const ws=waterRangeSummary(start,end);const{daily}=getWaterData();const mwd=daily.filter(x=>inRange(x.date));
  const mi=I.filter(i=>inRange(i.date));const td=mi.reduce((a,i)=>a+incidentManHours(i),0);
  const mdt=DT.filter(x=>inRange(x.date));const tdt=mdt.reduce((a,x)=>a+downtimeMinutes(x),0);
  const mev=EV.filter(e=>inRange(e.date));
  const mml=ML.filter(l=>inRange(l.date));
  const mrc=RC.filter(r=>inRange(r.date));
  const mgu=getGUReportRows(start,end);
  const le=en[en.length-1]?.[1]||{};
  return{range,en,u,s,tot,cost,sp,ws,mwd,mi,td,mdt,tdt,mev,mml,mrc,mgu,le};
}
function getReportRange(){
  const type=document.getElementById('reportPeriodType').value;
  if(type==='week'){
    const v=document.getElementById('printWeekDate').value;
    if(!v)return null;
    const dt=new Date(v+'T00:00:00');
    const day=dt.getDay();
    const diffToMon=(day===0?-6:1-day);
    const mon=new Date(dt);mon.setDate(dt.getDate()+diffToMon);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    const iso=toLocalISO;
    const start=iso(mon),end=iso(sun);
    return{type:'week',start,end,label:'Week of '+fmt(start)+' – '+fmt(end),fileTag:start,titleWord:'Weekly'};
  }else{
    const m=document.getElementById('printMonth').value;
    if(!m)return null;
    const[y,mo]=m.split('-').map(Number);
    const start=`${m}-01`;
    const lastDay=new Date(y,mo,0).getDate();
    const end=`${m}-${String(lastDay).padStart(2,'0')}`;
    return{type:'month',start,end,label:fmtM(m),fileTag:m,titleWord:'Monthly'};
  }
}
function toggleReportPeriod(){
  const type=document.getElementById('reportPeriodType').value;
  document.getElementById('periodMonthWrap').style.display=type==='month'?'':'none';
  document.getElementById('periodWeekWrap').style.display=type==='week'?'':'none';
  if(type==='week'&&!document.getElementById('printWeekDate').value)document.getElementById('printWeekDate').value=today();
}
function buildPrintMonths(){
  const months=new Set(Object.keys(E).map(d=>d.slice(0,7)));
  I.forEach(x=>{if(x.date)months.add(x.date.slice(0,7));});
  EV.forEach(x=>{if(x.date)months.add(x.date.slice(0,7));});
  DT.forEach(x=>{if(x.date)months.add(x.date.slice(0,7));});
  ML.forEach(x=>{if(x.date)months.add(x.date.slice(0,7));});
  RC.forEach(x=>{if(x.date)months.add(x.date.slice(0,7));});
  GU.forEach(g=>{if(g.date)months.add(g.date.slice(0,7));(g.reviews||[]).forEach(r=>{if(r.date)months.add(r.date.slice(0,7));});});
  const sorted=[...months].sort().reverse();
  const sel=document.getElementById('printMonth');
  const prev=sel.value;
  sel.innerHTML=sorted.length?sorted.map(m=>`<option value="${m}">${fmtM(m)}</option>`).join(''):'<option value="">No data yet</option>';
  if(prev&&sorted.includes(prev))sel.value=prev;
}
function generatePrint(){
  const range=getReportRange();if(!range){toast(document.getElementById('reportPeriodType').value==='week'?'Pick a date within the week':'Select a month');return;}
  const d=buildReportData(range);
  const{en,u,s,tot,cost,sp,ws,mwd,mi,td,mdt,tdt,mev,le,mml,mrc,mgu}=d;
  document.getElementById('pr-letterhead').src=LETTERHEAD_IMG;
  document.getElementById('pr-title').textContent='TEC Facility — '+range.titleWord+' Report';
  document.getElementById('pr-period').textContent='Period: '+range.label;
  document.getElementById('pr-by').textContent='Prepared by: KO — Research & Development';
  document.getElementById('pr-gen').textContent='Generated: '+fmt(today());
  document.getElementById('pr-kpis').innerHTML=`<div class="kpi"><div class="kl">Total energy</div><div class="kv">${tot.toLocaleString()} kWh</div></div><div class="kpi"><div class="kl">Utility</div><div class="kv">${u.toLocaleString()} kWh</div></div><div class="kpi"><div class="kl">Solar</div><div class="kv">${s} kWh</div></div><div class="kpi"><div class="kl">Energy cost</div><div class="kv">KES ${cost.toLocaleString()}</div></div><div class="kpi"><div class="kl">Water total</div><div class="kv">${ws.totalM3.toFixed(2)} m³</div></div><div class="kpi"><div class="kl">Water avg/day</div><div class="kv">${ws.avgM3.toFixed(3)} m³</div></div>`;
  document.getElementById('pr-rag').innerHTML=`<div class="rag-row"><span class="dot ${le.power==='up'?'dg':le.power?'da':'dn'}"></span>Power<span class="rst">${le.power||'—'}</span></div><div class="rag-row"><span class="dot ${le.internet==='up'?'dg':le.internet?'da':'dn'}"></span>Internet<span class="rst">${le.internet||'—'}</span></div><div class="rag-row"><span class="dot ${le.server==='up'?'dg':le.server?'da':'dn'}"></span>Server<span class="rst">${le.server||'—'}</span></div><div class="rag-row"><span class="dot ${le.solar==='operational'?'dg':le.solar?'da':'dn'}"></span>Solar<span class="rst">${le.solar||'—'}</span></div>`;
  document.getElementById('pr-gu').innerHTML=mgu.length===0?'<tr><td>No general updates this period</td></tr>':`<tr><th>Date</th><th>Update</th><th>Status</th><th>Note</th><th>Files</th></tr>${mgu.map(g=>`<tr><td>${fmt(g.date)}</td><td>${g.header}</td><td>${g.status==='closed'?'Closed':'Open'}</td><td>${g.note}</td><td>${g.files||'—'}</td></tr>`).join('')}`;
  document.getElementById('pr-energy').innerHTML=`<tr><th>Metric</th><th>Value</th></tr><tr><td>Total energy</td><td>${tot.toLocaleString()} kWh</td></tr><tr><td>Utility</td><td>${u.toLocaleString()} kWh (${(100-parseFloat(sp)).toFixed(1)}%)</td></tr><tr><td>Solar</td><td>${s} kWh (${sp}%)</td></tr><tr><td>Cost</td><td>KES ${cost.toLocaleString()}</td></tr>`;
  document.getElementById('pr-water').innerHTML=`<tr><th>Metric</th><th>Value</th></tr><tr><td>Total consumption</td><td>${ws.totalM3.toFixed(3)} m³</td></tr><tr><td>Average daily consumption</td><td>${ws.avgM3.toFixed(4)} m³ / day</td></tr><tr><td>Peak day</td><td>${ws.peak?fmt(ws.peak.date)+' — '+ws.peak.consM3.toFixed(3)+' m³':'—'}</td></tr><tr><td>Days logged</td><td>${ws.count}</td></tr>${mwd.slice(-5).reverse().map(d=>`<tr><td>${fmt(d.date)}</td><td>${d.consM3!=null?d.consM3.toFixed(3)+' m³':'Baseline'}</td></tr>`).join('')}`;
  document.getElementById('pr-inc').innerHTML=mi.length===0?'<tr><td>No incidents</td></tr>':`<tr><th>Date</th><th>Category</th><th>Incident</th><th>Severity</th><th>Downtime (man-hrs)</th><th>Status</th></tr>${mi.map(i=>`<tr><td>${fmt(i.date)}</td><td>${i.category}</td><td>${i.type}</td><td>${i.severity}</td><td>${incidentManHours(i).toFixed(2)}</td><td>${i.status}</td></tr>`).join('')}<tr><td colspan="4"><strong>Total downtime</strong></td><td colspan="2"><strong>${td.toFixed(2)} man-hrs</strong></td></tr>`;
  document.getElementById('pr-dt').innerHTML=mdt.length===0?'<tr><td>No downtime events</td></tr>':`<tr><th>Date</th><th>Category</th><th>Area</th><th>Start</th><th>End</th><th>Duration</th><th>Status</th></tr>${mdt.map(x=>`<tr><td>${fmt(x.date)}</td><td>${x.category}</td><td>${x.area||'—'}</td><td>${fmtDT(x.start)}</td><td>${x.end?fmtDT(x.end):'—'}</td><td>${fmtDuration(downtimeMinutes(x))}</td><td>${x.status}</td></tr>`).join('')}<tr><td colspan="5"><strong>Total downtime</strong></td><td colspan="2"><strong>${fmtDuration(tdt)}</strong></td></tr>`;
  document.getElementById('pr-ev').innerHTML=mev.length===0?'<tr><td>No events</td></tr>':`<tr><th>Date</th><th>Category</th><th>Title</th><th>Attendees</th></tr>${mev.map(e=>`<tr><td>${fmt(e.date)}</td><td>${e.category}</td><td>${e.title}</td><td>${e.attendees||'—'}</td></tr>`).join('')}`;
  document.getElementById('pr-comp').innerHTML=CO.length===0?'<tr><td>No items</td></tr>':`<tr><th>Item</th><th>Category</th><th>Equipment</th><th>Expiry</th><th>Status</th><th>Files</th></tr>${CO.sort((a,b)=>(daysUntil(a.expiry)??999)-(daysUntil(b.expiry)??999)).map(c=>{const dd=daysUntil(c.expiry);return`<tr><td>${c.name}</td><td>${c.category}</td><td>${c.equipment||'—'}</td><td>${fmt(c.expiry)}</td><td>${dd===null?'No expiry':dd<0?'EXPIRED':dd===0?'Today':`${dd} days`}</td><td>${(c.attachments||[]).length||'—'}</td></tr>`;}).join('')}`;
  document.getElementById('pr-maint').innerHTML=mml.length===0?'<tr><td>No maintenance logged this period</td></tr>':`<tr><th>Date</th><th>Asset</th><th>Work done</th><th>Technician</th><th>Cost (KES)</th><th>Files</th></tr>${mml.map(l=>{const a=MA.find(x=>x.id===l.assetId);return`<tr><td>${fmt(l.date)}</td><td>${a?a.name:'—'}</td><td>${l.work}</td><td>${l.technician||'—'}</td><td>${(l.cost||0).toLocaleString()}</td><td>${(l.attachments||[]).length||'—'}</td></tr>`;}).join('')}`;
  document.getElementById('pr-rc').innerHTML=mrc.length===0?'<tr><td>No routine checks this period</td></tr>':`<tr><th>Date</th><th>Asset</th><th>Items checked</th><th>Checked by</th><th>Files</th></tr>${mrc.map(r=>{const a=MA.find(x=>x.id===r.assetId);return`<tr><td>${fmt(r.date)}</td><td>${a?a.name:'—'}</td><td>${(r.items||'').split('\n').filter(Boolean).join('; ')}</td><td>${r.checker||'—'}</td><td>${(r.attachments||[]).length||'—'}</td></tr>`;}).join('')}`;
  document.getElementById('pr-daily').innerHTML=`<tr><th>Date</th><th>Utility (kWh)</th><th>Solar (kWh)</th><th>Meter (m³)</th><th>Water (m³)</th><th>Power</th><th>Internet</th></tr>${en.map(([d,v])=>{const wd=mwd.find(x=>x.date===d);return`<tr><td>${fmt(d)}</td><td>${v.utility||'—'}</td><td>${(Number(v.solar1)||0)+(Number(v.solar2)||0)}</td><td>${v.water?(v.water/1000).toFixed(3):'—'}</td><td>${wd&&wd.consM3!=null?wd.consM3.toFixed(3):'Baseline'}</td><td>${v.power||'—'}</td><td>${v.internet||'—'}</td></tr>`;}).join('')}`;
  document.getElementById('printMsg').textContent='Report ready — opening print dialog…';
  logActivity('print_report','Opened print/PDF dialog for '+range.label);
  setTimeout(()=>window.print(),300);
}

