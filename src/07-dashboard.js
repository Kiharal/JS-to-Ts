/* ===== DASHBOARD ===== */
function buildDashboard(){
  const d=curMonthData();const mo=new Date().toLocaleString('en-GB',{month:'long',year:'numeric'});
  const nm=today().slice(0,7);const lm=lastMonthStr(nm);
  const ws=waterMonthSummary(nm);const lws=waterMonthSummary(lm);
  const es=energyMonthSummary(nm);const les=energyMonthSummary(lm);
  const oi=I.filter(i=>i.status!=='Resolved').length;
  const expSoon=CO.filter(c=>{const dd=daysUntil(c.expiry);return dd!=null&&dd<=60&&dd>=0;}).length;
  const overdue=MA.filter(a=>{const s=assetSchedule(a);return s.nextDue&&daysUntil(s.nextDue)<0;}).length;

  document.getElementById('kpiGridEnergy').innerHTML=`
    <div class="kpi"><div class="kl"><i class="ti ti-bolt"></i> Total energy</div><div class="kv">${d.tot.toLocaleString()}</div><div class="ks">kWh · ${mo}</div><span class="badge bn">Util:${d.u} · Solar:${d.s}</span></div>
    <div class="kpi"><div class="kl"><i class="ti ti-currency-dollar"></i> Energy cost</div><div class="kv">KES ${d.cost.toLocaleString()}</div><div class="ks">@ KES ${CPK}/kWh</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-solar-panel"></i> Solar share</div><div class="kv">${d.sp}%</div><div class="ks">${d.s} kWh</div><span class="badge ${d.sp>10?'bg':'ba'}">${d.sp>10?'On target':'Low yield'}</span></div>
    <div class="kpi"><div class="kl"><i class="ti ti-alert-triangle"></i> Open incidents</div><div class="kv">${oi}</div><span class="badge ${oi===0?'bg':'br'}">${oi===0?'All resolved':'Pending'}</span></div>`;

  const{daily}=getWaterData();
  const edaily=getEnergyDailyData();
  const todayDailyW=daily.filter(x=>x.date===today()&&x.consM3!=null)[0];
  const yesterdayStr=addDaysISO(today(),-1);
  const yestDailyW=daily.filter(x=>x.date===yesterdayStr&&x.consM3!=null)[0];
  const lastReading=daily.length?daily[daily.length-1]:null;
  const todayDailyE=edaily.filter(x=>x.date===today()&&!x.baseline)[0];
  const yestDailyE=edaily.filter(x=>x.date===yesterdayStr&&!x.baseline)[0];
  const lastEntryDate=Object.keys(E).sort().pop();
  const lastUtilReading=lastEntryDate?E[lastEntryDate].utility:null;

  document.getElementById('kpiGridEnergyDetail').innerHTML=`
    <div class="kpi energy-kpi"><div class="kl"><i class="ti ti-bolt"></i> Today's usage</div><div class="kv" style="color:var(--ec)">${todayDailyE?todayDailyE.total.toFixed(1)+' kWh':'—'}</div><div class="ks">${todayDailyE?'consumption today':'No reading today'}</div></div>
    <div class="kpi energy-kpi"><div class="kl"><i class="ti ti-history"></i> Yesterday</div><div class="kv" style="color:var(--ec)">${yestDailyE?yestDailyE.total.toFixed(1)+' kWh':'—'}</div><div class="ks">${yestDailyE?'consumption':'No reading'}</div></div>
    <div class="kpi energy-kpi"><div class="kl"><i class="ti ti-calendar-stats"></i> Monthly total</div><div class="kv" style="color:var(--ec)">${es.total>0?es.total.toLocaleString(undefined,{maximumFractionDigits:1})+' kWh':'—'}</div><div class="ks">${es.count>0?es.count+' days logged':'No data'}</div></div>
    <div class="kpi energy-kpi"><div class="kl"><i class="ti ti-calendar-due"></i> Last month</div><div class="kv" style="color:var(--ec)">${les.total>0?les.total.toLocaleString(undefined,{maximumFractionDigits:1})+' kWh':'—'}</div><div class="ks">${fmtM(lm)}</div></div>
    <div class="kpi energy-kpi"><div class="kl"><i class="ti ti-chart-line"></i> Daily average</div><div class="kv" style="color:var(--ec)">${es.avg>0?es.avg.toFixed(1)+' kWh':'—'}</div><div class="ks">Per logged day</div></div>
    <div class="kpi energy-kpi"><div class="kl"><i class="ti ti-gauge"></i> Last meter read</div><div class="kv" style="color:var(--ec);font-size:16px">${lastUtilReading?lastUtilReading.toLocaleString()+' kWh':'—'}</div><div class="ks">${lastEntryDate?fmt(lastEntryDate):''}</div></div>`;

  document.getElementById('kpiGridWater').innerHTML=`
    <div class="kpi water-kpi"><div class="kl"><i class="ti ti-droplet"></i> Today's usage</div><div class="kv" style="color:var(--wc)">${todayDailyW?fmtM3(todayDailyW.consM3):'—'}</div><div class="ks">${todayDailyW?'consumption today':'No reading today'}</div></div>
    <div class="kpi water-kpi"><div class="kl"><i class="ti ti-history"></i> Yesterday</div><div class="kv" style="color:var(--wc)">${yestDailyW?fmtM3(yestDailyW.consM3):'—'}</div><div class="ks">${yestDailyW?'consumption':'No reading'}</div></div>
    <div class="kpi water-kpi"><div class="kl"><i class="ti ti-calendar-stats"></i> Monthly total</div><div class="kv" style="color:var(--wc)">${ws.totalM3>0?ws.totalM3.toFixed(2)+' m³':'—'}</div><div class="ks">${ws.count>0?ws.count+' days logged':'No data'}</div></div>
    <div class="kpi water-kpi"><div class="kl"><i class="ti ti-calendar-due"></i> Last month</div><div class="kv" style="color:var(--wc)">${lws.totalM3>0?lws.totalM3.toFixed(2)+' m³':'—'}</div><div class="ks">${fmtM(lm)}</div></div>
    <div class="kpi water-kpi"><div class="kl"><i class="ti ti-wave-sine"></i> Daily average</div><div class="kv" style="color:var(--wc)">${ws.avgM3>0?ws.avgM3.toFixed(2)+' m³':'—'}</div><div class="ks">Per logged day</div></div>
    <div class="kpi water-kpi"><div class="kl"><i class="ti ti-meter"></i> Last meter read</div><div class="kv" style="color:var(--wc);font-size:16px">${lastReading?fmtM3(lastReading.readingL/1000,3):'—'}</div><div class="ks">${lastReading?fmt(lastReading.date):''}</div></div>`;

  const loadKWHdaily=getLoadDailyData('load').filter(x=>!x.baseline);
  const loadKVAdaily=getLoadDailyData('loadKVA').filter(x=>!x.baseline);
  const yestLoadKWH=loadKWHdaily.filter(x=>x.date===yesterdayStr)[0];
  const yestLoadKVA=loadKVAdaily.filter(x=>x.date===yesterdayStr)[0];
  const lkw=loadMonthSummary('load',nm);
  const lkva=loadMonthSummary('loadKVA',nm);
  const lkwLast=loadMonthSummary('load',lm);
  const lkvaLast=loadMonthSummary('loadKVA',lm);
  const avgLoadKWH=lkw.count?lkw.total/lkw.count:0;
  const avgLoadKVA=lkva.count?lkva.total/lkva.count:0;
  const lastLoadDate=Object.keys(E).filter(d=>E[d].load!=null).sort().pop();
  const lastLoadKVADate=Object.keys(E).filter(d=>E[d].loadKVA!=null).sort().pop();
  document.getElementById('kpiGridLoad').innerHTML=`
    <div class="kpi"><div class="kl"><i class="ti ti-bolt"></i> Yesterday (kWh)</div><div class="kv">${yestLoadKWH?yestLoadKWH.val.toLocaleString():'—'}</div><div class="ks">${yestLoadKWH?'consumption':'No reading'}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-bolt"></i> Yesterday (kVAh)</div><div class="kv">${yestLoadKVA?yestLoadKVA.val.toLocaleString():'—'}</div><div class="ks">${yestLoadKVA?'consumption':'No reading'}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-calendar-stats"></i> Monthly total (kWh)</div><div class="kv">${lkw.total>0?lkw.total.toLocaleString():'—'}</div><div class="ks">${lkw.count>0?lkw.count+' days logged':'No data'}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-calendar-stats"></i> Monthly total (kVAh)</div><div class="kv">${lkva.total>0?lkva.total.toLocaleString():'—'}</div><div class="ks">${lkva.count>0?lkva.count+' days logged':'No data'}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-calendar-due"></i> Last month (kWh)</div><div class="kv">${lkwLast.total>0?lkwLast.total.toLocaleString():'—'}</div><div class="ks">${fmtM(lm)}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-calendar-due"></i> Last month (kVAh)</div><div class="kv">${lkvaLast.total>0?lkvaLast.total.toLocaleString():'—'}</div><div class="ks">${fmtM(lm)}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-chart-line"></i> Daily average (kWh)</div><div class="kv">${avgLoadKWH>0?avgLoadKWH.toFixed(1):'—'}</div><div class="ks">Per logged day</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-chart-line"></i> Daily average (kVAh)</div><div class="kv">${avgLoadKVA>0?avgLoadKVA.toFixed(1):'—'}</div><div class="ks">Per logged day</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-gauge"></i> Latest reading (kWh)</div><div class="kv" style="font-size:16px">${lastLoadDate?E[lastLoadDate].load.toLocaleString():'—'}</div><div class="ks">${lastLoadDate?fmt(lastLoadDate):''}</div></div>
    <div class="kpi"><div class="kl"><i class="ti ti-gauge"></i> Latest reading (kVAh)</div><div class="kv" style="font-size:16px">${lastLoadKVADate?E[lastLoadKVADate].loadKVA.toLocaleString():'—'}</div><div class="ks">${lastLoadKVADate?fmt(lastLoadKVADate):''}</div></div>`;

  const le=E[Object.keys(E).sort().pop()]||{};
  document.getElementById('ragGrid').innerHTML=`
    <div class="rag-row"><span class="dot ${le.power==='up'?'dg':le.power==='partial'?'da':'dr'}"></span>Power supply<span class="rst">${le.power||'No data'}</span></div>
    <div class="rag-row"><span class="dot ${le.internet==='up'?'dg':le.internet?'da':'dn'}"></span>Internet<span class="rst">${le.internet||'No data'}</span></div>
    <div class="rag-row"><span class="dot ${le.server==='up'?'dg':le.server?'da':'dn'}"></span>Server room<span class="rst">${le.server||'No data'}</span></div>
    <div class="rag-row"><span class="dot ${le.solar==='operational'?'dg':le.solar?'da':'dn'}"></span>Solar system<span class="rst">${le.solar||'No data'}</span></div>
    <div class="rag-row"><span class="dot ${expSoon===0?'dg':expSoon>0?'da':'dr'}"></span>Compliance<span class="rst">${expSoon===0?'All valid':expSoon+' expiring soon'}</span></div>
    <div class="rag-row"><span class="dot ${overdue===0?'dg':'dr'}"></span>Maintenance<span class="rst">${overdue===0?'Up to date':overdue+' overdue'}</span></div>
    <div class="rag-row"><span class="dot ${DT.filter(x=>x.status!=='Resolved').length===0?'dg':'dr'}"></span>Downtime<span class="rst">${DT.filter(x=>x.status!=='Resolved').length} ongoing</span></div>`;

  document.getElementById('mixLegend').innerHTML=`<span><span class="legsq" style="background:#2a78d6"></span>Utility ${d.u.toLocaleString()} kWh</span><span><span class="legsq" style="background:#eda100"></span>Solar ${d.s} kWh</span>`;
  dc('mixChart');
  charts.mixChart=new Chart(document.getElementById('mixChart'),{type:'doughnut',data:{labels:['Utility','Solar'],datasets:[{data:[d.u||0,d.s||0],backgroundColor:['#2a78d6','#eda100'],borderWidth:2,borderColor:dark?'#1a1a19':'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.parsed.toLocaleString()} kWh`}}}}});

  // Dashboard energy mini chart — last 14 days daily consumption (utility + solar)
  const last14e=edaily.filter(x=>!x.baseline).slice(-14);
  dc('dashEnergyChart');
  if(last14e.length>0){
    const avg14e=last14e.reduce((a,x)=>a+x.total,0)/last14e.length;
    charts.dashEnergyChart=new Chart(document.getElementById('dashEnergyChart'),{
      type:'bar',
      data:{labels:last14e.map(x=>fmt(x.date).slice(0,6)),datasets:[
        {label:'Utility',data:last14e.map(x=>parseFloat(x.utility.toFixed(2))),backgroundColor:'#2a78d6',stack:'e',borderRadius:3,borderSkipped:false},
        {label:'Solar',data:last14e.map(x=>parseFloat(x.solar.toFixed(2))),backgroundColor:'#eda100',stack:'e',borderRadius:3,borderSkipped:false},
        {label:'Average',data:Array(last14e.length).fill(parseFloat(avg14e.toFixed(2))),type:'line',borderColor:'#1baf7a',borderWidth:1.5,pointRadius:0,borderDash:[4,3]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} kWh`}}},scales:{x:{stacked:true,ticks:{color:MU,maxTicksLimit:7},grid:{display:false}},y:{stacked:true,ticks:{color:MU,callback:v=>v+' kWh'},grid:{color:GR},beginAtZero:true}}}
    });
  }

  // Dashboard load mini chart — last 14 days daily consumption (kWh)
  const last14Load=loadKWHdaily.slice(-14);
  dc('dashLoadChart');
  if(last14Load.length>0){
    const avg14Load=last14Load.reduce((a,x)=>a+x.val,0)/last14Load.length;
    charts.dashLoadChart=new Chart(document.getElementById('dashLoadChart'),{
      type:'bar',
      data:{labels:last14Load.map(x=>fmt(x.date).slice(0,6)),datasets:[
        {label:'Daily kWh',data:last14Load.map(x=>parseFloat(x.val.toFixed(2))),backgroundColor:last14Load.map(x=>x.val>avg14Load*1.3?'rgba(239,68,68,0.7)':'rgba(124,58,237,0.7)'),borderRadius:3,borderSkipped:false},
        {label:'Average',data:Array(last14Load.length).fill(parseFloat(avg14Load.toFixed(2))),type:'line',borderColor:'#eda100',borderWidth:1.5,pointRadius:0,borderDash:[4,3]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} kWh`}}},scales:{x:{ticks:{color:MU,maxTicksLimit:7},grid:{display:false}},y:{ticks:{color:MU,callback:v=>v+' kWh'},grid:{color:GR},beginAtZero:true}}}
    });
  }

  // Dashboard water mini chart — last 14 days daily consumption
  const last14=daily.filter(x=>x.consM3!=null).slice(-14);
  dc('dashWaterChart');
  if(last14.length>0){
    const avg14=last14.reduce((a,x)=>a+x.consM3,0)/last14.length;
    charts.dashWaterChart=new Chart(document.getElementById('dashWaterChart'),{
      type:'bar',
      data:{labels:last14.map(x=>fmt(x.date).slice(0,6)),datasets:[
        {label:'Daily m³',data:last14.map(x=>parseFloat(x.consM3.toFixed(3))),backgroundColor:last14.map(x=>x.consM3>avg14*1.3?'rgba(239,68,68,0.7)':'rgba(14,165,233,0.7)'),borderRadius:3,borderSkipped:false},
        {label:'Average',data:Array(last14.length).fill(parseFloat(avg14.toFixed(3))),type:'line',borderColor:'#eda100',borderWidth:1.5,pointRadius:0,borderDash:[4,3]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} m³`}}},scales:{x:{ticks:{color:MU,maxTicksLimit:7},grid:{display:false}},y:{ticks:{color:MU,callback:v=>v+' m³'},grid:{color:GR},beginAtZero:true}}}
    });
  }
}

