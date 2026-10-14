export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/report') {
      if (url.pathname.startsWith('/api/')) return Response.json({error:'Not found'}, {status:404});
      return env.ASSETS.fetch(request);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return Response.json({error:'Method not allowed'}, {status:405,headers:{Allow:'GET, HEAD'}});
    }
    try {
      const [monthly, platform] = await env.DB.batch([
        env.DB.prepare('SELECT * FROM report_months ORDER BY year, month'),
        env.DB.prepare('SELECT * FROM platform_performance ORDER BY month_id, display_order')
      ]);
      const months = monthly.results.map(m => ({
        key:m.id, year:m.year, month:m.month, label:m.label, short:m.short_label,
        budget:m.budget, actual:m.actual, sales:m.sales, sourceRoas:m.source_roas,
        rows:platform.results.filter(r=>r.month_id===m.id).map(r=>[
          r.platform,r.budget,r.actual,r.sales,r.source_roas
        ])
      }));
      const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
      return request.method === 'HEAD' ? new Response(null,{headers}) : Response.json({months}, {headers});
    } catch (error) {
      console.error('Unable to read report database', error);
      return Response.json({error:'Report is temporarily unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}});
    }
  }
};
