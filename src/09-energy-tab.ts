/* ===== ENERGY TAB ===== */
function buildEnergyTab(): void{
  const months=[...new Set(Object.keys(E).map(d=>d.slice(0,7)))].sort();
  const ml=months.map(m=>{const[y,mo]=m.split('-').map(Number);return new Date(y,mo-1).toLocaleString('en-GB',{month:'short',year:'2-digit'});});
  const ud: number[]=[],sd: number[]=[],cd: number[]=[];
  months.forEach(m=>{const en=getMonthEntries(m);const{u,s}=calcCons([...en]);ud.push(u);sd.push(s);cd.push(Math.round(u*CPK));});
  const ldMonthly=months.map(m=>loadMonthSummary('load',m).total);
  const d=curMonthData();
  byId('energyKpis').innerHTML=`
    <div class="kpi"><div class="kl">Utility (kWh)</div><div class="kv">${d.u.toLocaleString()}</div><div class="ks">This month</div></div>
    <div class="kpi"><div class="kl">Solar (kWh)</div><div class="kv">${d.s}</div><div class="ks">This month</div></div>
    <div class="kpi"><div class="kl">Cost (KES)</div><div class="kv">${d.cost.toLocaleString()}</div></div>
    <div class="kpi"><div class="kl">Solar share</div><div class="kv">${d.sp}%</div></div>`;
  dc('monthlyChart');dc('dailyEnergyChart');dc('costChart');dc('srcChart');
  charts.monthlyChart=new Chart(byId('monthlyChart'),{type:'bar',data:{labels:ml,datasets:[{type:'bar',label:'Utility',data:ud,backgroundColor:'#d03b3b',borderRadius:3,borderSkipped:false,stack:'src'},{type:'bar',label:'Solar',data:sd,backgroundColor:'#eda100',borderRadius:3,borderSkipped:false,stack:'src'},{type:'bar',label:'Load',data:ldMonthly,backgroundColor:'#2a78d6',borderRadius:3,borderSkipped:false,stack:'load'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${(ctx.parsed.y||0).toLocaleString()} kWh`}}},scales:{x:{stacked:true,ticks:{color:MU},grid:{display:false}},y:{stacked:true,ticks:{color:MU},grid:{color:GR},beginAtZero:true}}}});

  // Daily energy — utility vs solar vs load, last 30 days
  const eMap=Object.fromEntries(getEnergyDailyData().filter(x=>!x.baseline).map(x=>[x.date,x]));
  const lMapDaily=Object.fromEntries(getLoadDailyData('load').map(x=>[x.date,x]));
  const deDates=[...new Set([...Object.keys(eMap),...Object.keys(lMapDaily)])].sort().slice(-30);
  const deLabels=deDates.map(dt=>fmt(dt).slice(0,6));
  const deUtil=deDates.map(dt=>eMap[dt]?eMap[dt].utility:0);
  const deSolar=deDates.map(dt=>eMap[dt]?eMap[dt].solar:0);
  const deLoad=deDates.map(dt=>lMapDaily[dt]?lMapDaily[dt].val:null);
  charts.dailyEnergyChart=new Chart(byId('dailyEnergyChart'),{type:'bar',data:{labels:deLabels,datasets:[{type:'bar',label:'Utility',data:deUtil,backgroundColor:'#d03b3b',borderRadius:3,borderSkipped:false,stack:'src'},{type:'bar',label:'Solar',data:deSolar,backgroundColor:'#eda100',borderRadius:3,borderSkipped:false,stack:'src'},{type:'bar',label:'Load',data:deLoad,backgroundColor:'#2a78d6',borderRadius:3,borderSkipped:false,stack:'load'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y==null?'—':ctx.parsed.y.toLocaleString()} kWh`}}},scales:{x:{stacked:true,ticks:{color:MU,maxTicksLimit:10},grid:{display:false}},y:{stacked:true,ticks:{color:MU},grid:{color:GR},beginAtZero:true}}}});
  charts.costChart=new Chart(byId('costChart'),{type:'line',data:{labels:ml,datasets:[{data:cd,borderColor:'#1baf7a',backgroundColor:'rgba(27,175,122,0.08)',borderWidth:2,pointRadius:3,tension:.3,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:MU},grid:{display:false}},y:{ticks:{color:MU,callback:v=>'KES '+v.toLocaleString()},grid:{color:GR},beginAtZero:true}}}});
  const kwhVals=[d.u||0,d.s||0];
  byId('srcLegend').innerHTML=`<span><span class="legsq" style="background:#2a78d6"></span>Utility ${d.u.toLocaleString()} kWh</span><span><span class="legsq" style="background:#eda100"></span>Solar ${d.s} kWh</span>`;
  charts.srcChart=new Chart(byId('srcChart'),{type:'pie',data:{labels:['Utility','Solar'],datasets:[{data:kwhVals,backgroundColor:['#2a78d6','#eda100'],borderWidth:2,borderColor:dark?'#1a1a19':'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.parsed.toLocaleString()} kWh`}}}}});

  // Load meter (kWh) mini-dashboard
  const nm=today().slice(0,7);const lm=lastMonthStr(nm);
  const loadDailyAll=getLoadDailyData('load').filter(x=>!x.baseline);
  const yesterdayStr=addDaysISO(today(),-1);
  const yestLoad=loadDailyAll.filter(x=>x.date===yesterdayStr)[0];
  const lkwMonth=loadMonthSummary('load',nm);
  const lkwLastMonth=loadMonthSummary('load',lm);
  const avgLoad=lkwMonth.count?lkwMonth.total/lkwMonth.count:0;
  const lastLoadEntryDate=Object.keys(E).filter(d=>E[d].load!=null).sort().pop();
  const lastLoadReading=lastLoadEntryDate?E[lastLoadEntryDate].load:null;
  byId('loadKpis').innerHTML=`
    <div class="kpi"><div class="kl">Yesterday</div><div class="kv">${yestLoad?yestLoad.val.toLocaleString():'—'}</div><div class="ks">kWh</div></div>
    <div class="kpi"><div class="kl">Monthly total</div><div class="kv">${lkwMonth.total>0?lkwMonth.total.toLocaleString():'—'}</div><div class="ks">${lkwMonth.count>0?lkwMonth.count+' days logged':'No data'}</div></div>
    <div class="kpi"><div class="kl">Last month</div><div class="kv">${lkwLastMonth.total>0?lkwLastMonth.total.toLocaleString():'—'}</div><div class="ks">${fmtM(lm)}</div></div>
    <div class="kpi"><div class="kl">Daily average</div><div class="kv">${avgLoad>0?avgLoad.toFixed(1):'—'}</div><div class="ks">kWh per logged day</div></div>
    <div class="kpi"><div class="kl">Latest reading</div><div class="kv" style="font-size:16px">${lastLoadReading?lastLoadReading.toLocaleString():'—'}</div><div class="ks">${lastLoadEntryDate?fmt(lastLoadEntryDate):''}</div></div>`;

  const last30Load=loadDailyAll.slice(-30);
  dc('loadDailyChart');
  charts.loadDailyChart=new Chart(byId('loadDailyChart'),{type:'bar',data:{labels:last30Load.map(x=>fmt(x.date).slice(0,6)),datasets:[{label:'Load (kWh)',data:last30Load.map(x=>x.val),backgroundColor:'#7c3aed',borderRadius:3,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:MU,maxTicksLimit:10},grid:{display:false}},y:{ticks:{color:MU},grid:{color:GR},beginAtZero:true}}}});

  const loadMonthTotals=months.map(m=>loadMonthSummary('load',m).total);
  dc('loadMonthlyChart');
  charts.loadMonthlyChart=new Chart(byId('loadMonthlyChart'),{type:'bar',data:{labels:ml,datasets:[{label:'Load (kWh)',data:loadMonthTotals,backgroundColor:'#7c3aed',borderRadius:4,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:MU},grid:{display:false}},y:{ticks:{color:MU},grid:{color:GR},beginAtZero:true}}}});

  // Energy log — all readings (mirrors the water log table)
  const sortedE=Object.entries(E).sort(([a],[b])=>b.localeCompare(a));
  const utilMap=Object.fromEntries(getEnergyDailyData().map(x=>[x.date,x]));
  byId('energyLogTable').innerHTML=sortedE.length===0?'<div class="empty">No entries yet.</div>':`
    <table class="tbl"><tr><th>Date</th><th>Utility (kWh)</th><th>Utility consumption</th><th>Load (kWh)</th><th>Load (kVAh)</th><th>Solar (kWh)</th></tr>
    ${sortedE.map(([d,v])=>{
      const u=utilMap[d];
      return`<tr>
        <td>${fmt(d)}</td>
        <td style="font-family:monospace;font-size:11px">${v.utility?v.utility.toLocaleString():'—'}</td>
        <td style="color:var(--ec)">${u?(u.baseline?'Baseline':u.utility.toLocaleString()):'—'}</td>
        <td>${v.load!=null?v.load.toLocaleString():'—'}</td>
        <td>${v.loadKVA!=null?v.loadKVA.toLocaleString():'—'}</td>
        <td>${(Number(v.solar1)||0)+(Number(v.solar2)||0)}</td>
      </tr>`;
    }).join('')}
    </table>`;
}

