const ACCOUNTS=[['518873608460591','iHAVECPU (Meta)'],['477807386443528','CPAS SHP'],['411325841312675','CPAS LAZ'],['1277324607445558','CPAS TIKTOK']];
export function normalize(row){
 const action=(list,name)=>{const item=(list||[]).find(x=>x.action_type===name);return item&&Number.isFinite(Number(item.value))?Number(item.value):null;};
 return {month:Number(row.date_start.slice(5,7)),actual:Number(row.spend||0),sales:action(row.action_values,'omni_purchase'),impressions:Number(row.impressions||0),clicks:Number(row.clicks||0),orders:action(row.actions,'omni_purchase'),cart:action(row.actions,'omni_add_to_cart'),checkout:action(row.actions,'omni_initiated_checkout'),landingPageViews:action(row.actions,'landing_page_view')};
}
export async function metaReport(env){
 if(!env.META_ACCESS_TOKEN)throw new Error('Meta not configured');
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta_report_cache (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
 const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date()));
 const key=String(year), now=Date.now();
 const cached=await env.DB.prepare('SELECT payload,updated_at FROM meta_report_cache WHERE id=?').bind(key).first();
 if(cached&&now-cached.updated_at<3600000)return JSON.parse(cached.payload);
 try{
  const until=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(now-86400000));
  const accounts=await Promise.all(ACCOUNTS.map(async([id,name])=>{
   const query=new URLSearchParams({fields:'account_id,date_start,date_stop,spend,impressions,clicks,actions,action_values',level:'account',time_increment:'monthly',time_range:JSON.stringify({since:`${year}-01-01`,until}),limit:'100'});
   const response=await fetch(`https://graph.facebook.com/v23.0/act_${id}/insights?${query}`,{headers:{Authorization:`Bearer ${env.META_ACCESS_TOKEN}`},signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error('Meta request failed');
   const result=await response.json();
   if(!Array.isArray(result.data)||result.paging?.next)throw new Error('Incomplete Meta report');
   return {id,name,months:result.data.map(normalize)};
  }));
  const result={year,through:until,updatedAt:new Date(now).toISOString(),accounts};
  await env.DB.prepare('INSERT INTO meta_report_cache(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(key,JSON.stringify(result),now).run();
  return result;
 }catch(error){if(cached)return {...JSON.parse(cached.payload),stale:true};throw new Error('Meta report unavailable');}
}
