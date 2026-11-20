/* ===== REPORT DOWNLOADS: PDF / EXCEL / CSV ===== */
function loadScriptOnce(src: string): Promise<void>{
  return new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(new Error('Failed to load '+src));document.head.appendChild(s);
  });
}
async function ensurePDFLib(): Promise<JsPdfNamespace>{
  if(!(window.jspdf&&window.jspdf.jsPDF))await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const lib=window.jspdf;
  if(!lib)throw new Error('jsPDF failed to load');
  if(!(lib.jsPDF.API&&lib.jsPDF.API.autoTable))await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  return lib;
}
async function ensureXLSXLib(): Promise<XlsxNamespace>{
  if(!window.XLSX)await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const lib=window.XLSX;
  if(!lib)throw new Error('SheetJS failed to load');
  return lib;
}
function csvEscape(v: unknown): string{let s=v==null?'':String(v);if(/[",\n]/.test(s))s='"'+s.replace(/"/g,'""')+'"';return s;}
function rowsToCSV(rows: unknown[][]): string{return rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');}
function triggerDownload(blob: Blob, filename: string): void{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

async function downloadReportPDF(): Promise<void>{
  const range=getReportRange();if(!range){toast(byId('reportPeriodType').value==='week'?'Pick a date within the week':'Select a month');return;}
  byId('printMsg').textContent='Building PDF…';
  try{
    const pdfLib=await ensurePDFLib();
    const d=buildReportData(range);
    const{jsPDF}=pdfLib;
    const doc=new jsPDF({unit:'pt',format:'a4'});
    const pageW=doc.internal.pageSize.getWidth();
    const pageH=doc.internal.pageSize.getHeight();
    let y=40;
    const ensureSpace=(need=60)=>{if(y+need>pageH-40){doc.addPage();y=44;}};
    const lhW=pageW-80;const lhH=lhW*LETTERHEAD_RATIO;
    doc.addImage(LETTERHEAD_IMG,'PNG',40,y,lhW,lhH);
    y+=lhH+18;
    doc.setFontSize(16);doc.text('TEC Facility — '+range.titleWord+' Report',40,y);y+=18;
    doc.setFontSize(10);doc.setTextColor(110);
    doc.text('Period: '+range.label+'   ·   Generated: '+fmt(today()),40,y);y+=22;
    doc.setTextColor(0);

    doc.setFontSize(12);doc.text('General updates',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:8},head:[['Date','Update','Status','Note','Files']],
      body:d.mgu.length?d.mgu.map(g=>[fmt(g.date),g.header,g.status==='closed'?'Closed':'Open',g.note,g.files||'—']):[['No general updates this period','','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Summary',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:9},head:[['Metric','Value']],body:[
      ['Total energy',d.tot.toLocaleString()+' kWh'],
      ['Utility',d.u.toLocaleString()+' kWh'],
      ['Solar',d.s+' kWh'],
      ['Energy cost','KES '+d.cost.toLocaleString()],
      ['Water total',d.ws.totalM3.toFixed(3)+' m³'],
      ['Water avg/day',d.ws.avgM3.toFixed(4)+' m³'],
    ]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Incidents',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:8},head:[['Date','Category','Incident','Severity','Downtime','Status']],
      body:d.mi.length?d.mi.map(i=>[fmt(i.date),i.category,i.type,i.severity,incidentManHours(i).toFixed(2)+' mh',i.status]):[['No incidents this period','','','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Downtime',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:8},head:[['Date','Category','Area','Duration','Reason','Status']],
      body:d.mdt.length?d.mdt.map(x=>[fmt(x.date),x.category,x.area||'—',fmtDuration(downtimeMinutes(x)),x.reason||'—',x.status]):[['No downtime this period','','','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Events',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:8},head:[['Date','Category','Title','Attendees']],
      body:d.mev.length?d.mev.map(e=>[fmt(e.date),e.category,e.title,e.attendees||'—']):[['No events this period','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Compliance status',40,y);y+=6;
    const compSorted=[...CO].sort((a,b)=>(daysUntil(a.expiry)??999)-(daysUntil(b.expiry)??999));
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:7},head:[['Item','Category','Equipment','Expiry','Status','Files']],
      body:compSorted.length?compSorted.map(c=>{const dd=daysUntil(c.expiry);return[c.name,c.category,c.equipment||'—',fmt(c.expiry),dd===null?'No expiry':dd<0?'EXPIRED':dd===0?'Today':dd+' days',(c.attachments||[]).length||'—'];}):[['No compliance items','','','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Maintenance',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:8},head:[['Date','Asset','Work done','Technician','Cost (KES)','Files']],
      body:d.mml.length?d.mml.map(l=>{const a=MA.find(x=>x.id===l.assetId);return[fmt(l.date),a?a.name:'—',l.work,l.technician||'—',(l.cost||0).toLocaleString(),(l.attachments||[]).length||'—'];}):[['No maintenance logged this period','','','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Routine checks',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:8},head:[['Date','Asset','Items checked','Checked by','Files']],
      body:d.mrc.length?d.mrc.map(r=>{const a=MA.find(x=>x.id===r.assetId);return[fmt(r.date),a?a.name:'—',(r.items||'').split('\n').filter(Boolean).join('; '),r.checker||'—',(r.attachments||[]).length||'—'];}):[['No routine checks this period','','','','']]});
    y=doc.lastAutoTable.finalY+22;

    ensureSpace();doc.setFontSize(12);doc.text('Daily log',40,y);y+=6;
    doc.autoTable({startY:y+4,margin:{left:40,right:40},styles:{fontSize:7},head:[['Date','Utility (kWh)','Solar (kWh)','Meter (m³)','Water (m³)','Power','Internet']],
      body:d.en.length?d.en.map(([dt,v])=>{const wd=d.mwd.find(x=>x.date===dt);return[fmt(dt),v.utility||'—',(Number(v.solar1)||0)+(Number(v.solar2)||0),v.water?(v.water/1000).toFixed(3):'—',wd&&wd.consM3!=null?wd.consM3.toFixed(3):'Baseline',v.power||'—',v.internet||'—'];}):[['No entries this period','','','','','','']]});

    doc.save(`TEC_Report_${range.type}_${range.fileTag}.pdf`);
    byId('printMsg').textContent='PDF downloaded.';
    logActivity('export_report','Downloaded PDF report for '+range.label);
    toast('PDF downloaded.');
  }catch(err){
    byId('printMsg').textContent='PDF export failed: '+errorMessage(err);
    toast('PDF export failed — check your internet connection.',4000);
  }
}

async function downloadReportExcel(): Promise<void>{
  const range=getReportRange();if(!range){toast(byId('reportPeriodType').value==='week'?'Pick a date within the week':'Select a month');return;}
  byId('printMsg').textContent='Building Excel workbook…';
  try{
    const XLSX=await ensureXLSXLib();
    const d=buildReportData(range);
    const wb=XLSX.utils.book_new();

    const guRows: SheetRow[]=[['Date','Update','Status','Note','Attachments']];
    d.mgu.forEach(g=>guRows.push([fmt(g.date),g.header,g.status==='closed'?'Closed':'Open',g.note,g.files||0]));
    if(d.mgu.length===0)guRows.push(['No general updates this period','','','','']);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(guRows),'General Updates');

    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['DAVIS & SHIRTLIFF'],['PO Box 41762-00100, Nairobi, Kenya · Tel: (+254 20) 6968 000, 0711 079000 · headoffice@dayliff.com'],[],
      ['TEC Facility — '+range.titleWord+' Report'],['Period',range.label],['Generated',fmt(today())],[],
      ['Metric','Value'],
      ['Total energy (kWh)',d.tot],['Utility (kWh)',d.u],['Solar (kWh)',d.s],['Energy cost (KES)',d.cost],
      ['Water total (m³)',Number(d.ws.totalM3.toFixed(3))],['Water avg/day (m³)',Number(d.ws.avgM3.toFixed(4))],
    ]),'Summary');

    const dailyRows: SheetRow[]=[['Date','Utility (kWh)','Solar (kWh)','Meter (m³)','Water consumption (m³)','Power','Internet']];
    d.en.forEach(([dt,v])=>{const wd=d.mwd.find(x=>x.date===dt);dailyRows.push([fmt(dt),v.utility||'',(Number(v.solar1)||0)+(Number(v.solar2)||0),v.water?Number((v.water/1000).toFixed(3)):'',wd&&wd.consM3!=null?Number(wd.consM3.toFixed(3)):'',v.power||'',v.internet||'']);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dailyRows),'Daily Log');

    const incRows: SheetRow[]=[['Date','Category','Incident','Severity','Start','Resolved','Downtime (man-hrs)','Status']];
    d.mi.forEach(i=>incRows.push([fmt(i.date),i.category,i.type,i.severity,fmtDT(i.start),i.end?fmtDT(i.end):'Ongoing',Number(incidentManHours(i).toFixed(2)),i.status]));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(incRows),'Incidents');

    const dtRows: SheetRow[]=[['Date','Category','Area','Start','End','Duration (min)','Reason','Status']];
    d.mdt.forEach(x=>dtRows.push([fmt(x.date),x.category,x.area||'',fmtDT(x.start),x.end?fmtDT(x.end):'Ongoing',downtimeMinutes(x),x.reason||'',x.status]));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dtRows),'Downtime');

    const evRows: SheetRow[]=[['Date','Category','Title','Attendees','Description','Notes']];
    d.mev.forEach(e=>evRows.push([fmt(e.date),e.category,e.title,e.attendees||'',e.description||'',(e.notes||'').replace(/\n/g,'; ')]));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(evRows),'Events');

    const compRows: SheetRow[]=[['Item','Category','Equipment','Expiry','Status','Report Ref','Attachments']];
    CO.forEach(c=>{const dd=daysUntil(c.expiry);compRows.push([c.name,c.category,c.equipment||'',fmt(c.expiry),dd===null?'No expiry':dd<0?'EXPIRED':dd===0?'Today':dd+' days',c.reportRef||'',(c.attachments||[]).length]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(compRows),'Compliance');

    const mlRows: SheetRow[]=[['Date','Asset','Work done','Technician','Cost (KES)','Attachments']];
    d.mml.forEach(l=>{const a=MA.find(x=>x.id===l.assetId);mlRows.push([fmt(l.date),a?a.name:'',l.work,l.technician||'',l.cost||0,(l.attachments||[]).length]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(mlRows),'Maintenance');

    const rcRows: SheetRow[]=[['Date','Asset','Items checked','Comments','Checked by','Attachments']];
    d.mrc.forEach(r=>{const a=MA.find(x=>x.id===r.assetId);rcRows.push([fmt(r.date),a?a.name:'',(r.items||'').replace(/\n/g,'; '),r.comments||'',r.checker||'',(r.attachments||[]).length]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rcRows),'Routine Checks');

    XLSX.writeFile(wb,`TEC_Report_${range.type}_${range.fileTag}.xlsx`);
    byId('printMsg').textContent='Excel workbook downloaded.';
    logActivity('export_report','Downloaded Excel report for '+range.label);
    toast('Excel workbook downloaded.');
  }catch(err){
    byId('printMsg').textContent='Excel export failed: '+errorMessage(err);
    toast('Excel export failed — check your internet connection.',4000);
  }
}

function downloadReportCSV(): void{
  const range=getReportRange();if(!range){toast(byId('reportPeriodType').value==='week'?'Pick a date within the week':'Select a month');return;}
  const d=buildReportData(range);
  const out=[];
  out.push(['DAVIS & SHIRTLIFF']);out.push(['PO Box 41762-00100, Nairobi, Kenya - Tel: (+254 20) 6968 000, 0711 079000 - headoffice@dayliff.com']);out.push([]);
  out.push(['TEC Facility - '+range.titleWord+' Report']);out.push(['Period',range.label]);out.push(['Generated',fmt(today())]);out.push([]);
  out.push(['GENERAL UPDATES']);out.push(['Date','Update','Status','Note','Attachments']);
  d.mgu.forEach(g=>out.push([fmt(g.date),g.header,g.status==='closed'?'Closed':'Open',g.note,g.files||0]));
  out.push([]);out.push(['SUMMARY']);out.push(['Metric','Value']);
  out.push(['Total energy (kWh)',d.tot]);out.push(['Utility (kWh)',d.u]);out.push(['Solar (kWh)',d.s]);out.push(['Energy cost (KES)',d.cost]);
  out.push(['Water total (m3)',d.ws.totalM3.toFixed(3)]);out.push(['Water avg/day (m3)',d.ws.avgM3.toFixed(4)]);out.push([]);
  out.push(['DAILY LOG']);out.push(['Date','Utility (kWh)','Solar (kWh)','Meter (m3)','Water consumption (m3)','Power','Internet']);
  d.en.forEach(([dt,v])=>{const wd=d.mwd.find(x=>x.date===dt);out.push([fmt(dt),v.utility||'',(Number(v.solar1)||0)+(Number(v.solar2)||0),v.water?(v.water/1000).toFixed(3):'',wd&&wd.consM3!=null?wd.consM3.toFixed(3):'',v.power||'',v.internet||'']);});
  out.push([]);out.push(['INCIDENTS']);out.push(['Date','Category','Incident','Severity','Start','Resolved','Downtime (man-hrs)','Status']);
  d.mi.forEach(i=>out.push([fmt(i.date),i.category,i.type,i.severity,fmtDT(i.start),i.end?fmtDT(i.end):'Ongoing',incidentManHours(i).toFixed(2),i.status]));
  out.push([]);out.push(['DOWNTIME']);out.push(['Date','Category','Area','Start','End','Duration (min)','Reason','Status']);
  d.mdt.forEach(x=>out.push([fmt(x.date),x.category,x.area||'',fmtDT(x.start),x.end?fmtDT(x.end):'Ongoing',downtimeMinutes(x),x.reason||'',x.status]));
  out.push([]);out.push(['EVENTS']);out.push(['Date','Category','Title','Attendees','Description','Notes']);
  d.mev.forEach(e=>out.push([fmt(e.date),e.category,e.title,e.attendees||'',e.description||'',(e.notes||'').replace(/\n/g,'; ')]));
  out.push([]);out.push(['COMPLIANCE']);out.push(['Item','Category','Equipment','Expiry','Status','Report Ref','Attachments']);
  CO.forEach(c=>{const dd=daysUntil(c.expiry);out.push([c.name,c.category,c.equipment||'',fmt(c.expiry),dd===null?'No expiry':dd<0?'EXPIRED':dd===0?'Today':dd+' days',c.reportRef||'',(c.attachments||[]).length]);});
  out.push([]);out.push(['MAINTENANCE']);out.push(['Date','Asset','Work done','Technician','Cost (KES)','Attachments']);
  d.mml.forEach(l=>{const a=MA.find(x=>x.id===l.assetId);out.push([fmt(l.date),a?a.name:'',l.work,l.technician||'',l.cost||0,(l.attachments||[]).length]);});
  out.push([]);out.push(['ROUTINE CHECKS']);out.push(['Date','Asset','Items checked','Comments','Checked by','Attachments']);
  d.mrc.forEach(r=>{const a=MA.find(x=>x.id===r.assetId);out.push([fmt(r.date),a?a.name:'',(r.items||'').replace(/\n/g,'; '),r.comments||'',r.checker||'',(r.attachments||[]).length]);});

  const csv=rowsToCSV(out);
  triggerDownload(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}),`TEC_Report_${range.type}_${range.fileTag}.csv`);
  byId('printMsg').textContent='CSV downloaded.';
  logActivity('export_report','Downloaded CSV report for '+range.label);
  toast('CSV downloaded.');
}

