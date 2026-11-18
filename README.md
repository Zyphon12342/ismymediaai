# isMyMediaAI

Community votes, backed by cited evidence, on whether a movie, TV show or book used generative AI.

Next.js (App Router, strict TypeScript) on Cloudflare Workers via OpenNext, with Supabase for
Postgres, Auth and Storage.

## Local development

Needs Node 22+ and Docker.

```bash
npm install
cp .env.example .env.local
npm run db:start      # local Supabase in Docker; applies migrations and seed
npm run dev           # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint, `tsc --noEmit` (strict) |
| `npm test` | Unit tests (Vitest); `npm run test:unit` adds coverage |
| `npm run db:test` | pgTAP tests of every RLS policy and trigger |
| `npm run db:reset` | Rebuild the local database from migrations |
| `npm run db:types` | Regenerate `lib/database.types.ts` (CI fails if it is stale) |
| `npm run preview` | Build the Worker and run it in workerd on http://localhost:8787 |
| `npm run test:integration` | HTTP and Data API tests; needs `db:start` and the app running (`APP_URL`, default `:3000`) |
| `npm run test:e2e` | Playwright against `BASE_URL` (default the Worker preview on `:8787`) |

## Layout

```
app/                 pages and app/api route handlers (thin)
lib/services/        business logic, pure functions (unit tested)
lib/catalog/         TMDB, Open Library and AniList clients (fixtures for local previews and CI)
lib/data/            typed queries used by pages and routes (user token, RLS applies)
components/          React components
lib/validation/      Zod schemas shared by forms and the API
lib/http/            withHandler route wrapper, errors, origin check, security headers
lib/supabase/        server, browser and middleware clients (user token, RLS applies)
middleware.ts        session refresh, canonical host, security headers, request id
supabase/migrations/ schema, RLS and triggers (source of truth)
supabase/tests/      pgTAP policy tests
tests/               unit and integration tests
e2e/                 Playwright tests (@smoke runs after every deploy)
```

## Environments

| Environment | URL | Deploys |
| --- | --- | --- |
| Local | localhost:3000 | `npm run dev` |
| Staging | staging.ismymediaai.com | every merge to `main` |
| Production | ismymediaai.com | manual, approved **Promote to production** of a staging-verified commit |

See [docs/SETUP.md](docs/SETUP.md) for secrets and one-time setup, and
[docs/DATABASE.md](docs/DATABASE.md) for schema rules.

Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
Book data from Open Library. Anime and manga data from AniList.
