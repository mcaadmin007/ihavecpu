const ACCOUNTS=[['518873608460591','iHAVECPU (Meta)'],['477807386443528','CPAS SHP'],['411325841312675','CPAS LAZ'],['1277324607445558','CPAS TIKTOK']];
export function normalize(row){
 const action=(list,name)=>{const item=(list||[]).find(x=>x.action_type===name);return item&&Number.isFinite(Number(item.value))?Number(item.value):null;};
 return {month:Number(row.date_start.slice(5,7)),actual:Number(row.spend||0),sales:action(row.action_values,'omni_purchase'),impressions:Number(row.impressions||0),clicks:Number(row.clicks||0),orders:action(row.actions,'omni_purchase'),cart:action(row.actions,'omni_add_to_cart'),checkout:action(row.actions,'omni_initiated_checkout'),landingPageViews:action(row.actions,'landing_page_view')};
}
export function splitMainCampaigns(rows){
 const groups=new Map([['Facebook',new Map()],['CPAS iHAVECPU',new Map()]]);
 for(const row of rows){
  const name=/(^|[^a-z])cpas([^a-z]|$)/i.test(row.campaign_name||'')?'CPAS iHAVECPU':'Facebook';
  const d=normalize(row),byMonth=groups.get(name),list=byMonth.get(d.month)||[];list.push(d);byMonth.set(d.month,list);
 }
 return [...groups].map(([name,byMonth])=>({id:'518873608460591',name,source:'Meta API · campaign',months:[...byMonth].sort((a,b)=>a[0]-b[0]).map(([month,list])=>Object.fromEntries([['month',month],...Object.keys(list[0]).filter(k=>k!=='month').map(k=>{const values=list.map(d=>d[k]).filter(Number.isFinite);return [k,values.length?values.reduce((a,b)=>a+b,0):null];})]))}));
}
async function campaignInsights(env,year,until){
 const key=`campaign-job-${year}-${until}`,headers={Authorization:`Bearer ${env.META_ACCESS_TOKEN}`};
 const stored=await env.DB.prepare('SELECT payload,updated_at FROM meta_report_cache WHERE id=?').bind(key).first();
 let job=stored?JSON.parse(stored.payload):null;
 if(!job||Date.now()-stored.updated_at>3600000){
  const body=new URLSearchParams({fields:'campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,actions,action_values',level:'campaign',time_increment:'monthly',time_range:JSON.stringify({since:`${year}-01-01`,until})});
  const response=await fetch('https://graph.facebook.com/v23.0/act_518873608460591/insights',{method:'POST',headers,body,signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok||!/^\d+$/.test(result.report_run_id||''))throw new Error('Meta async report creation failed');
  job={id:result.report_run_id};
  await env.DB.prepare('INSERT INTO meta_report_cache(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(key,JSON.stringify(job),Date.now()).run();
 }
 const statusResponse=await fetch(`https://graph.facebook.com/v23.0/${job.id}?fields=async_status,async_percent_completion`,{headers,signal:AbortSignal.timeout(60000)});
 const status=await statusResponse.json();if(!statusResponse.ok)throw new Error('Meta async status unavailable');
 if(status.async_status!=='Job Completed')throw new Error(status.async_status==='Job Failed'?'Meta async report failed':'Meta report preparing');
 const query=new URLSearchParams({limit:'500'}),rows=[],seen=new Set();
 for(let page=0;page<30;page++){
  const response=await fetch(`https://graph.facebook.com/v23.0/${job.id}/insights?${query}`,{headers,signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Meta campaign report failed');
  const data=await response.json();if(!Array.isArray(data.data))throw new Error('Invalid campaign report');rows.push(...data.data);
  if(!data.paging?.next)return rows;
  const after=data.paging?.cursors?.after;if(!after||seen.has(after))throw new Error('Incomplete campaign report');seen.add(after);query.set('after',after);
 }
 throw new Error('Campaign report exceeds page limit');
}
export async function metaReport(env){
 if(!env.META_ACCESS_TOKEN)throw new Error('Meta not configured');
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta_report_cache (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
 const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date()));
 const key=String(year)+'-campaign-v1', now=Date.now();
 let cached=await env.DB.prepare('SELECT payload,updated_at FROM meta_report_cache WHERE id=?').bind(key).first();
 if(cached&&now-cached.updated_at<3600000)return JSON.parse(cached.payload);
 if(!cached)cached=await env.DB.prepare('SELECT payload,updated_at FROM meta_report_cache WHERE id=?').bind(String(year)).first();
 try{
  const until=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(now-86400000));
  const campaignRows=await campaignInsights(env,year,until),split=splitMainCampaigns(campaignRows);
  const accounts=await Promise.all(ACCOUNTS.map(async([id,name])=>{
   const query=new URLSearchParams({fields:'account_id,date_start,date_stop,spend,impressions,clicks,actions,action_values',level:'account',time_increment:'monthly',time_range:JSON.stringify({since:`${year}-01-01`,until}),limit:'100'});
   const response=await fetch(`https://graph.facebook.com/v23.0/act_${id}/insights?${query}`,{headers:{Authorization:`Bearer ${env.META_ACCESS_TOKEN}`},signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw new Error('Meta request failed');
   const result=await response.json();
   if(!Array.isArray(result.data)||result.paging?.next)throw new Error('Incomplete Meta report');
   return {id,name,months:result.data.map(normalize)};
  }));
  const main=accounts.find(a=>a.name==='iHAVECPU (Meta)');
  for(const m of main.months){
   const spend=split.reduce((n,a)=>n+(a.months.find(x=>x.month===m.month)?.actual||0),0);
   if(Math.abs(spend-m.actual)>1)throw new Error('Campaign spend does not reconcile');
  }
  const result={year,through:until,updatedAt:new Date(now).toISOString(),accounts:[...accounts,...split],mainAccountSplit:true};
  await env.DB.prepare('INSERT INTO meta_report_cache(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(key,JSON.stringify(result),now).run();
  return result;
 }catch(error){if(cached)return {...JSON.parse(cached.payload),stale:true,refreshIssue: error.name==='TimeoutError'?'Meta timeout':String(error.message).slice(0,120)};throw new Error('Meta report unavailable');}
}
