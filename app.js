(async()=>{
const root=document.getElementById('ih-preview');
root.querySelector('#ih-screen').textContent='กำลังโหลดข้อมูลจาก Cloudflare…';
try {
const response=await fetch('/api/report',{cache:'no-store'});
if(!response.ok)throw new Error('Report HTTP '+response.status);
const payload=await response.json();
if(!Array.isArray(payload.months)||!payload.months.length)throw new Error('Empty report');
const months=payload.months;

const pageNames={mediaPlan:"Media Plan",media:'ประสิทธิภาพราย Media',overview:'ภาพรวมผู้บริหาร',funnel:'Funnel ลูกค้า',drivers:'ลูกค้า สินค้าและโฆษณา'};
const state={page:'overview',media:'all',month:-1,margin:10,adjust:20};
const annual={label:'ภาพรวมปี',budget:0,actual:0,sales:0,rows:[]};
for(const m of months){annual.budget+=m.budget;annual.actual+=m.actual;annual.sales+=m.sales;}
for(const name of [...new Set(months.flatMap(m=>m.rows.map(r=>r[0])))]){
 const source=months.map(m=>m.rows.find(r=>r[0]===name));
 const sums=[1,2,3].map(col=>source.every(r=>r[col]!=null)?source.reduce((s,r)=>s+r[col],0):null);
 annual.rows.push([name,...sums,sums[1]>0&&sums[2]!=null?sums[2]/sums[1]:null]);
}
const selected=()=>state.month===-1?annual:months[state.month];
const design={radius:2};
const q=s=>root.querySelector(s);
const fmt=(n,d=0)=>n==null?'—':n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const million=n=>fmt(n/1e6,2);
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
const table=`<div class="ih-table-wrap"><table><thead><tr><th>ช่องทาง</th><th>ใช้จริง (฿)</th><th>ยอดขาย (฿)</th><th>ROAS</th><th>กำไรหลังโฆษณา</th></tr></thead><tbody>${sorted.map(r=>`<tr><td class="ih-platform"><button class="ih-micro-link" data-media="${r[0]}">${r[0]} ↗</button></td><td>${fmt(r[2],2)}</td><td>${fmt(r[3],2)}</td><td>${r[4]==null?'—':fmt(r[4],state.month===-1?1:0)+'x'}</td><td class="ih-faint">รอข้อมูลต้นทุน</td></tr>`).join('')}</tbody></table></div>`;
return `<div class="ih-kpis">${kpi('กำไรหลังหักค่าโฆษณา','—','ต้องมีต้นทุน ส่วนลด และค่าธรรมเนียม',true,true)}${kpi('ยอดขายที่รายงาน',million(m.sales)+' <small>ล้านบาท</small>',change===null?(state.month===-1?'ยอดสะสม ม.ค.–ก.ย. ไม่ใช่ยอดครบปี':'ยอดขายตามรายงานต้นฉบับ'):(change>=0?'+':'')+fmt(change,1)+'% เทียบเดือนก่อน')}${kpi('ค่าโฆษณาจริง',state.month===-1?million(m.actual)+' <small>ล้านบาท</small>':fmt(m.actual/1000,1)+' <small>พันบาท</small>',fmt(m.actual/m.budget*100,1)+'% ของงบ '+fmt(m.budget)+' บาท')}${kpi('ROAS รวม',fmt(m.sales/m.actual,1)+'<small>x</small>','ยอดขายที่รายงาน ÷ ค่าโฆษณาจริง')}${kpi('ROAS คุ้มทุน','—','ต้องมีอัตรากำไรส่วนเกินก่อนค่าโฆษณา',true)}${kpi('CAC ลูกค้าใหม่','—','ต้องแยกลูกค้าใหม่และค่าใช้จ่ายที่เกี่ยวข้อง',true)}</div><div class="ih-grid">${panel('ยอดขายรายเดือน',ready,`<div class="ih-sub">ล้านบาท · ปี 2569 · กดแท่งเพื่อดูรายเดือน</div><div class="ih-trend" role="group" aria-label="ยอดขายรายเดือน ปี 2569">${months.map((x,i)=>`<button type="button" data-month="${i}" style="border:0;padding:0;background:transparent;color:var(--ih-muted)" class="ih-bar-col ${state.month===-1||i===state.month?'selected':''}"><span class="ih-chart-value">${fmt(x.sales/1e6,1)}</span><div class="ih-bar" style="height:${x.sales/Math.max(...months.map(d=>d.sales))*88}px"></div><span>${x.short}</span></button>`).join('')}${['ต.ค.','พ.ย.','ธ.ค.'].map(label=>`<div class="ih-bar-col"><span>—</span><div style="height:20px;width:70%;background:var(--ih-line);opacity:.35;border-radius:4px"></div><span>${label}</span></div>`).join('')}</div>`)}${panel('เทรนสถิติ',wait,`<div class="ih-sub">ยังไม่มีจำนวนในแต่ละขั้น</div>${['Impressions','Clicks / Sessions','Add to cart','Checkout','Orders'].map(n=>`<div class="ih-step"><span>${n}</span><div></div><span>—</span></div>`).join('')}${button('funnel','ดู Funnel และตัวชี้วัด')}`)}</div>${panel('เปรียบเทียบช่องทาง',`<span class="ih-tag">เรียงตามยอดขาย</span>`,table)}`;
}
function media(m){
 if(state.media==='all')return `<div class="ih-panel" style="margin-bottom:14px"><div class="ih-panel-head" style="margin-bottom:0"><label for="ih-media">Media / ช่องทางโฆษณา</label><select id="ih-media"><option value="all" selected>รวมทุก Media</option>${months[0].rows.map(row=>`<option>${row[0]}</option>`).join('')}</select></div></div>`+overview(m);

 const r=m.rows.find(row=>row[0]===state.media), series=months.map((month,i)=>({month,i,row:month.rows.find(row=>row[0]===state.media)}));
 const available=series.filter(x=>x.row[3]!=null).length;
 const costMonths=series.filter(x=>x.row[2]!=null).length;
 const ratio=r[2]>0&&r[3]!=null?r[3]/r[2]:null;
 const variance=r[2]==null?null:r[2]-r[1];
 const options='<option value="all">รวมทุก Media</option>'+months[0].rows.map(row=>`<option ${row[0]===state.media?'selected':''}>${row[0]}</option>`).join('');
 const chart=(col,label,unit,scale)=>{
 const max=Math.max(...series.map(x=>x.row[col]||0),1);
 return panel(label,`<span class="ih-tag">${unit}</span>`,`<div class="ih-trend" style="height:155px" role="group" aria-label="${label} รายเดือน">${series.map(x=>`<button type="button" class="ih-bar-col ${state.month===-1||state.month===x.i?'selected':''}" data-month="${x.i}" style="border:0;padding:0;background:transparent;color:var(--ih-muted)" aria-label="${x.month.label}: ${fmt(x.row[col],2)} บาท"><span class="ih-chart-value">${x.row[col]==null?'—':fmt(x.row[col]/scale,1)}</span><div class="ih-bar" style="height:${x.row[col]==null?0:(x.row[col]/max)*100}px;min-height:${x.row[col]>0?2:0}px"></div><span>${x.month.short}</span></button>`).join('')}${['ต.ค.','พ.ย.','ธ.ค.'].map(t=>`<div class="ih-bar-col"><span>—</span><span>${t}</span></div>`).join('')}</div>`);
 };
 return `<div class="ih-panel" style="margin-bottom:14px"><div class="ih-panel-head" style="margin-bottom:0"><label for="ih-media">Media / ช่องทางโฆษณา</label><select id="ih-media">${options}</select></div><div class="ih-badge-line"><span class="ih-tag ready">${state.month===-1?'สะสม ม.ค.–ก.ย. 2569':m.label+' 2569'}</span></div></div><div class="ih-kpis">${kpi('ยอดขาย · '+state.media,r[3]==null?'—':million(r[3])+' <small>ล้านบาท</small>',r[3]==null?'ข้อมูลยอดขายไม่ครบช่วงที่เลือก':'ยอดขายตามรายงานช่องทางนี้',r[3]==null,true)}${kpi('ค่าโฆษณาจริง',r[2]==null?'—':fmt(r[2]/1000,1)+' <small>พันบาท</small>','งบประมาณ '+fmt(r[1])+' บาท',r[2]==null)}${kpi('ROAS จากยอดขาย / ใช้จริง',ratio==null?'—':fmt(ratio,1)+'<small>x</small>','คำนวณจากยอดรวมในช่วงที่เลือก',ratio==null)}${kpi('ผลต่างจากงบ',variance==null?'—':(variance>0?'+':'')+fmt(variance/1000,1)+' <small>พันบาท</small>',r[2]==null?'ค่าใช้จ่ายยังไม่ครบ':r[1]>0?'ใช้แล้ว '+fmt(r[2]/r[1]*100,1)+'% ของงบ':'ไม่มีงบตั้งไว้',r[2]==null)}${kpi('สัดส่วนค่าโฆษณารวม',r[2]==null?'—':fmt(r[2]/m.actual*100,1)+'<small>%</small>','เทียบทุก Media ในช่วงเดียวกัน',r[2]==null)}${kpi('กำไรหลังโฆษณา','—','รอต้นทุนของ '+state.media,true)}</div><div class="ih-grid">${chart(3,'แนวโน้มยอดขาย','ล้านบาท',1e6)}${chart(2,'แนวโน้มค่าโฆษณา','พันบาท',1000)}</div>${panel('ประสิทธิภาพรายเดือน · '+state.media,`<span class="ih-tag">กดเดือนเพื่อเจาะรายละเอียด</span>`,`<div class="ih-table-wrap"><table><thead><tr><th>เดือน</th><th>Budget (฿)</th><th>Actual (฿)</th><th>ผลต่างงบ (฿)</th><th>Sales (฿)</th><th>ROAS คำนวณ</th></tr></thead><tbody>${series.map(x=>{const a=x.row,roas=a[2]>0&&a[3]!=null?a[3]/a[2]:null;return `<tr style="${state.month===x.i?'background:var(--ih-soft)':''}"><td><button class="ih-micro-link" data-month="${x.i}">${x.month.label}</button></td><td>${fmt(a[1])}</td><td>${fmt(a[2],2)}</td><td>${a[2]==null?'—':fmt(a[2]-a[1],2)}</td><td>${fmt(a[3],2)}</td><td>${roas==null?'—':fmt(roas,1)+'x'}</td></tr>`}).join('')}</tbody></table></div><p class="ih-sub">ROAS หน้านี้คำนวณจาก Sales ÷ Actual จึงอาจต่างจากค่า ROAS ที่ปัดเศษในต้นฉบับ • ต.ค.–ธ.ค. ยังไม่มีข้อมูล</p>`)}<div class="ih-grid" style="margin-top:14px">${panel('Funnel · '+state.media,wait,`<div class="ih-water-row"><span>Clicks / Sessions / Orders</span><strong>— / — / —</strong></div><div class="ih-water-row"><span>CTR / CPC / CVR</span><strong>— / — / —</strong></div>`)}${panel('ตัวขับเคลื่อน · '+state.media,wait,fields(['Campaign / Creative','Category','ลูกค้าใหม่ / CAC','ส่วนลด / คืนสินค้า'])+``)}</div>`;
}

function enhanceMetrics(m){
 const cards=[...root.querySelectorAll('.ih-kpi')];
 const previous=state.month>0?months[state.month-1]:null;
 const metricFor=(month,index,label)=>{
  if(!month)return null;
  const name=state.page==='media'&&state.media!=='all'?state.media:null;
  const row=name?month.rows.find(r=>r[0]===name):null;
  const sales=name?row?.[3]:month.sales,actual=name?row?.[2]:month.actual,budget=name?row?.[1]:month.budget;
  const d=null;
  if(label.includes('กำไรหลัง'))return d?.profit??null;
  if(label.includes('กำไรขั้นต้น'))return d?.gross??null;
  if(label.includes('คุ้มทุน'))return d&&d.contribution>0?d.sales/d.contribution:null;
  if(label.includes('CAC'))return d&&d.newCustomers>0?actual/d.newCustomers:null;
  if(label.includes('ROAS'))return actual>0&&sales!=null?sales/actual:null;
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
  else if(now==null||before==null)tag.textContent='— ข้อมูลเปรียบเทียบไม่ครบ';
  else if(before===0&&now!==0)tag.textContent='— เดือนก่อนเป็น 0';
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
 cards.forEach(card=>{
  const el=card.querySelector('.ih-value'),node=el?.firstChild;
  if(!node||node.nodeType!==3)return;
  const original=node.textContent,match=original.match(/^(\s*)([\d,]+(?:\.\d+)?)(.*)$/);
  if(!match)return;const target=Number(match[2].replace(/,/g,'')),digits=(match[2].split('.')[1]||'').length,start=performance.now();
  function tick(time){if(!el.isConnected)return;const t=Math.min(1,(time-start)/850);node.textContent=t===1?original:match[1]+(target*(1-Math.pow(1-t,3))).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits})+match[3];if(t<1)requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
 });
}

function restoreOverviewCharts(m){
 if(state.page!=='overview'&&!(state.page==='media'&&state.media==='all'))return;
 const maxSales=Math.max(...months.map(x=>x.sales))*1.12;
 const pts=months.map((x,i)=>({x:48+i*54,y:158-x.sales/maxSales*130,m:x,i}));
 const trend=`<div class="ih-sub">ล้านบาท · ปี 2569</div><svg viewBox="0 0 520 205" style="width:100%;height:auto;display:block" role="img" aria-label="แนวโน้มยอดขาย มกราคมถึงกันยายน 2569">${[0,.5,1].map(t=>`<line x1="48" x2="480" y1="${158-t*130}" y2="${158-t*130}" stroke="var(--ih-line)"/><text x="40" y="${162-t*130}" text-anchor="end" fill="var(--ih-muted)" font-size="12">${fmt(maxSales*t/1e6,0)}</text>`).join('')}<polyline points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="var(--ih-blue)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${state.month===p.i?6:4}" fill="${state.month===p.i?'var(--ih-green)':'var(--ih-blue)'}"/><text x="${p.x}" y="${p.y-12}" text-anchor="middle" fill="var(--ih-ink)" font-size="12">${fmt(p.m.sales/1e6,1)}</text><text x="${p.x}" y="185" text-anchor="middle" fill="var(--ih-muted)" font-size="12">${p.m.short}</text>`).join('')}</svg>`;
 const salesPanel=[...root.querySelectorAll('.ih-panel')].find(p=>p.querySelector('h2')?.textContent==='ยอดขายรายเดือน');
 if(salesPanel)salesPanel.innerHTML=`<div class="ih-panel-head"><h2>แนวโน้มยอดขาย</h2>${ready}</div>${trend}`;
 const series=state.month===-1?months:[m];
 const ceiling=Math.max(...series.map(x=>Math.max(x.budget,x.actual)))*1.05;
 const chart=`<div class="ih-budget-legend"><span><b style="background:#899bb1"></b>งบประมาณ</span><span><b style="background:var(--ih-blue)"></b>ใช้จริง</span><span>บาท · ทุกเดือนใช้สเกลเดียวกัน</span></div><div class="ih-budget-chart">${series.map(x=>{const diff=x.actual-x.budget;return `<div class="ih-budget-pair"><div class="ih-budget-month"><strong>${x.label}</strong><span class="ih-budget-diff ${diff>0?'over':''}">${diff>0?'เกินงบ':'เหลืองบ'} ${fmt(Math.abs(diff))} บาท · ${fmt(x.actual/x.budget*100,1)}%</span></div><div class="ih-budget-track-row"><span>งบประมาณ</span><div class="ih-budget-track"><div style="width:${x.budget/ceiling*100}%;background:#899bb1"></div></div><strong>${fmt(x.budget)}</strong></div><div class="ih-budget-track-row"><span>ใช้จริง</span><div class="ih-budget-track"><div style="width:${x.actual/ceiling*100}%;background:var(--ih-blue)"></div></div><strong>${fmt(x.actual)}</strong></div></div>`;}).join('')}</div><div class="ih-water-row"><span>งบประมาณรวม / ใช้จริงรวม</span><strong>${fmt(m.budget)} / ${fmt(m.actual)} บาท</strong></div>`;
 if(salesPanel)salesPanel.parentElement.insertAdjacentHTML('afterend',`<div style="margin-bottom:16px">${panel('งบประมาณเทียบยอดใช้จริง',ready,chart)}</div>`);
}


let customerGroup='all';
function drivers(){return `<div class="ih-customer-filters" role="group" aria-label="กลุ่มลูกค้า">${[['all','ทั้งหมด'],['new','ลูกค้าใหม่'],['old','ลูกค้าเก่า']].map(([key,label])=>`<button type="button" data-customer-group="${key}" aria-pressed="${customerGroup===key}">${label}</button>`).join('')}</div><div class="ih-kpis">${kpi('จำนวนลูกค้า','—','ยังไม่มีข้อมูลลูกค้า')}${kpi('ยอดขายแยกกลุ่มลูกค้า','—','ยังไม่มีข้อมูลแยกกลุ่ม')}${kpi('กำไรแยกกลุ่มลูกค้า','—','ยังไม่มีข้อมูลต้นทุน')}</div>${panel('กำไรมาจากลูกค้ากลุ่มไหน',wait,'<div class="ih-empty">ยังไม่มีข้อมูลกำไรแยกลูกค้าใหม่และลูกค้าเก่า</div>')}<div style="margin-top:16px">${panel('ลูกค้าเพิ่ม–ลดรายเดือน',wait,'<div class="ih-empty">ยังไม่มีข้อมูลลูกค้ารายเดือน</div>')}</div><div style="margin-top:16px">${panel('หมวดหมู่สินค้า / Category',wait,'<div class="ih-empty">ยังไม่มีข้อมูลยอดขายและกำไรระดับ Category</div>')}</div>`;}
root.addEventListener('click',e=>{const b=e.target.closest('[data-customer-group]');if(!b)return;customerGroup=customerGroup===b.dataset.customerGroup?'all':b.dataset.customerGroup;render();});
function save(){}
function mediaPlan(){return `<div class="ih-panel"><div class="ih-panel-head"><h2>2026_Facebook ADs budget</h2><a href="https://docs.google.com/spreadsheets/d/1Cm-YarpD_jlW3WudYpqnZ3aplFyW-AYXeOVg35UdaYM/edit?gid=1295215853#gid=1295215853" target="_blank" rel="noopener noreferrer" class="ih-micro-link">เปิด Google Sheet ↗</a></div><iframe title="Media Plan Google Sheet" src="https://docs.google.com/spreadsheets/d/1Cm-YarpD_jlW3WudYpqnZ3aplFyW-AYXeOVg35UdaYM/edit?embedded=true&gid=1295215853#gid=1295215853" style="width:100%;height:780px;border:1px solid var(--ih-line);background:white" loading="lazy"></iframe></div>`;}

function render(){if(state.page==='data'||state.page==='profit')state.page='overview';if(state.page==='funnel')state.page='drivers';q('.ih-filter-group').hidden=state.page==='mediaPlan';q('#ih-period-caption').hidden=state.page==='mediaPlan';const m=selected();q('#ih-title').textContent=state.page==='overview'?(state.month===-1?'ภาพรวมปี 2569':months[state.month].label+' 2569'):titles[state.page][0];q('#ih-subtitle').textContent=titles[state.page][1];q('#ih-crumb').textContent=pageNames[state.page];q('#ih-month').value=String(state.month);q('#ih-period-caption').textContent=state.month===-1?'ม.ค.–ก.ย. 2569':months[state.month].label+' 2569';root.querySelectorAll('[data-page]').forEach(b=>{if(b.dataset.page===state.page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});q('#ih-screen').innerHTML=({overview,media,drivers,mediaPlan})[state.page](m);if(state.page==='media')q('#ih-media').onchange=e=>{state.media=e.target.value;render();save();};root.querySelectorAll('.ih-panel,.ih-kpi').forEach(el=>el.style.borderRadius=design.radius+'px');if(state.page!=='drivers'&&state.page!=='mediaPlan'){restoreOverviewCharts(m);enhanceMetrics(m);}if(globalThis.lucide)lucide.createIcons();}
root.addEventListener('click',e=>{const periodButton=e.target.closest('[data-period]');if(periodButton){state.month=+periodButton.dataset.period;render();save();return;}const mediaButton=e.target.closest('[data-media]');if(mediaButton){state.media=mediaButton.dataset.media;state.page='media';render();save();return;}const monthButton=e.target.closest('[data-month]');if(monthButton){state.month=state.month===Number(monthButton.dataset.month)?-1:Number(monthButton.dataset.month);render();save();return;}const b=e.target.closest('[data-page],[data-go]');if(!b)return;state.page=b.dataset.page||b.dataset.go;if(state.page==='media')state.media='all';render();save();});q('#ih-year').onchange=()=>{state.month=-1;render();save();};q('#ih-month').onchange=e=>{state.month=Number(e.target.value);render();save();};

render();
} catch(error) { console.error(error);root.querySelector('#ih-screen').innerHTML='<div class="ih-panel" role="alert">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ <button type="button" onclick="location.reload()">ลองใหม่</button></div>'; }
})();