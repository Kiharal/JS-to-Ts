/* ===== ENERGY CORE ===== */
function getEnergyDailyData(): EnergyDay[]{
  const entries=Object.entries(E).filter((e): e is [string, WithUtility]=>e[1].utility!=null&&e[1].utility>0).sort(([a],[b])=>a.localeCompare(b));
  return entries.map((r,i)=>{
    const solar=(Number(r[1].solar1)||0)+(Number(r[1].solar2)||0);
    if(i===0)return{date:r[0],utility:0,solar,total:solar,baseline:true};
    const diff=Math.max(0,r[1].utility-entries[i-1][1].utility);
    return{date:r[0],utility:diff,solar,total:diff+solar,baseline:false};
  });
}
function energyMonthSummary(m: string): EnergyMonthSummary{
  const ed=getEnergyDailyData().filter(x=>!x.baseline&&x.date.startsWith(m));
  const total=ed.reduce((a,x)=>a+x.total,0);
  const avg=ed.length?total/ed.length:0;
  const peak=ed.length?ed.reduce((a,x)=>x.total>a.total?x:a,ed[0]):null;
  return{total,avg,peak,count:ed.length};
}
function getLoadDailyData<F extends LoadField>(field: F): LoadDay[]{
  const entries=Object.entries(E).filter((e): e is [string, DayEntry & Record<F, number>]=>e[1][field]!=null).sort(([a],[b])=>a.localeCompare(b));
  return entries.map(r=>({date:r[0],val:r[1][field],baseline:false}));
}
function loadMonthSummary(field: LoadField, m: string): LoadMonthSummary{
  const ld=getLoadDailyData(field).filter(x=>!x.baseline&&x.date.startsWith(m));
  return{total:ld.reduce((a,x)=>a+x.val,0),count:ld.length};
}

/* ===== WATER CORE ===== */
function getWaterData(): WaterData{
  const readings=Object.entries(E)
    .filter((e): e is [string, WithWater]=>e[1].water!=null&&e[1].water>0)
    .sort(([a],[b])=>a.localeCompare(b));
  const daily=readings.map((r,i)=>{
    if(i===0)return{date:r[0],readingL:r[1].water,consL:null,consM3:null,note:r[1].wNotes};
    const diff=Math.max(0,r[1].water-readings[i-1][1].water);
    return{date:r[0],readingL:r[1].water,prevDate:readings[i-1][0],prevL:readings[i-1][1].water,consL:diff,consM3:diff/1000,note:r[1].wNotes};
  });
  return{readings,daily};
}
/** Narrowing filter: days that have a consumption figure (i.e. everything except the baseline reading). */
function isMeasured(d: WaterDay): d is WaterMeasuredDay{return d.consL!=null;}
function waterMonthSummary(m: string): WaterSummary{
  const{daily}=getWaterData();
  const md=daily.filter(d=>d.date.startsWith(m)).filter(isMeasured);
  const total=md.reduce((a,d)=>a+d.consL,0);
  const avg=md.length?total/md.length:0;
  const peak=md.length?md.reduce((a,d)=>d.consL>a.consL?d:a,md[0]):null;
  return{totalL:total,totalM3:total/1000,avgM3:avg/1000,peak,count:md.length};
}
function waterRangeSummary(start: string, end: string): WaterSummary{
  const{daily}=getWaterData();
  const rd=daily.filter(d=>d.date>=start&&d.date<=end).filter(isMeasured);
  const total=rd.reduce((a,d)=>a+d.consL,0);
  const avg=rd.length?total/rd.length:0;
  const peak=rd.length?rd.reduce((a,d)=>d.consL>a.consL?d:a,rd[0]):null;
  return{totalL:total,totalM3:total/1000,avgM3:avg/1000,peak,count:rd.length};
}

/* ===== WATER CALC LIVE ===== */
function updateWaterCalc(): void{
  const d=byId('entryDate').value;
  const val=Number(byId('wMeter').value);
  const div=byId('wCalc');
  if(!val){div.innerHTML='Enter the current meter reading above to see calculated consumption.';div.style.color='var(--tm)';return;}
  const prev=Object.entries(E).filter((e): e is [string, WithWater]=>e[0]<d&&e[1].water!=null&&e[1].water>0).sort(([a],[b])=>b.localeCompare(a))[0];
  if(prev){
    const diff=val-prev[1].water;
    const diffM3=(diff/1000).toFixed(3);
    if(diff<0){div.innerHTML=`⚠ Reading (${val.toLocaleString()} L) is <strong>lower</strong> than previous (${prev[1].water.toLocaleString()} L on ${fmt(prev[0])}). Check meter.`;div.style.color='var(--rt)';}
    else{div.innerHTML=`Previous reading: <strong>${prev[1].water.toLocaleString()} L</strong> on ${fmt(prev[0])} &nbsp;·&nbsp; Today's consumption: <strong style="color:var(--wc)">${diff.toLocaleString()} L &nbsp;=&nbsp; ${diffM3} m³</strong>`;div.style.color='var(--wt)';}
  }else{div.innerHTML=`<i class="ti ti-info-circle"></i> No previous reading found — this will be recorded as the <strong>baseline</strong> meter reading.`;div.style.color='var(--wt)';}
}

