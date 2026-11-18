# Database

`supabase/migrations/` is the source of truth for the schema, Row Level
Security and triggers. `lib/database.types.ts` is generated from it.

## Rules

- **Forward-only, expand then contract.** Add the new column, ship code that uses it, remove the old
  one in a later release. A rolled-back Worker must still work with the newest schema.
- **Deny by default.** Every new table: `enable row level security`, then explicit column-level
  `grant`s to `anon`/`authenticated` and policies. The local stack and new projects do not expose
  tables automatically (`auto_expose_new_tables = false`). Grant `service_role` access explicitly too.
- **Policy helpers** live in the `private` schema (not exposed through the Data API) and are
  `security definer` with `search_path = ''`.
- **Never edit a migration that has reached staging.** Write a new one.
- After a schema change: `npm run db:reset && npm run db:types && npm run db:test`.

## What the database enforces

| Rule | Where |
| --- | --- |
| One vote per user per title | `votes` primary key |
| Tallies count only trust level 1+ accounts that are not banned | `private.recount_tally`, triggers on `votes` and `profiles` |
| Individual votes are private unless `show_votes` is on | `votes_select` policy |
| Verified email before any write | `private.is_verified()` in insert policies |
| Catalogue entries publish at once; manual ones wait unless trust 2 | `private.prepare_media_insert` |
| Kind-specific credit roles (no director on a book) | `private.check_credit` |
| 1 to 3 genres per title that fit its kind (max enforced here, min by the service) | `private.check_media_genre` |
| One level of replies, 15-minute edits, soft delete clears text | comment triggers |
| 10 new comments an hour and 20 edits or deletes an hour per user; no edits on a locked title | `comments_write_checks` trigger |
| Blocked words (whole word, any case) and blocked evidence-link domains, both admin-managed lists | `private.blocked_terms`, `private.blocked_domains` |
| One open report per reporter per target | partial unique index |
| `mod_actions` is append-only, even for admins and the owner | `private.forbid_change` triggers |
| Handle changes at most once per 30 days; no reserved or placeholder-shaped handles | `private.guard_profile_update` |
| Username picked at sign-up is kept if free, else a `user_…` placeholder | `private.handle_new_user` |
| Avatars only in the user's own folder, images up to 2 MB, at most 3 files | `avatars` bucket and storage policies |
| New titles are created in one transaction with 1 to 3 genres and kind-fitting credits; catalogue ids are unique, so re-adding returns the existing title | `public.create_media()` |
| Five new titles a day per user; 30 catalogue lookups a minute | `media_rate_limit` trigger, `public.rate_limit_check('lookup')` |
| Rate limits (profile edits: 10 an hour); errors use SQLSTATE `RL429`, mapped to HTTP 429 | `private.rate_limit`, called from triggers |
| Nightly trust promotion (verified, 72 h old) | `pg_cron` job `refresh-trust-levels`, 03:15 UTC |

Public profile columns are `id, handle, display_name, avatar_path, role, show_votes, created_at`.
`trust_level` and `banned_until` are readable only through `my_profile()` for the signed-in user,
so select profile columns explicitly (`select('*')` is refused).
