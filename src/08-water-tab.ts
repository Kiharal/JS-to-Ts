/* ===== WATER TAB ===== */
function buildWaterTab(): void{
  const{readings,daily}=getWaterData();
  const nm=today().slice(0,7);
  const ws=waterMonthSummary(nm);
  const allDaily=daily.filter(x=>x.consM3!=null);

  // KPI strip
  const lastR=readings.length?readings[readings.length-1]:null;
  const peak=allDaily.length?allDaily.reduce((a,x)=>x.consM3>a.consM3?x:a,allDaily[0]):null;
  const avgAll=allDaily.length?allDaily.reduce((a,x)=>a+x.consM3,0)/allDaily.length:0;
  byId('waterStrip').innerHTML=`
    <div class="w-strip-item"><div class="w-strip-val">${ws.totalM3>0?ws.totalM3.toFixed(2):'—'}</div><div class="w-strip-lbl">Monthly total (m³)</div></div>
    <div class="w-strip-item"><div class="w-strip-val">${ws.avgM3>0?ws.avgM3.toFixed(3):'—'}</div><div class="w-strip-lbl">Daily avg this month (m³)</div></div>
    <div class="w-strip-item"><div class="w-strip-val">${avgAll>0?avgAll.toFixed(3):'—'}</div><div class="w-strip-lbl">Overall daily avg (m³)</div></div>
    <div class="w-strip-item"><div class="w-strip-val">${peak?peak.consM3.toFixed(3):'—'}</div><div class="w-strip-lbl">Peak day (m³)${peak?'<br><span style="font-size:10px">'+fmt(peak.date)+'</span>':''}</div></div>
    <div class="w-strip-item"><div class="w-strip-val">${readings.length}</div><div class="w-strip-lbl">Total readings logged</div></div>`;

  // Meter display
  byId('waterMeterDisplay').innerHTML=lastR?`
    <div class="w-meter-display">${(lastR[1].water/1000).toFixed(3)}<span>m³ (cumulative) — as at ${fmt(lastR[0])}</span></div>
    <div style="font-size:12px;color:var(--ts)">Meter reading entered: <strong>${lastR[1].water.toLocaleString()} L</strong></div>`
    :'<div style="font-size:12px;color:var(--tm)">No meter readings logged yet. Enter readings in the Daily Entry tab.</div>';

  // Daily consumption chart — last 30 days
  const last30=allDaily.slice(-30);
  const avgLast30=last30.length?last30.reduce((a,x)=>a+x.consM3,0)/last30.length:0;
  dc('waterDailyChart');
  if(last30.length>0){
    setChartVisible('waterDailyChart');
    charts.waterDailyChart=new Chart(byId('waterDailyChart'),{
      type:'bar',
      data:{
        labels:last30.map(x=>fmt(x.date).slice(0,6)),
        datasets:[
          {label:'Daily consumption (m³)',data:last30.map(x=>parseFloat(x.consM3.toFixed(4))),backgroundColor:last30.map(x=>x.consM3>avgLast30*1.5?'rgba(239,68,68,0.75)':x.consM3>avgLast30*1.2?'rgba(251,146,60,0.75)':'rgba(14,165,233,0.75)'),borderRadius:4,borderSkipped:false},
          {label:'30-day average',data:Array(last30.length).fill(parseFloat(avgLast30.toFixed(4))),type:'line',borderColor:'#eda100',borderWidth:2,pointRadius:0,borderDash:[5,4]}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:MU,font:{size:11}},position:'bottom'},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} m³`}}},scales:{x:{ticks:{color:MU,maxTicksLimit:10},grid:{display:false}},y:{ticks:{color:MU,callback:v=>v+' m³'},grid:{color:GR},beginAtZero:true}}}
    });
  }else{setChartEmpty('waterDailyChart','No water consumption data yet. Log daily readings to see this chart.');}

  // Monthly totals
  const months=[...new Set(Object.keys(E).map(d=>d.slice(0,7)))].sort();
  const monthLabels=months.map(m=>{const[y,mo]=m.split('-').map(Number);return new Date(y,mo-1).toLocaleString('en-GB',{month:'short',year:'2-digit'});});
  const monthTotals=months.map(m=>{const s=waterMonthSummary(m);return parseFloat(s.totalM3.toFixed(3));});
  const monthTrend=monthTotals.map((_v,i)=>{const w=monthTotals.slice(Math.max(0,i-1),i+2);return parseFloat((w.reduce((a,x)=>a+x,0)/w.length).toFixed(3));});
  dc('waterMonthlyChart');
  if(monthTotals.some(v=>v>0)){
    charts.waterMonthlyChart=new Chart(byId('waterMonthlyChart'),{
      type:'bar',
      data:{labels:monthLabels,datasets:[
        {label:'Monthly total (m³)',data:monthTotals,backgroundColor:'rgba(14,165,233,0.7)',borderRadius:4,borderSkipped:false},
        {label:'Trend',data:monthTrend,type:'line',borderColor:'#eda100',borderWidth:2,pointRadius:2,tension:.3,fill:false}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:MU,font:{size:11}},position:'bottom'},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} m³`}}},scales:{x:{ticks:{color:MU},grid:{display:false}},y:{ticks:{color:MU,callback:v=>v+' m³'},grid:{color:GR},beginAtZero:true}}}
    });
  }

  // Cumulative meter reading
  dc('waterCumChart');
  if(readings.length>1){
    charts.waterCumChart=new Chart(byId('waterCumChart'),{
      type:'line',
      data:{labels:readings.map(([d])=>fmt(d).slice(0,6)),datasets:[{label:'Meter reading (m³)',data:readings.map(([,v])=>parseFloat((v.water/1000).toFixed(3))),borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,0.08)',borderWidth:2,pointRadius:2,fill:true,tension:.3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.parsed.y.toLocaleString()+' m³'}}},scales:{x:{ticks:{color:MU,maxTicksLimit:8},grid:{display:false}},y:{ticks:{color:MU,callback:v=>v.toLocaleString()+' m³'},grid:{color:GR},beginAtZero:false}}}
    });
  }

  // Day-of-week average
  const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dowTotals=Array(7).fill(0);const dowCounts=Array(7).fill(0);
  allDaily.forEach(x=>{const d=new Date(x.date+'T00:00:00').getDay();dowTotals[d]+=x.consM3;dowCounts[d]++;});
  const dowAvg=dowTotals.map((t,i)=>dowCounts[i]?parseFloat((t/dowCounts[i]).toFixed(4)):0);
  dc('waterDowChart');
  charts.waterDowChart=new Chart(byId('waterDowChart'),{
    type:'bar',
    data:{labels:dow,datasets:[{label:'Avg m³',data:dowAvg,backgroundColor:dowAvg.map(v=>v===Math.max(...dowAvg)?'rgba(239,68,68,0.75)':'rgba(14,165,233,0.7)'),borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`Avg: ${ctx.parsed.y} m³`}}},scales:{x:{ticks:{color:MU},grid:{display:false}},y:{ticks:{color:MU,callback:v=>v+' m³'},grid:{color:GR},beginAtZero:true}}}
  });

  // Log table
  const logRows=[...daily].reverse();
  byId('waterLogTable').innerHTML=logRows.length===0?'<div class="empty">No water readings yet. Enter meter readings in the Daily Entry tab.</div>':`
    <table class="tbl">
      <tr><th>Date</th><th>Meter reading (m³)</th><th>Prev. reading (m³)</th><th>Daily consumption (m³)</th><th>Notes</th></tr>
      ${logRows.map((r,i)=>`<tr${i===0?'':''}>
        <td>${fmt(r.date)}</td>
        <td style="font-family:monospace">${(r.readingL/1000).toFixed(3)}</td>
        <td style="color:var(--tm)">${isMeasured(r)?(r.prevL/1000).toFixed(3):'—'}</td>
        <td style="color:var(--wc);font-weight:${r.consM3!=null?'500':'400'}">${r.consM3!=null?r.consM3.toFixed(3):'Baseline'}</td>
        <td style="color:var(--tm);font-size:11px">${r.note||''}</td>
      </tr>`).join('')}
    </table>`;
}

