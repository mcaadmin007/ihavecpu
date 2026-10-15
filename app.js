(async()=>{
const root=document.getElementById('ih-preview');
root.querySelector('#ih-screen').textContent='กำลังโหลดข้อมูล…';
try {
const response=await fetch('/api/report',{cache:'no-store'});
if(!response.ok)throw new Error('Report unavailable');
const payload=await response.json();
if(!Array.isArray(payload.months)||!payload.months.length)throw new Error('No report');
const originalMonths=payload.months;
let months=originalMonths;
let metaPayload=null;
try {const result=await fetch('/api/meta',{cache:'no-store'});if(result.ok)metaPayload=await result.json();}catch{}
let platformPayload={accounts:[]};
try {const result=await fetch('/api/platforms',{cache:'no-store'});if(result.ok)platformPayload=await result.json();}catch{}
const thaiMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const shortMonths=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const sumKnown=values=>values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):NaN;
const mediaNames=[...new Set(originalMonths.flatMap(m=>m.rows.map(r=>r[0])))];
const sumAvailable=values=>{const known=values.filter(Number.isFinite);return known.length?known.reduce((a,b)=>a+b,0):NaN;};
const combinedMonths=Array.from({length:Math.max(originalMonths.length,metaPayload?Number(metaPayload.through.slice(5,7)):0,...platformPayload.accounts.map(a=>Number(a.through.slice(5,7))))},(_,i)=>{
 const original=originalMonths.find(m=>m.month===i+1),metrics={},sources={};
 const rows=mediaNames.map(name=>{
  if(name==='INAPP SHP'&&i>=2)return [name,NaN,NaN,NaN,NaN];
  const old=original?.rows.find(r=>r[0]===name),a=platformPayload.accounts.find(a=>a.name===name)||metaPayload?.accounts.find(a=>a.name===name);
  const d=a?.months.find(m=>m.month===i+1);
  const isMeta=!!metaPayload?.accounts.some(x=>x.name===name);
  const actual=isMeta?(d?.actual??NaN):(d?.actual??old?.[2]??NaN), sales=isMeta?(d?.sales??NaN):d&&a.source==="Google Ads report"?(d.sales??NaN):(d?.sales??old?.[3]??NaN),budget=old?.[1]??NaN;
  if(d)metrics[name]={...d,source:a.source||'Meta API'};
  sources[name]={actual:d?(a.source||'Meta API'):Number.isFinite(old?.[2])?'Cloudflare':'ยังไม่เชื่อมต่อ',sales:Number.isFinite(d?.sales)?(a.source||'Meta API'):!isMeta&&Number.isFinite(old?.[3])?'Cloudflare':'ยังไม่มีข้อมูล'};
  return [name,budget,actual,sales,actual>0&&Number.isFinite(sales)?sales/actual:NaN];
 });
 return {key:original?.key||`month-${i+1}`,year:2026,month:i+1,label:thaiMonths[i],short:shortMonths[i],rows,metrics,sources,budget:sumAvailable(rows.map(r=>r[1])),actual:sumAvailable(rows.map(r=>r[2])),sales:sumAvailable(rows.map(r=>r[3]))};
});
const metaMonths=null;


const pageNames={mediaPlan:"Media Plan",media:'ประสิทธิภาพราย Media',overview:'ภาพรวมผู้บริหาร',funnel:'Funnel ลูกค้า',drivers:'ลูกค้า สินค้าและโฆษณา'};
const state={page:'overview',media:'all',month:-1,margin:10,adjust:20};
let annual={label:'ภาพรวมปี',budget:0,actual:0,sales:0,rows:[]};
for(const m of months){annual.budget+=m.budget;annual.actual+=m.actual;annual.sales+=m.sales;}
for(const name of [...new Set(months.flatMap(m=>m.rows.map(r=>r[0])))]){
 const source=months.map(m=>m.rows.find(r=>r[0]===name));
 const sums=[1,2,3].map(col=>source.every(r=>r[col]!=null)?source.reduce((s,r)=>s+r[col],0):null);
 annual.rows.push([name,...sums,sums[1]>0&&sums[2]!=null?sums[2]/sums[1]:null]);
}
const selected=()=>state.month===-1?annual:months[state.month];
const design={radius:2};
const q=s=>root.querySelector(s);
const fmt=(n,d=0)=>!Number.isFinite(n)?'—':n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const million=n=>fmt(n/1e6,2);
const money=n=>Number.isFinite(n)?`<span class="ih-money" style="font-size:clamp(17px,1.65vw,24px);letter-spacing:-.5px;white-space:nowrap" aria-label="${fmt(n,2)} บาท">${fmt(n,2)}</span> <small>บาท</small>`:'—';
// Pair each channel-month before aggregating; never divide sums with different coverage.
const pairedRoas=m=>{
 const rows=(m===annual?months:[m]).flatMap(x=>x.rows).filter(r=>Number.isFinite(r[2])&&Number.isFinite(r[3]));
 const actual=rows.reduce((sum,r)=>sum+r[2],0),sales=rows.reduce((sum,r)=>sum+r[3],0);
 return actual>0?sales/actual:NaN;
};
const matchingCoverage=(rows,a,b)=>rows.every(r=>Number.isFinite(r[a])===Number.isFinite(r[b]));
const budgetComparable=(m,name=null)=>{const data=m===annual?months:[m];return data.every(x=>matchingCoverage(name?x.rows.filter(r=>r[0]===name):x.rows,1,2));};
const partialMonth=m=>[metaPayload?.through,...platformPayload.accounts.map(a=>a.through)].filter(Boolean).some(date=>{const [y,mo,day]=date.split('-').map(Number);return m.month===mo&&day<new Date(y,mo,0).getDate();});
const coverageKey=(m,col,name=null)=>(name?m.rows.filter(r=>r[0]===name):m.rows).filter(r=>Number.isFinite(r[col])).map(r=>r[0]).sort().join('|');
const comparableMonths=(a,b,label,name)=>{if(!a||!b||partialMonth(a)||partialMonth(b))return false;const cols=label.includes('ROAS')?[2,3]:label.includes('ผลต่าง')?[1,2]:label.includes('ยอดขาย')?[3]:[2];return cols.every(col=>coverageKey(a,col,name)===coverageKey(b,col,name));};
const kpi=(label,value,detail,wait=false,feature=false)=>`<div class="ih-kpi ${feature?'feature':''}"><div class="ih-label">${label}</div><div class="ih-value">${value}</div><div class="${wait?'ih-wait':'ih-detail'}">${detail}</div></div>`;
const panel=(title,tag,body)=>`<section class="ih-panel"><div class="ih-panel-head"><h2>${title}</h2>${tag||''}</div>${body}</section>`;
const wait='<span class="ih-tag wait">รอข้อมูลเพิ่ม</span>';
const ready='<span class="ih-tag ready">ข้อมูลจริง</span>';
const fields=a=>`<div class="ih-fields">${a.map(x=>`<span>${x}</span>`).join('')}</div>`;
const button=(page,text)=>`<button class="ih-micro-link" data-go="${page}">${text} →</button>`;
const titles={mediaPlan:["Media Plan","2026_Facebook ADs budget · Google Sheet"],media:['ประสิทธิภาพราย Media','เจาะรายช่องทางจากภาพรวมปี ลงไปถึงผลลัพธ์แต่ละเดือน'],overview:['ยอดขายดี แล้วกำไรล่ะ?','ภาพรวมยอดขาย ประสิทธิภาพโฆษณา และความพร้อมก่อนเพิ่มงบ'],funnel:['ลูกค้าหลุดที่ขั้นตอนไหน','ติดตามตั้งแต่เห็นโฆษณา จนถึงคำสั่งซื้อที่สำเร็จ'],profit:['เพิ่มงบ ต้องเห็นกำไรส่วนเพิ่ม','แยกผลจริงออกจากสมมติฐานก่อนตัดสินใจ'],drivers:['ลูกค้า สินค้าและโฆษณา','ติดตามลูกค้าใหม่และลูกค้าเก่า พร้อมยอดขายและกำไรของแต่ละกลุ่ม'],data:['เริ่มเก็บ 5 อย่างนี้ก่อน','แผนเพิ่มข้อมูลสำหรับวิเคราะห์ Funnel กำไร และการเติบโต']};
q('#ih-month').innerHTML='<option value="-1">ทั้งหมด</option>'+months.map((m,i)=>`<option value="${i}">${m.label}</option>`).join('')+['ตุลาคม','พฤศจิกายน','ธันวาคม'].map(name=>`<option disabled>${name} · ยังไม่มีข้อมูล</option>`).join('');
function overview(m){
const prev=state.month>=0?months[state.month-1]:null,change=prev?(m.sales/prev.sales-1)*100:null;
const sorted=[...m.rows].sort((a,b)=>(b[3]||0)-(a[3]||0));
const table=`<div class="ih-table-wrap"><table><thead><tr><th>ช่องทาง</th><th>ใช้จริง (฿)</th><th>ยอดขาย (฿)</th><th>ROAS</th><th>กำไรหลังโฆษณา</th></tr></thead><tbody>${sorted.map(r=>`<tr><td class="ih-platform"><button class="ih-micro-link" data-media="${r[0]}">${r[0]} ↗</button></td><td>${fmt(r[2],2)}</td><td>${fmt(r[3],2)}</td><td>${!Number.isFinite(r[4])?'—':fmt(r[4],state.month===-1?1:0)+'x'}</td><td class="ih-faint">รอข้อมูลต้นทุน</td></tr>`).join('')}</tbody></table></div>`;
return `<div class="ih-kpis">${kpi('กำไรหลังหักค่าโฆษณา','—','ต้องมีต้นทุน ส่วนลด และค่าธรรมเนียม',true,true)}${kpi('ยอดขายที่รายงาน',money(m.sales),change===null?(state.month===-1?'ยอดรวมที่มีข้อมูลในช่วงที่เลือก':'ยอดขายตามรายงานต้นฉบับ'):(change>=0?'+':'')+fmt(change,1)+'% เทียบเดือนก่อน')}${kpi('ค่าโฆษณาจริง',money(m.actual),budgetComparable(m)&&m.budget>0?fmt(m.actual/m.budget*100,1)+'% ของงบ '+fmt(m.budget,2)+' บาท':'งบและยอดใช้จริงมีช่วงข้อมูลไม่ตรงกัน')}${kpi('ROAS รวม',fmt(pairedRoas(m),1)+'<small>x</small>','ยอดขายรวม ÷ ใช้จริงรวม · เฉพาะ Media และเดือนที่มีข้อมูลครบคู่')}${kpi('ROAS คุ้มทุน','—','ต้องมีอัตรากำไรส่วนเกินก่อนค่าโฆษณา',true)}${kpi('CAC ลูกค้าใหม่','—','ต้องแยกลูกค้าใหม่และค่าใช้จ่ายที่เกี่ยวข้อง',true)}</div><div class="ih-grid">${panel('ยอดขายรายเดือน',ready,`<div class="ih-sub">ล้านบาท · ปี 2569 · กดแท่งเพื่อดูรายเดือน</div><div class="ih-trend" role="group" aria-label="ยอดขายรายเดือน ปี 2569">${months.map((x,i)=>`<button type="button" data-month="${i}" style="border:0;padding:0;background:transparent;color:var(--ih-muted)" class="ih-bar-col ${state.month===-1||i===state.month?'selected':''}"><span class="ih-chart-value">${fmt(x.sales/1e6,1)}</span><div class="ih-bar" style="height:${x.sales/Math.max(...months.map(d=>d.sales))*88}px"></div><span>${x.short}</span></button>`).join('')}${shortMonths.slice(months.length).map(label=>`<div class="ih-bar-col"><span>—</span><div style="height:20px;width:70%;background:var(--ih-line);opacity:.35;border-radius:4px"></div><span>${label}</span></div>`).join('')}</div>`)}${panel('เทรนสถิติ',wait,`<div class="ih-sub">ยังไม่มีจำนวนในแต่ละขั้น</div>${['Impressions','Clicks / Sessions','Add to cart','Checkout','Orders'].map(n=>`<div class="ih-step"><span>${n}</span><div class="ih-step-track"></div><span>—</span></div>`).join('')}${button('funnel','ดู Funnel และตัวชี้วัด')}`)}</div>${panel('เปรียบเทียบช่องทาง',`<span class="ih-tag">เรียงตามยอดขาย</span>`,table)}`;
}
function media(m){
 if(state.media==='all')return `<div class="ih-panel" style="margin-bottom:14px"><div class="ih-panel-head" style="margin-bottom:0"><label for="ih-media">Media / ช่องทางโฆษณา ${metaMonths?'· Meta API':''}</label><select id="ih-media"><option value="all" selected>รวมทุก Media${metaMonths?' · Meta':''}</option>${months[0].rows.map(row=>`<option>${row[0]}</option>`).join('')}</select></div></div>`+overview(m);

 const r=m.rows.find(row=>row[0]===state.media), series=months.map((month,i)=>({month,i,row:month.rows.find(row=>row[0]===state.media)}));
 const available=series.filter(x=>x.row[3]!=null).length;
 const costMonths=series.filter(x=>x.row[2]!=null).length;
 const ratio=r[4];
 const variance=!budgetComparable(m,state.media)||!Number.isFinite(r[2])||!Number.isFinite(r[1])?null:r[2]-r[1];
 const options=`<option value="all">รวมทุก Media${metaMonths?' · Meta':''}</option>`+months[0].rows.map(row=>`<option ${row[0]===state.media?'selected':''}>${row[0]}</option>`).join('');
 const chart=(col,label,unit,scale)=>{
 const max=Math.max(...series.map(x=>x.row[col]||0),1);
 return panel(label,`<span class="ih-tag">${unit}</span>`,`<div style="max-width:100%;overflow-x:auto;padding-bottom:8px"><div class="ih-trend" style="height:155px;min-width:960px;grid-template-columns:repeat(12,minmax(0,1fr))" role="group" aria-label="${label} รายเดือน">${series.map(x=>`<button type="button" class="ih-bar-col ${state.month===-1||state.month===x.i?'selected':''}" data-month="${x.i}" style="border:0;padding:0;background:transparent;color:var(--ih-muted)" aria-label="${x.month.label}: ${fmt(x.row[col],2)} บาท"><span class="ih-chart-value">${x.row[col]==null?'—':fmt(x.row[col]/scale,scale===1?2:1)}</span><div class="ih-bar" style="height:${x.row[col]==null?0:(x.row[col]/max)*100}px;min-height:${x.row[col]>0?2:0}px"></div><span>${x.month.short}</span></button>`).join('')}${shortMonths.slice(months.length).map(t=>`<div class="ih-bar-col"><span>—</span><span>${t}</span></div>`).join('')}</div></div>`);
 };
 return `<div class="ih-panel" style="margin-bottom:14px"><div class="ih-panel-head" style="margin-bottom:0"><label for="ih-media">Media / ช่องทางโฆษณา ${metaMonths?'· Meta API':''}</label><select id="ih-media">${options}</select></div><div class="ih-badge-line"><span class="ih-tag ready">${state.month===-1?'สะสมปี 2569':m.label+' 2569'}</span></div></div><div class="ih-kpis">${kpi('ยอดขาย · '+state.media,!Number.isFinite(r[3])?'—':money(r[3]),state.month===-1?'ยอดสะสมที่มีข้อมูล':'ยอดขายในเดือนที่เลือก',r[3]==null,true)}${kpi('ค่าโฆษณาจริง',!Number.isFinite(r[2])?'—':money(r[2]),'งบประมาณ '+fmt(r[1])+' บาท',r[2]==null)}${kpi('ROAS จากยอดขาย / ใช้จริง',ratio==null?'—':fmt(ratio,1)+'<small>x</small>','ยอดขาย ÷ ใช้จริง · เฉพาะเดือนที่มีข้อมูลครบคู่',ratio==null)}${kpi('ผลต่างจากงบ',variance==null?'—':money(variance),!budgetComparable(m,state.media)?'งบและยอดใช้จริงมีช่วงข้อมูลไม่ตรงกัน':r[2]==null?'ค่าใช้จ่ายยังไม่ครบ':r[1]>0?'ใช้แล้ว '+fmt(r[2]/r[1]*100,1)+'% ของงบ':'ไม่มีงบตั้งไว้',r[2]==null)}${kpi('สัดส่วนค่าโฆษณารวม',!Number.isFinite(r[2])?'—':fmt(r[2]/m.actual*100,1)+'<small>%</small>','เทียบทุก Media ในช่วงเดียวกัน',r[2]==null)}${kpi('กำไรหลังโฆษณา','—','รอต้นทุนของ '+state.media,true)}</div><div class="ih-grid">${chart(3,'แนวโน้มยอดขาย','บาท',1)}${chart(2,'แนวโน้มค่าโฆษณา','บาท',1)}</div>${panel('ประสิทธิภาพรายเดือน · '+state.media,`<span class="ih-tag">กดเดือนเพื่อเจาะรายละเอียด</span>`,`<div class="ih-table-wrap"><table><thead><tr><th>เดือน</th><th>Budget (฿)</th><th>Actual (฿)</th><th>ผลต่างงบ (฿)</th><th>Sales (฿)</th><th>ROAS คำนวณ</th></tr></thead><tbody>${series.map(x=>{const a=x.row,roas=a[2]>0&&a[3]!=null?a[3]/a[2]:null;return `<tr style="${state.month===x.i?'background:var(--ih-soft)':''}"><td><button class="ih-micro-link" data-month="${x.i}">${x.month.label}</button></td><td>${fmt(a[1])}</td><td>${fmt(a[2],2)}</td><td>${a[2]==null?'—':fmt(a[2]-a[1],2)}</td><td>${fmt(a[3],2)}</td><td>${roas==null?'—':fmt(roas,1)+'x'}</td></tr>`}).join('')}</tbody></table></div><p class="ih-sub">ROAS หน้านี้คำนวณจาก Sales ÷ Actual จึงอาจต่างจากค่า ROAS ที่ปัดเศษในต้นฉบับ</p>`)}<div class="ih-grid" style="margin-top:14px;grid-template-columns:minmax(0,1fr)">${panel('Funnel · '+state.media,wait,`<div class="ih-water-row"><span>Clicks / Sessions / Orders</span><strong>— / — / —</strong></div><div class="ih-water-row"><span>CTR / CPC / CVR</span><strong>— / — / —</strong></div>`)}${panel('ตัวขับเคลื่อน · '+state.media,wait,fields(['Campaign / Creative','Category','ลูกค้าใหม่ / CAC','ส่วนลด / คืนสินค้า'])+``)}</div>`;
}

function originalfunnel(){return panel('Funnel การซื้อ',wait,`<div class="ih-full-funnel">${['Impressions','Reach','Clicks','Sessions','Add to cart','Checkout','Orders'].map(n=>`<div class="ih-funnel-item"><span class="ih-funnel-name">${n}</span><strong>—</strong><span class="ih-sub">ยังไม่มีข้อมูล</span></div>`).join('')}</div><div class="ih-metric-row">${['CPM · ต่อ 1,000 ครั้ง','CTR · Clicks / Impressions','CPC · ค่าใช้จ่ายต่อคลิก','CVR · Orders / Sessions'].map(n=>`<div><span class="ih-sub">${n}</span><strong>—</strong></div>`).join('')}</div><p class="ih-sub">Reach คือคนที่เข้าถึง ไม่ใช้เป็นขั้นคำนวณอัตราหลุดต่อจาก Impressions</p>`)+`<div class="ih-grid" style="margin-top:14px">${panel('คุณภาพคำสั่งซื้อ',wait,`<div class="ih-water-row"><span>คำสั่งซื้อทั้งหมด</span><strong>—</strong></div><div class="ih-water-row"><span>ยกเลิก / คืนสินค้า / COD ไม่สำเร็จ</span><strong>—</strong></div><div class="ih-water-row total"><span>คำสั่งซื้อสำเร็จสุทธิ</span><strong>—</strong></div>`)}${panel('บริบทของยอดขาย',wait,fields(['วันที่ / วันในสัปดาห์','Device / Region','Voucher / Campaign day','Attribution window','Direct / Organic'])+button('data','ดูโครงสร้างข้อมูล'))}</div>`;}
function originalprofit(m){return `<div class="ih-kpis">${kpi('กำไรขั้นต้นจริง','—','ยอดขายสุทธิ − ต้นทุนสินค้า',true)}${kpi('กำไรหลังโฆษณาจริง','—','หลังหักต้นทุนผันแปรและค่าโฆษณา',true,true)}${kpi('กำไรส่วนเพิ่มจากเพิ่มงบ','—','ต้องมีผลทดลองและข้อมูลเปรียบเทียบ',true)}</div>${panel('ทดลองสมมติฐานกำไร',`<span class="ih-tag wait">สถานการณ์สมมติ</span>`,`<div class="ih-controls"><label>อัตรากำไรส่วนเกินก่อนค่าโฆษณา <strong id="ih-margin-label"></strong><input id="ih-margin" type="range" min="1" max="30" step="1" value="${state.margin}" aria-label="อัตรากำไรส่วนเกินสมมติ"></label><label>ทดลองเพิ่มงบโฆษณา <strong id="ih-adjust-label"></strong><input id="ih-adjust" type="range" min="0" max="100" step="5" value="${state.adjust}" aria-label="เปอร์เซ็นต์เพิ่มงบสมมติ"></label></div><p class="ih-sub">สมมติให้ยอดขายที่รายงานเป็นยอดสุทธิไม่ซ้ำ และอัตรากำไรนี้หักต้นทุนสินค้า ส่วนลด ค่าธรรมเนียม และค่าขนส่งแล้ว</p><div id="ih-scenario"></div>`)}<div class="ih-grid" style="margin-top:14px">${panel('ลูกค้าใหม่และระยะยาว',wait,`<div class="ih-water-row"><span>ลูกค้าใหม่ / ลูกค้าเดิม</span><strong>— / —</strong></div><div class="ih-water-row"><span>CAC ลูกค้าใหม่</span><strong>—</strong></div><div class="ih-water-row"><span>Repeat purchase / LTV</span><strong>— / —</strong></div>`)}${panel('หลักฐานก่อนเพิ่มงบ',wait,fields(['กำไรหลังโฆษณา','CAC ลูกค้าใหม่','Conversion Rate','Break-even ROAS','ยอดขายและกำไรส่วนเพิ่ม'])+`<div class="ih-sub">ผลของงบเพิ่มต้องประเมินจากการทดลอง ไม่ใช้ ROAS เดิมทำนายโดยตรง</div>`)}</div>`;}
function originaldrivers(){return `<div class="ih-grid">${panel('หมวดหมู่สินค้า / Category',wait,`<div class="ih-empty"><i data-lucide="package" aria-hidden="true"></i><strong>สินค้าไหนสร้างกำไรจริง?</strong><span>ยอดขาย · จำนวนชิ้น · กำไร</span></div>${fields(['Category','จำนวนชิ้น','ราคาขายเฉลี่ย'])}`)}${panel('Campaign / Creative',wait,`<div class="ih-empty"><i data-lucide="images" aria-hidden="true"></i><strong>โฆษณาชิ้นไหนควรต่อยอด?</strong><span>ค่าโฆษณา · CTR · CVR · กำไรหลังโฆษณา</span></div>${fields(['Campaign','Ad set','Creative','Audience','Placement','Keyword'])}`)}</div>${panel('มุมมองที่ทีมจะใช้ตัดสินใจ',wait,`<div class="ih-table-wrap"><table><thead><tr><th>สินค้า / แคมเปญ</th><th>ยอดขาย</th><th>กำไรหลังโฆษณา</th><th>CVR</th><th>สถานะสต็อก</th></tr></thead><tbody><tr><td colspan="5" style="text-align:center;padding:35px;color:var(--ih-muted)">รอข้อมูลระดับ Category และ Campaign เพื่อจัดอันดับ</td></tr></tbody></table></div>`)} `;}
const priorities=[['Clicks / Sessions','เห็นต้นทุนการเข้าชมและจุดเริ่มต้นของ Conversion'],['Orders','วัด CVR และต้นทุนต่อคำสั่งซื้อ'],['Gross Profit + ต้นทุนผันแปร','หากำไรหลังโฆษณาและ ROAS คุ้มทุน'],['Campaign + Creative','เชื่อมผลลัพธ์กลับไปยังโฆษณา'],['Category','แยกสินค้าที่สร้างยอดขายออกจากสินค้าที่สร้างกำไร']];
function originaldata(){return `<div class="ih-banner"><i data-lucide="database" aria-hidden="true"></i><span>พร้อมแล้ว: Budget · Actual · Sales · ROAS · เดือน · ช่องทาง</span></div>${panel('ข้อมูลที่ควรเพิ่มก่อน',`<span class="ih-tag">ลำดับเริ่มต้น</span>`,`<div class="ih-data-list">${priorities.map((p,i)=>`<div class="ih-data-row"><span class="ih-number">${i+1}</span><div><strong>${p[0]}</strong><p>${p[1]}</p></div><span class="ih-tag wait">ยังไม่มีข้อมูล</span></div>`).join('')}</div>`)}<div class="ih-grid" style="margin-top:14px">${panel('เก็บต่อในระยะถัดไป','',fields(['ลูกค้าใหม่ / เก่า · CAC · LTV','ยกเลิก · คืนสินค้า · คืนเงิน · COD','Voucher · ส่วนลด · Campaign day','วันที่ · Device · Region','Attribution · Assisted conversion','Impressions · Reach · Cart · Checkout']))}${panel('รูปแบบข้อมูลที่ต้องเชื่อม','',`<div class="ih-water-row"><span>โฆษณา</span><strong>วันที่ + ช่องทาง + Campaign</strong></div><div class="ih-water-row"><span>คำสั่งซื้อ</span><strong>Order ID + SKU</strong></div><div class="ih-water-row"><span>ลูกค้า</span><strong>Customer ID</strong></div><div class="ih-sub" style="margin-top:10px">ใช้ Order ID ตรวจยอดซ้ำ และผูกต้นทุนกับคำสั่งซื้อเดียวกัน</div>`)}</div>`;}
function scenario(){const m=selected(),rate=state.margin/100,extra=m.actual*state.adjust/100; q('#ih-margin-label').textContent=state.margin+'%';q('#ih-adjust-label').textContent='+'+state.adjust+'%';q('#ih-scenario').innerHTML=`<div class="ih-metric-row"><div><span class="ih-sub">ROAS คุ้มทุนสมมติ</span><strong>${fmt(1/rate,1)}x</strong></div><div><span class="ih-sub">กำไรหลังโฆษณาสมมติ</span><strong>${fmt((m.sales*rate-m.actual)/1000,0)} <small style="font-size:11px">พันบาท</small></strong></div><div><span class="ih-sub">ค่าโฆษณาเพิ่ม</span><strong>${fmt(extra/1000,1)} <small style="font-size:11px">พันบาท</small></strong></div><div><span class="ih-sub">ยอดขายเพิ่มขั้นต่ำเพื่อคุ้มงบ</span><strong>${fmt(extra/rate/1e6,2)} <small style="font-size:11px">ล้านบาท</small></strong></div></div><p class="ih-sub">เป็นเกณฑ์คุ้มทุนตามสมมติฐาน ไม่ใช่การคาดการณ์ยอดขายหรือกำไรจริง</p>`;}
function save(){if(window.openai?.setWidgetState)window.openai.setWidgetState({modelContent:{media:state.media,page:pageNames[state.page],period:state.month===-1?'ภาพรวมปี 2569 (ม.ค.–ก.ย.)':months[state.month].label+' 2569',scenarioMargin:state.margin,scenarioBudgetIncrease:state.adjust},privateContent:{...state,version:5}}).catch(()=>{});}
function enhanceMetrics(m){
 const cards=[...root.querySelectorAll('.ih-kpi')];
 const previous=state.month>0?months[state.month-1]:null;
 const metricFor=(month,index,label)=>{
  if(!month)return null;
  const name=state.page==='media'&&state.media!=='all'?state.media:null;
  const row=name?month.rows.find(r=>r[0]===name):null;
  const sales=name?row?.[3]:month.sales,actual=name?row?.[2]:month.actual,budget=name?row?.[1]:month.budget;
  const d=unavailableMetrics(sales,actual,index);
  if(label.includes('กำไรหลัง'))return d?.profit??null;
  if(label.includes('กำไรขั้นต้น'))return d?.gross??null;
  if(label.includes('คุ้มทุน'))return d&&d.contribution>0?d.sales/d.contribution:null;
  if(label.includes('CAC'))return d&&d.newCustomers>0?actual/d.newCustomers:null;
  if(label.includes('ROAS'))return row?row[4]:pairedRoas(month);
  if(label.includes('ยอดขาย'))return sales??null;
  if(label.includes('สัดส่วน'))return actual!=null&&month.actual>0?actual/month.actual*100:null;
  if(label.includes('ผลต่างจากงบ'))return actual!=null&&budget!=null?actual-budget:null;
  if(label.includes('ค่าโฆษณา'))return actual??null;
  return null;
 };
 cards.forEach(card=>{
  if(state.month<0)return;
  card.classList.remove('ih-positive');
  const label=card.querySelector('.ih-label').textContent;
  const now=metricFor(m,state.month,label),before=metricFor(previous,state.month-1,label);
  const detail=card.querySelector('.ih-detail');
  if(detail?.textContent.includes('% เทียบเดือนก่อน'))detail.textContent='ยอดขายตามรายงานต้นฉบับ';
  const tag=document.createElement('span');tag.className='ih-change';
  if(!previous)tag.textContent='— ไม่มีข้อมูลเดือนก่อน';
  else if(!comparableMonths(m,previous,label,state.page==='media'&&state.media!=='all'?state.media:null))tag.textContent='— ช่วงข้อมูลเปรียบเทียบไม่ตรงกัน';
  else if(!Number.isFinite(now)||!Number.isFinite(before))tag.textContent='— ข้อมูลเปรียบเทียบไม่ครบ';
  else if(before===0&&now!==0)tag.textContent='— เดือนก่อนเป็น 0';
  else if(label.includes('ผลต่างจากงบ'))tag.textContent=(now-before>=0?'+':'')+fmt(now-before,2)+' บาท เทียบเดือนก่อน';
  else if(label.includes('สัดส่วน'))tag.textContent=(now-before>=0?'+':'')+fmt(now-before,1)+' จุดเปอร์เซ็นต์ เทียบเดือนก่อน';
  else {
   const delta=before===0?0:(now-before)/Math.abs(before)*100;
   const rounded=Number(delta.toFixed(1));
   tag.textContent=(rounded>0?'↑ +':rounded<0?'↓ −':'')+fmt(Math.abs(rounded),1)+'% เทียบเดือนก่อน';
   const lowerBetter=label.includes('CAC')||label.includes('คุ้มทุน');
   const higherBetter=label.includes('ยอดขาย')||label.includes('กำไร')||(label.includes('ROAS')&&!lowerBetter);
   if(rounded!==0&&(lowerBetter||higherBetter)){
    const good=lowerBetter?delta<0:delta>0;
    tag.classList.add(good?'good':'bad');
    if(good)card.classList.add('ih-positive');
   }
  }
  card.appendChild(tag);
 });
 const rows=[...root.querySelectorAll('.ih-table-wrap tbody tr')];
 if(rows.length&&rows[0].cells.length===5){
  const available=rows.map(row=>({row,value:Number(row.cells[3].textContent.replace(/[,x]/g,''))})).filter(x=>Number.isFinite(x.value)&&x.value>0);
  const best=available.reduce((a,b)=>!a||b.value>a.value?b:a,null);
  if(best){best.row.classList.add('ih-best');const badge=document.createElement('span');badge.className='ih-best-label';badge.textContent='ROAS สูงสุด';best.row.cells[0].appendChild(badge);}
 }
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 cards.forEach(card=>card.querySelector('.ih-value')?.animate([{opacity:.65},{opacity:1}],{duration:250}));
}

const missingTag='<span class="ih-tag wait">ยังไม่มีข้อมูล</span>';
function unavailableMetrics(sales,actual){return {sales,actual,orders:NaN,conversions:NaN,skuOrders:NaN,landingPageViews:NaN,sessions:NaN,clicks:NaN,impressions:NaN,cart:NaN,checkout:NaN,newCustomers:NaN,gross:NaN,fees:NaN,shipping:NaN,discount:NaN,refund:NaN,contribution:NaN,profit:NaN};}

function setReportSource(){
 months=combinedMonths;
 if(state.month>=months.length)state.month=-1;
 annual={label:'ภาพรวมปี',budget:sumAvailable(months.map(m=>m.budget)),actual:sumAvailable(months.map(m=>m.actual)),sales:sumAvailable(months.map(m=>m.sales)),rows:[]};
 for(const name of [...new Set(months.flatMap(m=>m.rows.map(r=>r[0])))]){
 const rows=months.map(m=>m.rows.find(r=>r[0]===name));
 const sums=[1,2,3].map(col=>sumAvailable(rows.map(r=>r?.[col])));
 const paired=rows.filter(r=>Number.isFinite(r?.[2])&&Number.isFinite(r?.[3]));
 const pairedCost=sumAvailable(paired.map(r=>r[2])),pairedSales=sumAvailable(paired.map(r=>r[3]));
 annual.rows.push([name,...sums,pairedCost>0?pairedSales/pairedCost:NaN]);
 }
 if(state.page==='media'&&state.media!=='all'&&!annual.rows.some(r=>r[0]===state.media))state.media='all';
 q('#ih-month').innerHTML='<option value="-1">ทั้งหมด</option>'+months.map((m,i)=>`<option value="${i}">${m.label}</option>`).join('')+thaiMonths.slice(months.length).map(n=>`<option disabled>${n} · ยังไม่มีข้อมูล</option>`).join('');
}
function reportMetrics(month,name){
 const row=name?month.rows.find(r=>r[0]===name):null;
 const d=unavailableMetrics(name?row?.[3]:month.sales,name?row?.[2]:month.actual);
 if(!month.metrics)return d;
 const entries=name?[month.metrics[name]||{}]:mediaNames.map(n=>month.metrics[n]||{});
 // The main Meta account covers Facebook and CPAS iHAVECPU: count it once in the overview.
 if(!name&&!metaPayload?.mainAccountSplit){const main=metaPayload?.accounts.find(a=>a.name==='iHAVECPU (Meta)')?.months.find(x=>x.month===month.month);if(main)entries.push(main);}
 for(const key of ['impressions','clicks','orders','skuOrders','cart','checkout','landingPageViews','conversions','unitsSold','likes','comments','shares','inbox'])d[key]=sumAvailable(entries.map(x=>x[key]));
 return d;
}

function missingMetrics(m,name=null){
 const source=state.month===-1?months:[m];
 const entries=source.map(x=>reportMetrics(x,name));
 if(entries.some(x=>!x))return null;
 return Object.fromEntries(Object.keys(entries[0]).map(key=>[key,sumAvailable(entries.map(x=>x[key]))]));
}
function detailRows(rows){return rows.map(([a,b])=>`<div class="ih-water-row"><span>${a}</span><strong>${b}</strong></div>`).join('');}
function funnelRows(d){return ['Impressions','Clicks','Sessions','Add to cart','Checkout','Orders'].map((label,i)=>{const values=[d.impressions,d.clicks,d.sessions,d.cart,d.checkout,d.orders];return `<div class="ih-step"><span>${label}</span><div class="ih-step-track"><span style="width:${values[i]/d.impressions*100}%;background:var(--ih-green)"></span></div><span>${fmt(values[i])}</span></div>`;}).join('');}
const googleRates=[.51,1.82,3.72,2.18,1.11,1.88,2.93,1.47,1.72,1.46];
const googleRateSnapshot=[{"month": 1, "actual": 92515.55, "clicks": 72355.0, "impressions": 3237571.0, "conversions": 2759.81}, {"month": 2, "actual": 53924.57, "clicks": 71391.0, "impressions": 653764.0, "conversions": 2469.38}, {"month": 3, "actual": 42263.71, "clicks": 87144.0, "impressions": 305722.0, "conversions": 3240.61}, {"month": 4, "actual": 37223.43, "clicks": 86724.0, "impressions": 392891.0, "conversions": 3077.3}, {"month": 5, "actual": 37622.75, "clicks": 92088.0, "impressions": 610445.0, "conversions": 2511.5}, {"month": 6, "actual": 39661.95, "clicks": 96875.0, "impressions": 496941.0, "conversions": 3057.56}, {"month": 7, "actual": 31843.9, "clicks": 82707.0, "impressions": 286430.0, "conversions": 2422.43}, {"month": 8, "actual": 37788.96, "clicks": 82947.0, "impressions": 553127.0, "conversions": 1882.77}, {"month": 9, "actual": 30402.9, "clicks": 42898.0, "impressions": 112404.0, "conversions": 738.15}, {"month": 10, "actual": 14530.97, "clicks": 16692.0, "impressions": 41799.0, "conversions": 243.52}];
function googleMetrics(d,index=state.month){const sample=index<0?googleRateSnapshot.reduce((a,m)=>({actual:a.actual+m.actual,conversions:a.conversions+m.conversions,clicks:a.clicks+m.clicks}),{actual:0,conversions:0,clicks:0}):googleRateSnapshot[index];const rateMatches=sample&&Math.abs(d.actual-sample.actual)<.02&&Math.abs(d.conversions-sample.conversions)<.02&&d.clicks===sample.clicks;return {...d,ctr:d.impressions>0?d.clicks/d.impressions*100:NaN,cpc:d.clicks>0?d.actual/d.clicks:NaN,convRate:rateMatches?(index<0?1.44:googleRates[index]):NaN,costPerConversion:d.conversions>0?d.actual/d.conversions:NaN};}
function googleMetricValue(value,key){if(!Number.isFinite(value))return '—';return fmt(value,['impressions','clicks'].includes(key)?0:2)+(['ctr','convRate'].includes(key)?'%':['cpc','actual','costPerConversion'].includes(key)?' ฿':'');}
function googleDrivers(){return `<div class="ih-panel-head"><h2>ตัวขับเคลื่อน · Google</h2><span class="ih-tag">Ad group → Keyword</span></div><p class="ih-sub">เลือกกลุ่มโฆษณาเพื่อดู Keyword และผลลัพธ์ในช่วงเดือนที่เลือก</p><details class="google-group"><summary>กลุ่มโฆษณา · รอข้อมูล Ad group <span class="ih-tag wait">ยังไม่มีข้อมูลรายกลุ่ม</span></summary><div class="ih-table-wrap"><table><thead><tr><th>Keyword</th><th>Impression</th><th>Click</th><th>CTR</th><th>Conv.</th><th>Cost per conversion</th></tr></thead><tbody><tr><td colspan="6" style="text-align:center;padding:28px">ยังไม่มีรายงาน Ad group / Keyword ในข้อมูลที่นำเข้าปัจจุบัน</td></tr></tbody></table></div></details><p class="ih-sub" style="margin-top:14px">รอเชื่อมรายงานระดับ Ad group / Keyword</p>`;}

let tikSelected=new Set(['actual','skuOrders']);
const tikDefs=[['actual','ต้นทุน','THB','#009e9e'],['skuOrders','คำสั่งซื้อ SKU','','#477dcc'],['costOrder','ต้นทุนต่อคำสั่งซื้อ','THB','#ac69c1'],['sales','รายได้ขั้นต้น','THB','#e18b32'],['roi','ROI','','#238457']];
function tikMetrics(d,index=state.month){const paired=index<0?months.map(m=>reportMetrics(m,'TIKTOK GMVMAX')).filter(m=>Number.isFinite(m.skuOrders)&&Number.isFinite(m.actual)):[];const cost=index<0?sumAvailable(paired.map(m=>m.actual)):d.actual;return {...d,costOrder:d.skuOrders>0?cost/d.skuOrders:NaN,roi:d.actual>0&&Number.isFinite(d.sales)?d.sales/d.actual:NaN};}
function tikFormat(v,k){return fmt(v,k==='skuOrders'?0:2);}
function tikFunnel(d){
 d=tikMetrics(d);const prev=state.month>0?tikMetrics(reportMetrics(months[state.month-1],'TIKTOK GMVMAX'),state.month-1):null;
 const cards=tikDefs.map(([key,label,unit,color])=>{let delta=prev&&Number.isFinite(d[key])&&Number.isFinite(prev[key])&&prev[key]!==0?(d[key]-prev[key])/Math.abs(prev[key])*100:null;let good=delta!==null&&(key==='costOrder'?delta<0:['skuOrders','sales','roi'].includes(key)?delta>0:false);let tone=delta===null||delta===0||key==='actual'?'#687785':good?'#16805b':'#c53b48';return `<button class="tik-card" data-tik-metric="${key}" aria-pressed="${tikSelected.has(key)}"><span class="tik-label">${label}<span class="tik-check" aria-hidden="true">${tikSelected.has(key)?'✓':''}</span></span><strong>${tikFormat(d[key],key)}${unit?` <small>${unit}</small>`:''}</strong><span class="tik-comparison"><span>${state.month<0?'สะสมช่วงที่มีข้อมูล':'เทียบเดือนก่อน'}</span><b style="color:${tone}">${delta===null?'—':(delta>0?'↑ +':delta<0?'↓ ':'')+fmt(delta,2)+'%'}</b></span></button>`;}).join('');
 const plots=tikDefs.filter(([key])=>tikSelected.has(key)).map(([key,label,unit,color])=>{let series=months.map((m,i)=>({i,name:m.short,v:tikMetrics(reportMetrics(m,'TIKTOK GMVMAX'),i)[key]})),max=Math.max(1,...series.map(p=>Number.isFinite(p.v)?p.v:0))*1.15;let path='',gap=true;let x=i=>55+i*485/Math.max(1,series.length-1),y=v=>165-v/max*130;for(const p of series){if(!Number.isFinite(p.v)){gap=true;continue;}path+=(gap?'M':'L')+x(p.i)+','+y(p.v)+' ';gap=false;}return `<div class="tik-plot"><h3><i style="background:${color}"></i>${label} <small>${unit}</small></h3><svg viewBox="0 0 585 210" role="img" aria-label="แนวโน้ม ${label} รายเดือน">${[0,.5,1].map(t=>`<line x1="55" x2="540" y1="${y(t*max)}" y2="${y(t*max)}" stroke="var(--ih-line)"/><text x="48" y="${y(t*max)+4}" text-anchor="end" fill="var(--ih-muted)" font-size="10">${max>=1e6?fmt(t*max/1e6,1)+'M':max>=1000?fmt(t*max/1000,1)+'K':fmt(t*max,1)}</text>`).join('')}<path d="${path}" stroke="${color}" fill="none" stroke-width="2.5"/>${series.map(p=>`<text x="${x(p.i)}" y="193" text-anchor="middle" font-size="10" fill="var(--ih-muted)">${p.name}</text>${Number.isFinite(p.v)?`<circle cx="${x(p.i)}" cy="${y(p.v)}" r="${state.month===p.i?6:3.5}" fill="${color}"><title>${p.name} · ${label}: ${tikFormat(p.v,key)} ${unit}</title></circle>`:''}`).join('')}</svg></div>`;}).join('');
 return `<div class="tik-funnel"><div class="tik-cards" role="group" aria-label="เลือกสถิติ TikTok GMV Max">${cards}</div><p class="ih-sub">เลือกการ์ดเพื่อเปิด–ปิดกราฟ · แต่ละกราฟใช้หน่วยของตัวเอง</p><div class="tik-plots">${plots||'<div class="ih-sub">เลือกอย่างน้อยหนึ่งการ์ดเพื่อดูแนวโน้ม</div>'}</div></div>`;
}
root.addEventListener('click',e=>{let b=e.target.closest('[data-tik-metric]');if(!b)return;let k=b.dataset.tikMetric;tikSelected.has(k)?tikSelected.delete(k):tikSelected.add(k);b.closest('.tik-funnel').outerHTML=tikFunnel(missingMetrics(selected(),'TIKTOK GMVMAX'));root.querySelector(`[data-tik-metric="${k}"]`)?.focus();});


let lazSelected=new Set(['actual','sales']);
const lazDefs=[['actual','ค่าใช้จ่าย','THB','#3978ff'],['sales','ยอดขายรวม','THB','#16805b'],['orders','คำสั่งซื้อ','','#9e68ca'],['roi','ROAS','','#e58c32'],['impressions','การแสดงผล','','#5792c8'],['clicks','คลิก','','#df647e'],['unitsSold','สินค้าที่ขายได้','','#879347'],['ctr','อัตราการคลิกเข้าชม (CTR)','%','#2b9caa']];
function lazMetrics(d){return {...d,roi:d.actual>0&&Number.isFinite(d.sales)?d.sales/d.actual:NaN,ctr:d.impressions>0&&Number.isFinite(d.clicks)?d.clicks/d.impressions*100:NaN};}
function lazFormat(v,k){return fmt(v,['orders','unitsSold','impressions','clicks'].includes(k)?0:2);}
function lazFunnel(d){
 d=lazMetrics(d);const prev=state.month>0?lazMetrics(reportMetrics(months[state.month-1],'INAPP LAZ'),state.month-1):null;
 const cards=lazDefs.map(([key,label,unit,color])=>{let delta=prev&&Number.isFinite(d[key])&&Number.isFinite(prev[key])&&prev[key]!==0?(d[key]-prev[key])/Math.abs(prev[key])*100:null;let good=delta!==null&&(key==='costOrder'?delta<0:['orders','unitsSold','sales','roi','ctr'].includes(key)?delta>0:false);let tone=delta===null||delta===0||key==='actual'?'#687785':good?'#16805b':'#c53b48';return `<button class="laz-card" data-laz-metric="${key}" aria-pressed="${lazSelected.has(key)}"><span class="laz-label">${label}<span class="laz-check" aria-hidden="true">${lazSelected.has(key)?'✓':''}</span></span><strong>${lazFormat(d[key],key)}${unit?` <small>${unit}</small>`:''}</strong><span class="laz-comparison"><span>${state.month<0?'สะสมช่วงที่มีข้อมูล':'เทียบเดือนก่อน'}</span><b style="color:${tone}">${delta===null?'—':(delta>0?'↑ +':delta<0?'↓ ':'')+fmt(delta,2)+'%'}</b></span></button>`;}).join('');
 const plots=lazDefs.filter(([key])=>lazSelected.has(key)).map(([key,label,unit,color])=>{let series=months.map((m,i)=>({i,name:m.short,v:lazMetrics(reportMetrics(m,'INAPP LAZ'),i)[key]})),max=Math.max(1,...series.map(p=>Number.isFinite(p.v)?p.v:0))*1.15;let path='',gap=true;let x=i=>55+i*485/Math.max(1,series.length-1),y=v=>165-v/max*130;for(const p of series){if(!Number.isFinite(p.v)){gap=true;continue;}path+=(gap?'M':'L')+x(p.i)+','+y(p.v)+' ';gap=false;}return `<div class="laz-plot"><h3><i style="background:${color}"></i>${label} <small>${unit}</small></h3><svg viewBox="0 0 585 210" role="img" aria-label="แนวโน้ม ${label} รายเดือน">${[0,.5,1].map(t=>`<line x1="55" x2="540" y1="${y(t*max)}" y2="${y(t*max)}" stroke="var(--ih-line)"/><text x="48" y="${y(t*max)+4}" text-anchor="end" fill="var(--ih-muted)" font-size="10">${max>=1e6?fmt(t*max/1e6,1)+'M':max>=1000?fmt(t*max/1000,1)+'K':fmt(t*max,1)}</text>`).join('')}<path d="${path}" stroke="${color}" fill="none" stroke-width="2.5"/>${series.map(p=>`<text x="${x(p.i)}" y="193" text-anchor="middle" font-size="10" fill="var(--ih-muted)">${p.name}</text>${Number.isFinite(p.v)?`<circle cx="${x(p.i)}" cy="${y(p.v)}" r="${state.month===p.i?6:3.5}" fill="${color}"><title>${p.name} · ${label}: ${lazFormat(p.v,key)} ${unit}</title></circle>`:''}`).join('')}</svg></div>`;}).join('');
 return `<div class="laz-funnel"><div class="laz-cards" role="group" aria-label="เลือกสถิติ Lazada">${cards}</div><p class="ih-sub">เลือกการ์ดเพื่อเปิด–ปิดกราฟ · แต่ละกราฟใช้หน่วยของตัวเอง</p><div class="laz-plots">${plots||'<div class="ih-sub">เลือกอย่างน้อยหนึ่งการ์ดเพื่อดูแนวโน้ม</div>'}</div></div>`;
}
root.addEventListener('click',e=>{let b=e.target.closest('[data-laz-metric]');if(!b)return;let k=b.dataset.lazMetric;lazSelected.has(k)?lazSelected.delete(k):lazSelected.add(k);b.closest('.laz-funnel').outerHTML=lazFunnel(missingMetrics(selected(),'INAPP LAZ'));root.querySelector(`[data-laz-metric="${k}"]`)?.focus();});



let fbSelected=new Set(['impressions','inbox']);
const fbDefs=[['impressions','Impression','','#3978ff'],['reach','Reach','','#16805b'],['frequency','Frequency','','#9e68ca'],['cpm','CPM','THB','#e58c32'],['cpr','CPR','THB','#5792c8'],['likes','Like','','#df647e'],['comments','Comment','','#879347'],['shares','Share','','#2b9caa'],['inbox','Inbox','','#8e73c7'],['costInbox','Cost per inbox','THB','#5e8893']];
function fbMetrics(d){return {...d,reach:NaN,frequency:NaN,cpr:NaN,cpm:d.impressions>0?d.actual/d.impressions*1000:NaN,costInbox:d.inbox>0?d.actual/d.inbox:NaN};}
function fbFormat(v,k){return fmt(v,['impressions','reach','likes','comments','shares','inbox'].includes(k)?0:2);}
function fbFunnel(d){
 d=fbMetrics(d);const prev=state.month>0?fbMetrics(reportMetrics(months[state.month-1],'Facebook'),state.month-1):null;
 const cards=fbDefs.map(([key,label,unit,color])=>{let delta=prev&&Number.isFinite(d[key])&&Number.isFinite(prev[key])&&prev[key]!==0?(d[key]-prev[key])/Math.abs(prev[key])*100:null;let good=delta!==null&&(key==='costOrder'?delta<0:['orders','unitsSold','sales','roi','ctr'].includes(key)?delta>0:false);let tone=delta===null||delta===0||key==='actual'?'#687785':good?'#16805b':'#c53b48';return `<button class="fb-card" data-fb-metric="${key}" aria-pressed="${fbSelected.has(key)}"><span class="fb-label">${label}<span class="fb-check" aria-hidden="true">${fbSelected.has(key)?'✓':''}</span></span><strong>${fbFormat(d[key],key)}${unit?` <small>${unit}</small>`:''}</strong><span class="fb-comparison"><span>${state.month<0?'สะสมช่วงที่มีข้อมูล':'เทียบเดือนก่อน'}</span><b style="color:${tone}">${delta===null?'—':(delta>0?'↑ +':delta<0?'↓ ':'')+fmt(delta,2)+'%'}</b></span></button>`;}).join('');
 const plots=fbDefs.filter(([key])=>fbSelected.has(key)).map(([key,label,unit,color])=>{let series=months.map((m,i)=>({i,name:m.short,v:fbMetrics(reportMetrics(m,'Facebook'),i)[key]})),max=Math.max(1,...series.map(p=>Number.isFinite(p.v)?p.v:0))*1.15;let path='',gap=true;let x=i=>55+i*485/Math.max(1,series.length-1),y=v=>165-v/max*130;for(const p of series){if(!Number.isFinite(p.v)){gap=true;continue;}path+=(gap?'M':'L')+x(p.i)+','+y(p.v)+' ';gap=false;}return `<div class="fb-plot"><h3><i style="background:${color}"></i>${label} <small>${unit}</small></h3><svg viewBox="0 0 585 210" role="img" aria-label="แนวโน้ม ${label} รายเดือน">${[0,.5,1].map(t=>`<line x1="55" x2="540" y1="${y(t*max)}" y2="${y(t*max)}" stroke="var(--ih-line)"/><text x="48" y="${y(t*max)+4}" text-anchor="end" fill="var(--ih-muted)" font-size="10">${max>=1e6?fmt(t*max/1e6,1)+'M':max>=1000?fmt(t*max/1000,1)+'K':fmt(t*max,1)}</text>`).join('')}<path d="${path}" stroke="${color}" fill="none" stroke-width="2.5"/>${series.map(p=>`<text x="${x(p.i)}" y="193" text-anchor="middle" font-size="10" fill="var(--ih-muted)">${p.name}</text>${Number.isFinite(p.v)?`<circle cx="${x(p.i)}" cy="${y(p.v)}" r="${state.month===p.i?6:3.5}" fill="${color}"><title>${p.name} · ${label}: ${fbFormat(p.v,key)} ${unit}</title></circle>`:''}`).join('')}</svg></div>`;}).join('');
 return `<div class="fb-funnel"><div class="fb-cards" role="group" aria-label="เลือกสถิติ Facebook">${cards}</div><p class="ih-sub">เลือกการ์ดเพื่อเปิด–ปิดกราฟ · Like = การถูกใจเพจ · Inbox = การเริ่มสนทนาทางข้อความ</p><div class="fb-plots">${plots||'<div class="ih-sub">เลือกอย่างน้อยหนึ่งการ์ดเพื่อดูแนวโน้ม</div>'}</div><p class="ih-sub">Reach / Frequency รอข้อมูลแบบไม่นับคนซ้ำ · CPR รอแยกประเภทผลลัพธ์ของแคมเปญ</p></div>`;
}
root.addEventListener('click',e=>{let b=e.target.closest('[data-fb-metric]');if(!b)return;let k=b.dataset.fbMetric;fbSelected.has(k)?fbSelected.delete(k):fbSelected.add(k);b.closest('.fb-funnel').outerHTML=fbFunnel(missingMetrics(selected(),'Facebook'));root.querySelector(`[data-fb-metric="${k}"]`)?.focus();});




let trendMetric='impressions';
function funnelLine(d){
 if(state.page==='media'&&state.media==='Facebook')return fbFunnel(d);
 if(state.page==='media'&&state.media==='INAPP LAZ')return lazFunnel(d);
 if(state.page==='media'&&state.media==='TIKTOK GMVMAX')return tikFunnel(d);
 let metrics=[['impressions','Impressions'],['clicks','Clicks'],['sessions','Sessions'],['cart','Add to cart'],['checkout','Checkout'],['orders','Orders']];
 if(Number.isFinite(d.landingPageViews))metrics.push(['landingPageViews','Landing page views']);
 if(Number.isFinite(d.skuOrders))metrics.push(['skuOrders','SKU Orders · TikTok']);
 if(Number.isFinite(d.conversions))metrics.push(['conversions','Conversions · Google']);
 const isGoogle=state.page==='media'&&state.media==='Google';
 if(isGoogle){d=googleMetrics(d);metrics=[['impressions','Impression'],['clicks','Click'],['ctr','CTR'],['cpc','CPC'],['conversions','Conversion'],['convRate','Conv.rate'],['costPerConversion','Cost per conversion'],['actual','Cost']];}
 if(!metrics.some(x=>x[0]===trendMetric))trendMetric='impressions';
 const label=metrics.find(x=>x[0]===trendMetric)[1];
 const series=months.map((m,i)=>{const name=state.page==='media'&&state.media!=='all'?state.media:null;const row=name?m.rows.find(r=>r[0]===name):null;const rawData=reportMetrics(m,name);const data=isGoogle?googleMetrics(rawData,i):rawData;return {i,label:m.short,value:Number.isFinite(data?.[trendMetric])?data[trendMetric]:null};});
 const maximum=Math.max(1,...series.map(x=>x.value||0))*1.15;
 const compact=n=>isGoogle&&['ctr','convRate','cpc','costPerConversion'].includes(trendMetric)?googleMetricValue(n,trendMetric):n>=1e6?fmt(n/1e6,1)+'M':n>=1000?fmt(n/1000,1)+'K':fmt(n);
 const points=series.map(p=>({...p,x:52+p.i*(480/Math.max(1,months.length-1)),y:150-(p.value||0)/maximum*125}));
 let path='',gap=true;for(const p of points){if(p.value==null){gap=true;continue;}path+=(gap?'M':'L')+p.x+','+p.y+' ';gap=false;}
 return `<div class="ih-funnel-line ${isGoogle?'ih-google-funnel':''}"><div class="ih-sub">${label} · แนวโน้มรายเดือน ปี 2569 · รวมเท่าที่มีข้อมูล</div><svg viewBox="0 0 570 190" role="img" data-has-values="${series.some(p=>Number.isFinite(p.value))}" aria-label="แนวโน้ม ${label} รายเดือน" style="width:100%;height:auto;display:block">${[0,.5,1].map(t=>`<line x1="52" y1="${150-t*125}" x2="532" y2="${150-t*125}" stroke="var(--ih-line)"/><text x="43" y="${154-t*125}" text-anchor="end" fill="var(--ih-muted)" font-size="12">${compact(maximum*t)}</text>`).join('')}<path d="${path}" fill="none" stroke="var(--ih-green)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${points.map(p=>`<text x="${p.x}" y="177" text-anchor="middle" fill="var(--ih-muted)" font-size="12">${p.label}</text>${p.value==null?'':`<circle cx="${p.x}" cy="${p.y}" r="${state.month===p.i?6:4}" fill="${state.month===p.i?'var(--ih-blue)':'var(--ih-green)'}"/><text x="${p.x}" y="${p.y-12}" text-anchor="middle" fill="var(--ih-ink)" font-size="11">${compact(p.value)}</text><circle cx="${p.x}" cy="${p.y}" r="16" fill="transparent" data-tooltip="${p.label} · ${label}: ${isGoogle?googleMetricValue(p.value,trendMetric):fmt(p.value,trendMetric==='conversions'?2:0)}"/>`}`).join('')}</svg><div class="ih-funnel-labels" role="group" aria-label="เลือกสถิติที่แสดงในกราฟ">${metrics.map(([key,title])=>`<button type="button" class="ih-metric-button" data-trend-metric="${key}" aria-pressed="${trendMetric===key}"><span>${title}</span><strong>${isGoogle?googleMetricValue(d[key],key):fmt(d[key],key==='conversions'?2:0)}</strong></button>`).join('')}</div></div>`;
}
root.addEventListener('click',event=>{const target=event.target.closest('[data-trend-metric]');if(!target)return;trendMetric=target.dataset.trendMetric;const host=target.closest('.ih-funnel-line');const d=missingMetrics(selected(),state.page==='media'&&state.media!=='all'?state.media:null);if(d)host.outerHTML=funnelLine(d);cleanUnavailableCharts();root.querySelector(`[data-trend-metric="${trendMetric}"]`)?.focus();});

function restoreOverviewCharts(m){
 if(state.page!=='overview'&&!(state.page==='media'&&state.media==='all'))return;
 const maxSales=Math.max(1,...months.map(x=>Number.isFinite(x.sales)?x.sales:0))*1.12;
 const pts=months.map((x,i)=>({x:48+i*(432/Math.max(1,months.length-1)),y:158-x.sales/maxSales*130,m:x,i}));
 const trend=`<div class="ih-sub">ล้านบาท · ปี 2569</div><svg viewBox="0 0 520 205" style="width:100%;height:auto;display:block" role="img" aria-label="แนวโน้มยอดขายรายเดือน 2569">${[0,.5,1].map(t=>`<line x1="48" x2="480" y1="${158-t*130}" y2="${158-t*130}" stroke="var(--ih-line)"/><text x="40" y="${162-t*130}" text-anchor="end" fill="var(--ih-muted)" font-size="12">${fmt(maxSales*t/1e6,0)}</text>`).join('')}<polyline points="${pts.filter(p=>Number.isFinite(p.y)).map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="var(--ih-blue)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${pts.map(p=>!Number.isFinite(p.y)?`<text x="${p.x}" y="185" text-anchor="middle" fill="var(--ih-muted)" font-size="12">${p.m.short}</text>`:`<circle cx="${p.x}" cy="${p.y}" r="${state.month===p.i?6:4}" fill="${state.month===p.i?'var(--ih-green)':'var(--ih-blue)'}"/><text x="${p.x}" y="${p.y-12}" text-anchor="middle" fill="var(--ih-ink)" font-size="12">${fmt(p.m.sales/1e6,1)}</text><text x="${p.x}" y="185" text-anchor="middle" fill="var(--ih-muted)" font-size="12">${p.m.short}</text>`).join('')}</svg>`;
 const salesPanel=[...root.querySelectorAll('.ih-panel')].find(p=>p.querySelector('h2')?.textContent==='ยอดขายรายเดือน');
 if(salesPanel)salesPanel.innerHTML=`<div class="ih-panel-head"><h2>แนวโน้มยอดขาย</h2>${ready}</div>${trend}`;
 const series=state.month===-1?months:[m];
 const ceiling=Math.max(1,...series.flatMap(x=>[x.budget,x.actual]).filter(Number.isFinite))*1.05;
 const chart=`<div class="ih-budget-legend"><span><b style="background:#899bb1"></b>งบประมาณ</span><span><b style="background:var(--ih-blue)"></b>ใช้จริง</span><span>บาท · ทุกเดือนใช้สเกลเดียวกัน</span></div><div class="ih-budget-chart">${series.map(x=>{const diff=budgetComparable(x)?x.actual-x.budget:NaN;return `<div class="ih-budget-pair"><div class="ih-budget-month"><strong>${x.label}</strong><span class="ih-budget-diff ${diff>0?'over':''}">${!Number.isFinite(diff)?'ข้อมูลเทียบงบไม่ครบ':diff>0?'เกินงบ':'เหลืองบ'} ${fmt(Math.abs(diff))} บาท · ${fmt(Number.isFinite(diff)&&x.budget>0?x.actual/x.budget*100:NaN,1)}%</span></div><div class="ih-budget-track-row"><span>งบประมาณ</span><div class="ih-budget-track"><div style="width:${x.budget/ceiling*100}%;background:#899bb1"></div></div><strong>${fmt(x.budget)}</strong></div><div class="ih-budget-track-row"><span>ใช้จริง</span><div class="ih-budget-track"><div style="width:${x.actual/ceiling*100}%;background:var(--ih-blue)"></div></div><strong>${fmt(x.actual)}</strong></div></div>`;}).join('')}</div><div class="ih-water-row"><span>งบประมาณรวม / ใช้จริงรวม</span><strong>${fmt(m.budget)} / ${fmt(m.actual)} บาท</strong></div>`;
 if(salesPanel)salesPanel.parentElement.insertAdjacentHTML('afterend',`<div style="margin-bottom:16px">${panel('งบประมาณเทียบยอดใช้จริง',ready,chart)}</div>`);
}

function fillUnavailable(m){
restoreOverviewCharts(m);
 const d=missingMetrics(m,state.page==='media'&&state.media!=='all'?state.media:null);
 if(!d)return;
 const cards=[...root.querySelectorAll('.ih-kpi')];
 for(const card of cards){const label=card.querySelector('.ih-label').textContent;let value=null,detail='ยังไม่มีข้อมูล';
 if(label.includes('กำไรหลัง'))value=money(d.profit);
 if(label.includes('กำไรขั้นต้น'))value=money(d.gross);
 if(label==='ROAS คุ้มทุน')value=fmt(d.sales/d.contribution,1)+'<small>x</small>';
 if(label==='CAC ลูกค้าใหม่'){value=fmt(d.actual/d.newCustomers)+' <small>บาท</small>';detail='ยังไม่มีข้อมูล · ค่าโฆษณารวม ÷ ลูกค้าใหม่';}
 if(value!==null){card.querySelector('.ih-value').innerHTML=value;const detailNode=card.querySelector('.ih-wait,.ih-detail');detailNode.textContent=detail;if(label.includes('กำไร')&&d.profit>0)card.classList.add('ih-positive');}
 }
 root.querySelectorAll('.ih-panel').forEach(p=>{
 const title=p.querySelector('h2')?.textContent;
 if(title==='เทรนสถิติ'||title?.startsWith('Funnel ·'))p.innerHTML=`<div class="ih-panel-head"><h2>${title}</h2>${['impressions','clicks','sessions','cart','checkout','orders','skuOrders'].some(key=>Number.isFinite(d[key]))?ready:missingTag}</div>${funnelLine(d)}`;
 if(title==='ตัวขับเคลื่อน · Google')p.innerHTML=googleDrivers();
 if(title==='ตัวขับเคลื่อน · CPAS SHP'){
 const products=[['—','—',.50],['—','—',.30],['—','—-RTX-003',.20]];
 p.innerHTML=`<div class="ih-panel-head"><h2>${title}</h2>${missingTag}</div><div class="ih-sub">Campaign / Creative</div>${detailRows([['—', '—'],['—','—']])}<div class="ih-table-wrap" style="margin-top:14px"><table><thead><tr><th>หมวดหมู่สินค้า / Category</th><th>ยอดขาย (฿)</th></tr></thead><tbody>${products.map(([name,sku,share])=>`<tr><td>${name}</td><td>${fmt(NaN)}</td></tr>`).join('')}</tbody></table></div>${detailRows([['ลูกค้าใหม่ / ลูกค้าเดิม',fmt(d.newCustomers)+' / '+fmt(d.orders-d.newCustomers)],['CAC ',fmt(d.actual/d.newCustomers,2)+' บาท'],['ส่วนลด',fmt(d.discount)+' บาท'],['คืนเงิน',fmt(d.refund)+' บาท']])}`;
 }
 if(title==='ตัวขับเคลื่อน · CPAS SHP'){
 const rows=months.map((month,index)=>{const row=month.rows.find(r=>r[0]==='CPAS SHP');const sample=unavailableMetrics(row?.[3],row?.[2],index);return `<tr style="${state.month===index?'background:var(--ih-soft)':''}"><td>${month.short}</td><td>${fmt(row?.[2],2)}</td><td>${sample?fmt(sample.newCustomers):'—'}</td><td>${sample&&sample.newCustomers>0?fmt(sample.actual/sample.newCustomers,2):'—'}</td></tr>`;}).join('');
 p.insertAdjacentHTML('beforeend',`<div class="ih-panel-head" style="margin-top:22px"><h2>CAC รายเดือน</h2>${missingTag}</div><div class="ih-table-wrap"><table><thead><tr><th>เดือน</th><th>ค่าโฆษณา (฿)</th><th>ลูกค้าใหม่</th><th>CAC (฿/คน)</th></tr></thead><tbody>${rows}${shortMonths.slice(months.length).map(month=>`<tr><td>${month}</td><td>—</td><td>—</td><td>—</td></tr>`).join('')}</tbody></table></div>`);
 }
 if(title==='เปรียบเทียบช่องทาง')p.querySelectorAll('tbody tr').forEach(row=>{const name=row.querySelector('[data-media]')?.dataset.media,rd=missingMetrics(m,name);if(rd){row.cells[4].innerHTML=fmt(rd.profit,2)+'<small class="ih-best-label"></small>';if(rd.profit>0)row.cells[4].style.color='var(--ih-green)';}});
 });
}
function funnel(m){const d=missingMetrics(m);return panel('Funnel การซื้อ',missingTag,funnelRows(d)+`<div class="ih-metric-row">${[['CPM',fmt(d.actual/d.impressions*1000,2)+' ฿'],['CTR',fmt(d.clicks/d.impressions*100,2)+'%'],['CPC',fmt(d.actual/d.clicks,2)+' ฿'],['CVR',fmt(d.orders/d.sessions*100,2)+'%']].map(([l,v])=>`<div><span class="ih-sub">${l}</span><strong>${v}</strong></div>`).join('')}</div>`)+panel('ลูกค้า',missingTag,detailRows([['คำสั่งซื้อ',fmt(d.orders)],['ลูกค้าใหม่',fmt(d.newCustomers)],['ลูกค้าเดิม',fmt(d.orders-d.newCustomers)]]));}
function previousDrivers(m){const d=missingMetrics(m);const categories=[['—','—',.46],['—','—',.27],['—','—-RTX-003',.18],['—','—',.09]];return panel('หมวดหมู่สินค้า / Category',missingTag,`<div class="ih-table-wrap"><table><thead><tr><th>หมวด / SKU</th><th>ยอดขาย (฿)</th><th>กำไรหลังโฆษณา (฿)</th></tr></thead><tbody>${categories.map(([name,sku,share])=>`<tr><td>${name}</td><td>${fmt(NaN)}</td><td style="color:var(--ih-green)">${fmt(NaN)}</td></tr>`).join('')}</tbody></table></div>`)+`<div style="margin-top:16px">${panel('Campaign / Creative',missingTag,`<div class="ih-table-wrap"><table><thead><tr><th>Campaign / Creative</th><th>ค่าโฆษณา (฿)</th><th>ยอดขาย (฿)</th></tr></thead><tbody>${[['Performance PC / Video',.45],['— / Carousel',.35],['Gaming Gear / Review',.20]].map(([name,share])=>`<tr><td>${name}</td><td>${fmt(d.actual*share)}</td><td>${fmt(NaN)}</td></tr>`).join('')}</tbody></table></div>`)}</div>`;}
function profit(m){const d=missingMetrics(m);return `<div class="ih-kpis">${kpi('กำไรขั้นต้น',million(d.gross)+' <small>ล้านบาท</small>','ยังไม่มีข้อมูล')}${kpi('กำไรหลังโฆษณา',million(d.profit)+' <small>ล้านบาท</small>','ยังไม่มีข้อมูล',false,true)}${kpi('ROAS คุ้มทุน',fmt(d.sales/d.contribution,1)+'x','ยังไม่มีข้อมูล')}</div>${panel('โครงสร้างกำไร',missingTag,detailRows([['ยอดขายตามรายงาน',fmt(d.sales)],['ต้นทุนสินค้า',fmt(d.sales-d.gross)],['ส่วนลด',fmt(d.discount)],['คืนเงิน',fmt(d.refund)],['ค่าธรรมเนียม',fmt(d.fees)],['ค่าขนส่ง',fmt(d.shipping)],['ค่าโฆษณาตามรายงาน',fmt(d.actual)],['กำไรหลังโฆษณา',fmt(d.profit)]]))}<div style="margin-top:16px">${panel('ทดลองเพิ่มงบ',missingTag,`<div class="ih-controls"><label>อัตรากำไรส่วนเกิน <strong id="ih-margin-label"></strong><input id="ih-margin" type="range" min="1" max="30" value="${state.margin}" aria-label="อัตรากำไรส่วนเกินสมมติ"></label><label>เพิ่มงบ <strong id="ih-adjust-label"></strong><input id="ih-adjust" type="range" min="0" max="100" step="5" value="${state.adjust}" aria-label="เปอร์เซ็นต์เพิ่มงบสมมติ"></label></div><div id="ih-scenario"></div>`)}</div>`;}
function data(){return panel('แหล่งข้อมูล',missingTag,detailRows([['Budget / Actual / Sales / ROAS','ข้อมูลต้นฉบับ'],['Funnel / Orders / ลูกค้า','ยังไม่มีข้อมูล'],['ต้นทุน / กำไร / SKU / Campaign','ยังไม่มีข้อมูล'],['ช่วงข้อมูล','ม.ค.–ก.ย. 2569']])+`<p class="ih-sub">ยังไม่มีข้อมูลใช้ทดลองหน้าจอเท่านั้น</p>`);}

let customerGroup='all';
function customerSample(m){return {newCount:NaN,oldCount:NaN,newSales:NaN,oldSales:NaN,newProfit:NaN,oldProfit:NaN,d:unavailableMetrics(m.sales,m.actual)};}
function customerProfitTrend(list){
 const sets=[{key:'newProfit',name:'ลูกค้าใหม่',color:'#267abf'},{key:'oldProfit',name:'ลูกค้าเก่า',color:'#16805b'}].filter(s=>customerGroup==='all'||(customerGroup==='new'?s.key==='newProfit':s.key==='oldProfit'));
 const max=Math.max(1,...list.flatMap(x=>sets.map(s=>x[s.key])))*1.18;
 const points=s=>list.map((x,i)=>({x:60+i*(512/Math.max(1,months.length-1)),y:190-x[s.key]/max*150,value:x[s.key],i}));
 return `<div class="ih-profit-trend"><div class="ih-budget-legend">${sets.map(s=>`<span><b style="background:${s.color}"></b>${s.name}</span>`).join('')}<span>กำไรหลังโฆษณา · ล้านบาท</span></div><svg viewBox="0 0 630 240" style="width:100%;height:auto;display:block" role="img" aria-label="แนวโน้มกำไรหลังโฆษณารายเดือน แยกลูกค้าใหม่และเก่า ยังไม่มีข้อมูล">${[0,.25,.5,.75,1].map(t=>`<line x1="60" x2="572" y1="${190-t*150}" y2="${190-t*150}" stroke="var(--ih-line)" stroke-dasharray="3 5"/><text x="48" y="${194-t*150}" text-anchor="end" font-size="12" fill="var(--ih-muted)">${fmt(max*t/1e6,2)}</text>`).join('')}${state.month>=0?`<rect x="${44+state.month*(512/Math.max(1,months.length-1))}" y="26" width="32" height="172" rx="8" fill="var(--ih-soft)"/>`:''}${sets.map((s,j)=>{const ps=points(s);return `<polygon points="60,190 ${ps.map(p=>p.x+','+p.y).join(' ')} 572,190" fill="${s.color}" opacity=".035"/><polyline points="${ps.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${ps.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${state.month===p.i?6:4}" fill="var(--ih-panel)" stroke="${s.color}" stroke-width="2"/><circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" data-tooltip="${months[p.i].label} · ${s.name}: ${fmt(p.value)} บาท"/>`).join('')}`;}).join('')}${months.map((m,i)=>`<text x="${60+i*(512/Math.max(1,months.length-1))}" y="219" text-anchor="middle" fill="var(--ih-muted)" font-size="12">${m.short}</text>`).join('')}</svg></div>`;
}

function customerChange(value,before){if(!Number.isFinite(value)||!Number.isFinite(before))return '—';if(before===0)return value===0?'0.0%':'—';const change=(value-before)/Math.abs(before)*100;return `<span style="color:${change>=0?'var(--ih-green)':'var(--ih-red)'}">${change>0?'+':''}${fmt(change,1)}%</span>`;}
function drivers(m){
 const list=months.map(customerSample),chosen=state.month<0?list:[list[state.month]];
 const aggregate=chosen.reduce((a,x)=>{for(const k of ['newCount','oldCount','newSales','oldSales','newProfit','oldProfit'])a[k]=(k in a?a[k]:0)+x[k];return a;},{});
 const groupLabel=customerGroup==='new'?'ลูกค้าใหม่':customerGroup==='old'?'ลูกค้าเก่า':'ลูกค้าทั้งหมด';
 const count=x=>customerGroup==='new'?x.newCount:customerGroup==='old'?x.oldCount:x.newCount+x.oldCount;
 const revenue=x=>customerGroup==='new'?x.newSales:customerGroup==='old'?x.oldSales:x.newSales+x.oldSales;
 const profit=x=>customerGroup==='new'?x.newProfit:customerGroup==='old'?x.oldProfit:x.newProfit+x.oldProfit;
 const selectedSales=revenue(aggregate),selectedProfit=profit(aggregate),selectedCount=count(aggregate);
 const metric=(label,value)=>`<div class="ih-kpi"><div class="ih-label">${label}</div><div class="ih-value">${value}</div><div class="ih-detail">ยังไม่มีข้อมูล</div></div>`;
 const filters=`<div class="ih-customer-filters" role="group" aria-label="กลุ่มลูกค้า">${[['all','ทั้งหมด'],['new','ลูกค้าใหม่'],['old','ลูกค้าเก่า']].map(([key,label])=>`<button type="button" data-customer-group="${key}" aria-pressed="${customerGroup===key}">${label}</button>`).join('')}</div>`;
 const previous=state.month>0?list[state.month-1]:null;
 const summary=`<div class="ih-kpis">${metric(groupLabel,fmt(selectedCount)+' <small>คน</small>')}${metric('ยอดขาย · '+groupLabel,million(selectedSales)+' <small>ล้านบาท</small>')}${metric('กำไรหลังโฆษณา · '+groupLabel,million(selectedProfit)+' <small>ล้านบาท</small>')}</div>${state.month>=0?`<div class="ih-sub" style="margin-bottom:16px">จำนวนลูกค้าเทียบเดือนก่อน ${customerChange(selectedCount,previous?count(previous):null)}</div>`:''}`;
 const rows=list.map((x,i)=>{const prev=list[i-1];return `<tr style="${state.month===i?'background:var(--ih-soft)':''}"><td><button class="ih-micro-link" data-month="${i}">${months[i].short}</button></td>${customerGroup!=='old'?`<td>${fmt(x.newCount)}</td><td>${customerChange(x.newCount,prev?.newCount)}</td>`:''}${customerGroup!=='new'?`<td>${fmt(x.oldCount)}</td><td>${customerChange(x.oldCount,prev?.oldCount)}</td>`:''}${customerGroup==='all'?`<td>${fmt(x.newProfit)}</td><td>${fmt(x.oldProfit)}</td>`:`<td>${fmt(profit(x))}</td>`}</tr>`;}).join('');
 const table=panel('ลูกค้าเพิ่ม–ลดรายเดือน',missingTag,`<div class="ih-table-wrap"><table><thead><tr><th>เดือน</th>${customerGroup!=='old'?'<th>ลูกค้าใหม่</th><th>เทียบเดือนก่อน</th>':''}${customerGroup!=='new'?'<th>ลูกค้าเก่า</th><th>เทียบเดือนก่อน</th>':''}${customerGroup==='all'?'<th>กำไรลูกค้าใหม่ (฿)</th><th>กำไรลูกค้าเก่า (฿)</th>':`<th>กำไร · ${groupLabel} (฿)</th>`}</tr></thead><tbody>${rows}</tbody></table></div>`);
 const breakdown=panel('กำไรมาจากลูกค้ากลุ่มไหน',missingTag,customerProfitTrend(list)+`<div class="ih-customer-profit">${[['new','ลูกค้าใหม่',aggregate.newProfit],['old','ลูกค้าเก่า',aggregate.oldProfit]].filter(([key])=>customerGroup==='all'||customerGroup===key).map(([key,label,value])=>`<button type="button" data-customer-group="${key}" class="ih-profit-choice"><span>${label}</span><strong>${million(value)} ล้านบาท</strong><span>${fmt(value/(aggregate.newProfit+aggregate.oldProfit)*100,1)}% ของกำไรรวม</span></button>`).join('')}</div>`);
 const products=panel('หมวดหมู่สินค้า · '+groupLabel,missingTag,`<div class="ih-table-wrap"><table><thead><tr><th>หมวดหมู่สินค้า / Category</th><th>ยอดขาย (฿)</th><th>กำไรหลังโฆษณา (฿)</th></tr></thead><tbody>${[['—','—',customerGroup==='old'?.35:.50],['—','—',.30],['—','—-ACC-003',customerGroup==='old'?.35:.20]].map(([name,sku,share])=>`<tr><td>${name}</td><td>${fmt(selectedSales*share)}</td><td>${fmt(selectedProfit*share)}</td></tr>`).join('')}</tbody></table></div>`);
 const campaigns=panel('โฆษณา · '+groupLabel,missingTag,`<div class="ih-table-wrap"><table><thead><tr><th>Campaign / Creative</th><th>ยอดขาย (฿)</th><th>กำไร (฿)</th></tr></thead><tbody>${[['Gaming / Video',.55],['Upgrade / Carousel',.30],['— / Review',.15]].map(([name,share])=>`<tr><td>${name}</td><td>${fmt(selectedSales*share)}</td><td>${fmt(selectedProfit*share)}</td></tr>`).join('')}</tbody></table></div>`);
 const filtered=customerGroup==='all'?missingMetrics(m):unavailableMetrics(NaN,NaN);
 const funnelTag=['impressions','clicks','sessions','cart','checkout','orders'].some(k=>Number.isFinite(filtered[k]))?ready:missingTag;
 return filters+summary+breakdown+`<div style="margin-top:16px">${table}</div><div style="margin-top:16px">${panel('Funnel · '+groupLabel,funnelTag,funnelRows(filtered))}</div><div style="margin-top:16px">${products}</div>`;
}
root.addEventListener('click',e=>{const b=e.target.closest('[data-customer-group]');if(!b)return;customerGroup=customerGroup===b.dataset.customerGroup?'all':b.dataset.customerGroup;render();});

function mediaPlan(){return `<div class="ih-panel"><div class="ih-panel-head"><h2>2026_Facebook ADs budget</h2><a href="https://docs.google.com/spreadsheets/d/1Cm-YarpD_jlW3WudYpqnZ3aplFyW-AYXeOVg35UdaYM/edit?gid=1295215853#gid=1295215853" target="_blank" rel="noopener noreferrer" class="ih-micro-link">เปิด Google Sheet ↗</a></div><iframe title="Media Plan Google Sheet" src="https://docs.google.com/spreadsheets/d/1Cm-YarpD_jlW3WudYpqnZ3aplFyW-AYXeOVg35UdaYM/edit?embedded=true&gid=1295215853#gid=1295215853" style="width:100%;height:780px;border:1px solid var(--ih-line);background:white" loading="lazy"></iframe></div>`;}


function cleanUnavailableCharts(){
 root.querySelectorAll('.ih-funnel-line svg,.ih-profit-trend svg').forEach(svg=>{
  if(svg.dataset.hasValues==='true')return;
  svg.querySelectorAll('path,polyline,polygon,circle,rect').forEach(el=>el.remove());
  svg.querySelectorAll('line').forEach(el=>{if([...el.attributes].some(a=>a.value.includes('NaN')))el.remove();});
  svg.querySelectorAll('text').forEach(el=>{if([...el.attributes].some(a=>a.value.includes('NaN'))||el.textContent==='—')el.remove();});
  const note=document.createElementNS('http://www.w3.org/2000/svg','text');note.setAttribute('x','50%');note.setAttribute('y','45%');note.setAttribute('text-anchor','middle');note.setAttribute('fill','var(--ih-muted)');note.setAttribute('font-size','13');note.textContent='ยังไม่มีข้อมูล';svg.appendChild(note);
 });
 root.querySelectorAll('[style*="NaN"]').forEach(el=>{el.style.width='0%';});
}

function render(){setReportSource();if(state.page==='data'||state.page==='profit')state.page='overview';if(state.page==='funnel')state.page='drivers';q('.ih-filter-group').hidden=state.page==='mediaPlan';q('#ih-period-caption').hidden=state.page==='mediaPlan';const m=selected();q('#ih-title').textContent=state.page==='overview'?(state.month===-1?'ภาพรวมปี 2569':months[state.month].label+' 2569'):titles[state.page][0];q('#ih-subtitle').textContent=state.page==='media'&&state.media!=='all'?(platformPayload.accounts.find(a=>a.name===state.media)?platformPayload.accounts.find(a=>a.name===state.media).source+' · ถึง '+platformPayload.accounts.find(a=>a.name===state.media).through:months.some(m=>m.metrics?.[state.media])?'Meta API · ถึง '+metaPayload.through:'Cloudflare · รอเชื่อม API แพลตฟอร์ม'):titles[state.page][1];q('#ih-crumb').textContent=pageNames[state.page];q('#ih-month').value=String(state.month);q('#ih-period-caption').textContent=state.month===-1?'ม.ค.–'+months[months.length-1].short+' 2569':months[state.month].label+' 2569';root.querySelectorAll('[data-page]').forEach(b=>{if(b.dataset.page===state.page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});q('#ih-screen').innerHTML=({overview,media,funnel,drivers,mediaPlan})[state.page](m);if(state.page==='media')q('#ih-media').onchange=e=>{state.media=e.target.value;render();save();};if(state.page==='profit'){scenario();q('#ih-margin').oninput=e=>{state.margin=+e.target.value;scenario();};q('#ih-adjust').oninput=e=>{state.adjust=+e.target.value;scenario();};q('#ih-margin').onchange=save;q('#ih-adjust').onchange=save;}root.querySelectorAll('.ih-panel,.ih-kpi').forEach(el=>el.style.borderRadius=design.radius+'px');if(state.page!=='drivers'&&state.page!=='mediaPlan'){fillUnavailable(m);enhanceMetrics(m);}cleanUnavailableCharts();if(globalThis.lucide)lucide.createIcons();}
root.addEventListener('click',e=>{const periodButton=e.target.closest('[data-period]');if(periodButton){state.month=+periodButton.dataset.period;render();save();return;}const mediaButton=e.target.closest('[data-media]');if(mediaButton){state.media=mediaButton.dataset.media;state.page='media';render();save();return;}const monthButton=e.target.closest('[data-month]');if(monthButton){state.month=state.month===Number(monthButton.dataset.month)?-1:Number(monthButton.dataset.month);render();save();return;}const b=e.target.closest('[data-page],[data-go]');if(!b)return;state.page=b.dataset.page||b.dataset.go;if(state.page==='media')state.media='all';render();save();});q('#ih-year').onchange=()=>{state.month=-1;render();save();};q('#ih-month').onchange=e=>{state.month=Number(e.target.value);render();save();};
function restore(saved){const s=saved?.privateContent;if(!s||s.version!==5)return;if(pageNames[s.page])state.page=s.page;if(s.media==='all'||months[0].rows.some(r=>r[0]===s.media))state.media=s.media;if(Number.isInteger(s.month)&&s.month>=-1&&s.month<9)state.month=s.month;if(s.margin>=1&&s.margin<=30)state.margin=s.margin;if(s.adjust>=0&&s.adjust<=100)state.adjust=s.adjust;}
render();window.addEventListener('openai:set_globals',e=>{restore(e.detail?.globals?.widgetState);render();});
if(globalThis.Tweak){const tweak=new Tweak({container:root,onChange:render});tweak.addSlider(design,'radius',{label:'ความโค้งของการ์ด',min:0,max:20,unit:'px'});}
}catch(error){console.error(error);root.querySelector('#ih-screen').innerHTML='<div class="ih-panel" role="alert">โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้า</div>';}
})();
