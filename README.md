# iHAVECPU advertising report

Thai advertising dashboard served by Cloudflare Workers. The browser loads `GET /api/report`; report values are stored in Cloudflare D1, not embedded in HTML or JavaScript.

## Architecture

- `index.html`, `styles.css`, `app.js`: presentation and client-side charts.
- `worker.js`: read-only report API and static assets.
- D1 database `ihavecpu`, binding `DB`: `report_months` (9 source monthly totals) and `platform_performance` (81 platform rows).
- `schema.sql`: schema reference for a NEW empty database only. Production has already been initialized; do not reapply on each deployment.
- `build.mjs`: copies only browser files into `dist` for publishing.

## Development

Node.js 22 or newer:

```sh
npm install
npm test
npm run dev
```

Local Wrangler uses a separate local D1 database; initialize it with `npx wrangler d1 execute ihavecpu --local --file=schema.sql` and add local sample records as needed. Production records are not committed to this repository.

## Deploy

Cloudflare Workers Builds: repository `mcaadmin007/ihavecpu`, production branch `main`, build command `npm run build`, deploy command `npx wrangler deploy`. Alternatively use `npm run deploy` after Wrangler authentication.

## Data and access

Source: iHAVECPU_Report_2026_Share.html, January–September 2026. NULL remains missing and zero remains zero. Original monthly totals and source platform ROAS are preserved. Overall displayed ROAS is source monthly sales divided by source monthly spend. Small source discrepancies between monthly totals and summed detail (less than 1 THB) are intentionally preserved.

The website and read-only API are public as requested. Database changes require Cloudflare account authorization; no public write/query endpoint exists. No credentials are stored in the client or repository. Update data through Cloudflare D1 Console/Studio or authenticated Wrangler, then reload the website.

Future KPI additions should extend the schema/API; never invent values for missing funnel or profit data.
