import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
const data=[{results:[{id:'jan',year:2026,month:1,label:'มกราคม',short_label:'ม.ค.',budget:10,actual:8,sales:40,source_roas:5}]},{results:[{month_id:'jan',platform:'Example',budget:10,actual:8,sales:null,source_roas:null}]}];
const env={DB:{prepare:sql=>sql,batch:async()=>data},ASSETS:{fetch:async()=>new Response('asset')}};
test('GET returns D1 records preserving missing values',async()=>{
 const response=await worker.fetch(new Request('https://example.com/api/report'),env);
 assert.equal(response.status,200);
 const {months}=await response.json();
 assert.equal(months[0].sales,40);
 assert.deepEqual(months[0].rows,[['Example',10,8,null,null]]);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('Public API cannot write or execute arbitrary queries',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE']){
  const response=await worker.fetch(new Request('https://example.com/api/report',{method}),env);
  assert.equal(response.status,405);
 }
 assert.equal((await worker.fetch(new Request('https://example.com/api/other'),env)).status,404);
});
test('Database failure returns 503 without exposing details',async()=>{
 const failing={DB:{prepare:()=>{throw new Error('test database failure')}}};
 const response=await worker.fetch(new Request('https://example.com/api/report'),failing);
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{error:'Report is temporarily unavailable'});
});
test('HTML and assets are served by the asset binding',async()=>{
 assert.equal(await (await worker.fetch(new Request('https://example.com/'),env)).text(),'asset');
});
import {normalize,metaReport} from './meta.js';
test('Platform snapshots are read-only and preserve missing sales',async()=>{
 const payload={name:'Google',mode:'snapshot',months:[{month:1,actual:10,clicks:5}]};
 const platformEnv={DB:{prepare:()=>({all:async()=>({results:[{payload:JSON.stringify(payload),updated_at:'now'}]})})}};
 const response=await worker.fetch(new Request('https://example.com/api/platforms'),platformEnv);
 const result=await response.json();
 assert.equal(response.status,200);assert.equal(result.accounts[0].months[0].sales,undefined);
 assert.equal((await worker.fetch(new Request('https://example.com/api/platforms',{method:'POST'}),platformEnv)).status,405);
});
test('Meta uses omni purchase once, preserves unavailable revenue and sessions',()=>{
 const result=normalize({date_start:'2026-01-01',spend:'10',clicks:'5',impressions:'100',actions:[{action_type:'omni_purchase',value:'2'},{action_type:'purchase',value:'2'}]});
 assert.equal(result.orders,2);assert.equal(result.sales,null);assert.equal(result.sessions,undefined);assert.equal(result.actual,10);
});
test('Meta cached report avoids a network call and token is never returned',async()=>{
 const payload={accounts:[],updatedAt:'test'};
 const statement={run:async()=>{},bind(){return this;},first:async()=>({payload:JSON.stringify(payload),updated_at:Date.now()})};
 assert.deepEqual(await metaReport({META_ACCESS_TOKEN:'secret',DB:{prepare:()=>statement}}),payload);
});
test('Meta API rejects writes and hides errors',async()=>{
 assert.equal((await worker.fetch(new Request('https://example.com/api/meta',{method:'POST'}),env)).status,405);
 const response=await worker.fetch(new Request('https://example.com/api/meta'),env);
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Meta report unavailable'});
});
import {splitMainCampaigns} from './meta.js';
test('Main Meta account is partitioned by CPAS campaign token without double-counting',()=>{
 const rows=[{campaign_name:'260701_CPAS -July Promotion DDR4',date_start:'2026-07-01',spend:'10',impressions:'100',clicks:'5'},{campaign_name:'260701_Engagement',date_start:'2026-07-01',spend:'20',impressions:'200',clicks:'8'},{campaign_name:'260701_cpas_test',date_start:'2026-07-01',spend:'3',impressions:'30',clicks:'2'}];
 const split=splitMainCampaigns(rows);assert.equal(split.find(a=>a.name==='Facebook').months[0].actual,20);assert.equal(split.find(a=>a.name==='CPAS iHAVECPU').months[0].actual,13);assert.equal(split.reduce((n,a)=>n+a.months[0].impressions,0),330);assert.equal(split[0].months[0].sales,null);
});
import {completeMonths,reconcile} from './meta.js';
test('Meta checkout uses the reported omni_initiated_checkout event once',()=>{
 const d=normalize({date_start:'2026-01-01',actions:[{action_type:'omni_initiated_checkout',value:'15'},{action_type:'initiate_checkout',value:'15'}]});assert.equal(d.checkout,15);assert.equal(d.sales,null);
});
test('Completed Meta range includes inactive months without inventing revenue',()=>{
 const rows=completeMonths([{month:2,actual:12,sales:null}], '2026-10-14');assert.equal(rows.length,10);assert.equal(rows[1].actual,12);assert.equal(rows[8].actual,0);assert.equal(rows[8].status,'no_activity');assert.equal(rows[8].sales,null);
});
test('Campaign reconciliation rejects a matching-spend report with incorrect sales',()=>{
 const main={months:[{month:1,actual:30,impressions:300,clicks:30,sales:60}]};const split=[{months:[{month:1,actual:10,impressions:100,clicks:10,sales:20}]},{months:[{month:1,actual:20,impressions:200,clicks:20,sales:40}]}];assert.doesNotThrow(()=>reconcile(main,split));split[1].months[0].sales=50;assert.throws(()=>reconcile(main,split),/sales/);
});
test('Open-month drift is recorded and bounded; closed months remain strict',()=>{
 const main={months:[{month:10,actual:100000,impressions:1000000}]};const split=[{months:[{month:10,actual:99999,impressions:999991}]}];const checks=reconcile(main,split,10);assert.equal(checks.find(x=>x.metric==='impressions').difference,-9);assert.throws(()=>reconcile(main,split),/impressions/);split[0].months[0].actual=90000;assert.throws(()=>reconcile(main,split,10),/actual/);
});
