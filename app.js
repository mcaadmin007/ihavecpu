
let months=[];
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>n==null?'—':n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=n=>fmt(n,Math.abs(n-Math.round(n))>.001?2:0);
const sign=n=>(n>0?'+':'')+money(n);
let active=0;
const monthNav=document.getElementById('months');

function render(){const m=months[active],variance=m.actual-m.budget,util=m.actual/m.budget*100,calcRoas=m.actual?m.sales/m.actual:0;
  [...monthNav.children].forEach((b,i)=>b.setAttribute('aria-selected',i===active));
  document.getElementById('kpis').innerHTML=`<article class="card kpi"><div class="label">ยอดขายรวม</div><div class="value">${fmt(m.sales)}</div><div class="detail">บาท · ${escapeHtml(m.label)} 2569</div></article><article class="card kpi"><div class="label">ยอดใช้จริง</div><div class="value">${money(m.actual)}</div><div class="detail">จากงบ ${fmt(m.budget)} บาท</div></article><article class="card kpi"><div class="label">ผลต่างจากงบ</div><div class="value ${variance<=0?'up':'down'}">${sign(variance)}</div><div class="detail">${util.toFixed(1)}% ของงบประมาณ</div></article><article class="card kpi"><div class="label">ROAS รวม (คำนวณ)</div><div class="value">${calcRoas.toFixed(1)}x</div><div class="detail">ยอดขาย ÷ ยอดใช้จริง</div></article>`;
  const usable=m.rows.filter(r=>r[3]!=null),topSales=usable.reduce((a,b)=>b[3]>a[3]?b:a,usable[0]),topRoas=m.rows.filter(r=>r[4]!=null).reduce((a,b)=>b[4]>a[4]?b:a),over=m.rows.filter(r=>r[2]!=null&&r[2]>r[1]).length;
  document.getElementById('insights').innerHTML=`<span class="chip"><i class="dot good"></i>ยอดขายสูงสุด <b>${escapeHtml(topSales[0])}</b> · ${fmt(topSales[3])} บาท</span><span class="chip"><i class="dot"></i>ROAS สูงสุด <b>${escapeHtml(topRoas[0])}</b> · ${fmt(topRoas[4])}x</span><span class="chip"><i class="dot warn"></i>ใช้เกินงบ <b>${over} แพลตฟอร์ม</b></span>`;
  const rows=m.rows.map(r=>{const v=r[2]==null?null:r[2]-r[1];return `<tr><td>${escapeHtml(r[0])}</td><td>${money(r[1])}</td><td>${money(r[2])}</td><td class="${v==null?'':v<=0?'up':'down'}">${v==null?'—':sign(v)}</td><td>${money(r[3])}</td><td>${r[4]==null?'—':`<span class="pill">${fmt(r[4])}x</span>`}</td></tr>`}).join('');
  document.getElementById('tbody').innerHTML=rows+`<tr class="total"><td>รวมทั้งหมด</td><td>${fmt(m.budget)}</td><td>${money(m.actual)}</td><td class="${variance<=0?'up':'down'}">${sign(variance)}</td><td>${fmt(m.sales)}</td><td>${calcRoas.toFixed(1)}x</td></tr>`;
  document.getElementById('periodPill').textContent=m.label+' 2569';drawCharts();
}
function chart(svgId,series,colors,scale=1){const svg=document.getElementById(svgId),W=600,H=250,p={l:42,r:16,t:14,b:34};svg.setAttribute('viewBox',`0 0 ${W} ${H}`);const vals=series.flatMap(s=>s.values),max=Math.max(...vals)*1.12,min=0,x=i=>p.l+i*(W-p.l-p.r)/(months.length-1),y=v=>H-p.b-(v-min)/(max-min)*(H-p.t-p.b);let out='';for(let k=0;k<5;k++){const yy=p.t+k*(H-p.t-p.b)/4;out+=`<line class="gridline" x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${p.l-7}" y="${yy+4}" text-anchor="end">${((max-(max-min)*k/4)/scale).toFixed(1)}</text>`}months.forEach((m,i)=>{out+=`<text class="axis" x="${x(i)}" y="${H-10}" text-anchor="middle">${escapeHtml(m.short)}</text>`});out+=`<line class="selected-line" x1="${x(active)}" x2="${x(active)}" y1="${p.t}" y2="${H-p.b}"/>`;series.forEach((s,j)=>{const pts=s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');out+=`<polyline class="${s.cls}" points="${pts}"/>`;s.values.forEach((v,i)=>out+=`<circle class="point" cx="${x(i)}" cy="${y(v)}" r="${i===active?5:3.5}" fill="${colors[j]}"/>`)});svg.innerHTML=out}
function drawCharts(){chart('salesChart',[{values:months.map(m=>m.sales),cls:'line-sales'}],['var(--blue)'],1e6);chart('spendChart',[{values:months.map(m=>m.budget),cls:'line-budget'},{values:months.map(m=>m.actual),cls:'line-actual'}],['var(--muted)','var(--orange)'],1e5)}
document.getElementById('themeBtn').onclick=()=>{const root=document.documentElement;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'};

async function loadReport(){
 const status=document.getElementById('status');
 try{
 const response=await fetch('/api/report');
 if(!response.ok) throw new Error('HTTP '+response.status);
 const data=await response.json();
 if(!Array.isArray(data.months)||!data.months.length) throw new Error('No report data');
 months=data.months; active=months.length-1;
 months.forEach((m,i)=>{const b=document.createElement('button');b.className='month';b.textContent=m.label;b.setAttribute('aria-selected',i===active);b.onclick=()=>{active=i;render()};monthNav.appendChild(b)});
 render(); status.textContent='อัปเดตจากฐานข้อมูลแล้ว';
 }catch(error){status.classList.add('error');status.textContent='โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่';const retry=document.createElement('button');retry.className='theme';retry.textContent='ลองใหม่';retry.onclick=()=>location.reload();status.append(' ',retry);console.error('Report loading failed',error);}
}
loadReport();
