# Rybbit API v1 Guide

Straightforward overview of the project API living at `/api/v1`. Every call must include your project key in `X-API-Key`.

## Authentication

- Obtain the project key from the Rybbit dashboard or via the upcoming project management endpoints.
- Send the key on every request:

```http
X-API-Key: rbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Missing or invalid keys return `401`. The per-project limiter (`PROJECT_API_RATE_LIMIT`) answers with `429` when you push too hard.

## 1. Ingesting events

Send analytics events with `POST /api/v1/events`. Provide at least one visitor identifier (`session_id`, `anon_id`, or `user_id`) so Rybbit can deduplicate people.

```bash
curl https://api.rybbit.app/api/v1/events \
  -H "X-API-Key: $RYBBIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-10-14T10:01:02Z",
    "page_url": "https://example.com/pricing",
    "session_id": "sess_123",
    "metadata": {
      "source": "ads",
      "action": "click"
    }
  }'
```

Post an array to batch up to 500 items. The response states how many records were accepted. Duplicate payloads are silently skipped thanks to automatic idempotency keys.

## 2. Event analytics

Quick answers about event volume:

- `GET /api/v1/events/stats/summary?from=&to=` — totals and first/last seen timestamps.
- `GET /api/v1/events/stats/daily?from=&to=` — daily rollup (events + unique visitors) ready for charts.
- `GET /api/v1/events?limit=&page=&from=&to=` — raw event debug listing with pagination.

## 3. Visitors directory

List anonymised visitors (hashed identifiers) together with activity history:

```bash
curl "https://api.rybbit.app/api/v1/users?limit=50&page=1" \
  -H "X-API-Key: $RYBBIT_API_KEY"
```

Response fields:

- `visitor_id` — stable hash across events/sessions.
- `visits`, `sessions` — totals in the selected window.
- `first_seen`, `last_seen` — ISO timestamps.
- `pagination` — standard `page`, `limit`, `total`.

Filter with `from` / `to` (ISO 8601) to narrow a time range.

## 4. Managing funnels

Create conversion funnels with ordered steps:

```bash
curl https://api.rybbit.app/api/v1/funnels \
  -H "X-API-Key: $RYBBIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout flow",
    "steps": [
      { "key": "landing", "name": "Landing page", "page_pattern": "/landing" },
      { "key": "checkout", "name": "Checkout", "page_pattern": "/checkout" },
      { "key": "success", "name": "Success", "page_pattern": "/success" }
    ]
  }'
```

Essential routes:

- `GET /api/v1/funnels` — list funnels.
- `GET /api/v1/funnels/{id}` — fetch a funnel with steps.
- `PATCH /api/v1/funnels/{id}` — rename, toggle, or replace steps.
- `DELETE /api/v1/funnels/{id}` — drop a funnel.
- `GET /api/v1/funnels/{id}/stats?from=&to=` — per-step visitors, conversions, drop-off, conversion rate.

## 5. Dashboard statistics

Use these endpoints to power charts and KPI cards:

```bash
curl "https://api.rybbit.app/api/v1/stats/overview?granularity=daily&from=2025-01-01&to=2025-01-31" \
  -H "X-API-Key: $RYBBIT_API_KEY"
```

- `/stats/overview` — visits and unique visitors (daily, monthly, yearly via `granularity`).
- `/stats/pages` — top 50 pages with visit/visitor counts and first/last seen timestamps (optional `path` / `page_url` filters).
- `/stats/realtime` — last five minutes snapshot (active visitors/sessions + top pages).

## Listening to Realtime Visitors

For live dashboards or alerting, subscribe to the Server-Sent Events stream:

```bash
curl -N https://api.rybbit.app/api/v1/realtime/visitors \
  -H "X-API-Key: $RYBBIT_API_KEY"
```

Each `update` event contains the same payload as `/stats/realtime`. Remember to reconnect automatically in case of network interruptions.

## Additional Resources

- OpenAPI contract: `openapi/rybbit-api.v1.yaml`
- Architecture notes: `ARCHITECTURE-NOTES.md`
- Minimal tracking snippet: `examples/js/snippet.js`

Future work: project lifecycle endpoints (create/rotate keys) and even faster aggregates.
