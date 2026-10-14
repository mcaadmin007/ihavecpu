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
