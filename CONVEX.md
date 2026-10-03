# FFTiers on Convex

The `convex` branch replaces PocketBase + the Go/bash/Node update pipeline with
a single Convex deployment. Everything lives under `frontend/`:

```
frontend/
  convex/
    schema.ts        tables + indexes
    lib/tiers.ts     pure parsing / flattening / week math (shared with backfill)
    ingest.ts        upsertWeek, upsertBigBoard   (internal mutations, transactional)
    fetch.ts         update action: S3 fetch w/ ETags -> parse -> ingest
    crons.ts         runs fetch.update hourly
    rankings.ts      public queries the UI uses
  scripts/backfill.ts   loads backend/data/out/*.json via `convex import`
  src/                  same React/ag-grid UI, now on `useQuery` from convex/react
```

What's gone: `pocketbase` + TanStack Query in the frontend, `backend/ingest/*`,
`backend/cmd/update` + `backend/internal/fftiers`, `hourly_updates.sh`, the
`pb/` container. They are still on `main`; delete them from this branch once
you're happy.

## Data model

| table | one row per | notes |
|---|---|---|
| `weekly_rankings` | player × position × format × week | `by_week` index `[year, week, position, format]`, `by_player` `[player, year, week]` |
| `big_board_rankings` | player × format | replaced wholesale each run; position recovered from weekly data (`UNK` if deep sleeper) |
| `weeks` | year × week | `sourceDate`, `updatedAt`, `positionFormats` map. Drives dropdowns + "Last Updated" |
| `source_cache` | upstream file | ETag per S3 file, replaces `backend/data/cache/*.txt` |

Player identity is the name string. Teams in localStorage now store names, not
PocketBase ids, so old saved teams won't match (fresh start on this branch).

## 1. Self-host Convex on plex

```bash
mkdir -p ~/docker/convex && cd ~/docker/convex
npx degit get-convex/convex-backend/self-hosted/docker/docker-compose.yml docker-compose.yml
```

Edit the compose file's `backend` env so the browser can reach it through NPM:

```yaml
environment:
  - CONVEX_CLOUD_ORIGIN=https://convex.israelimru.com
  - CONVEX_SITE_ORIGIN=https://convex.israelimru.com/http
  - DISABLE_BEACON=true
```

Then:

```bash
docker compose up -d
docker compose exec backend ./generate_admin_key.sh   # save this
```

NPM proxy hosts:
- `convex.israelimru.com` → `backend:3210` (websockets on)
- `convex.israelimru.com/http` → `backend:3211` (only needed if you add HTTP actions)
- `convex-dash.israelimru.com` → `dashboard:6791` (optional; log in with the admin key)

Both can be the same compose project as plex/fftiers, so container names resolve.

## 2. Point the CLI at it

`frontend/.env.local` (gitignored):

```
CONVEX_SELF_HOSTED_URL=https://convex.israelimru.com
CONVEX_SELF_HOSTED_ADMIN_KEY=<key from step 1>
VITE_CONVEX_URL=https://convex.israelimru.com
```

For local dev against a local backend (no docker) use the released binary:
`convex-local-backend --instance-name fftiers --instance-secret <hex>` and
`keygen admin-key` with the same values. Note it refuses to start if `TZ` is set.

## 3. Deploy functions + backfill

```bash
cd frontend
bun install
npx convex dev --once          # pushes schema/functions, writes convex/_generated
bun run backfill               # flattens backend/data/out/*.json and imports (--replace)
```

Backfill rules (`scripts/backfill.ts`): week number comes from the file date via
`SEASON_START` in `convex/lib/tiers.ts` (2025: 09-02, 2026: 09-08). Multiple
files in one week → latest date wins. `week_N.json` → 2025 week N. Check the
2025 start date; it was guessed, the old script only had 2026 hardcoded.

Sanity check:

```bash
npx convex run rankings:weeks '{"year":2026}'
npx convex run rankings:byWeek '{"year":2026,"week":4,"position":"QB","format":"Standard"}'
npx convex run rankings:playerHistory '{"player":"Josh Allen","year":2026}'
```

## 4. The hourly update

`convex/crons.ts` runs `fetch.update` every hour; it's registered the moment
functions are deployed, nothing to install on the box. Trigger by hand:

```bash
bun run update:now             # = npx convex run fetch:update '{"force":true}'
```

`force` ignores the ETag cache. Without it a no-change run is 15 conditional
GETs and zero writes. If only some upstream files changed, the untouched
position/format combos are carried over from the existing week so the week is
never half-empty.

Remove the old crontab entry for `hourly_updates.sh` once this is running.

## 5. Frontend

```bash
bun run dev            # vite, uses VITE_CONVEX_URL
bun run build          # dist/ as before; your existing fftiers nginx container serves it
bun run deploy         # convex deploy + build + restart container
```

The UI makes three small subscriptions per table: `weeks`, `byWeek(week)`,
`byWeek(week-1)` for the Δ column. No more full-year fetch.

Optional: `@convex-dev/static-hosting` can serve `dist/` from the Convex
deployment itself (`https://<deployment>.convex.site`). Not needed since the
nginx container + NPM already works; mentioned in case you want one less
container.

## Things to decide / not done

- `big_board_rankings` has a query (`rankings.bigBoard`) but the draft-board
  view isn't wired back into the UI (main had switched it off anyway).
- `playerHistory` exists for a "tier over the season" sparkline; UI not built.
- Old-format `week_0.json` imports as week 0. Drop it or map to 1 if it bugs you.
- Delete the Go/PB/ingest dirs from this branch when ready.
