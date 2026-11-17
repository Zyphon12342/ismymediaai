# Deploy setup: secrets, environments and accounts

Everything here is done once, in the GitHub, Cloudflare and Supabase dashboards.
Never paste a key into chat, an issue, or a file in this repo.

## 1. GitHub environments

**Settings → Environments → New environment**, create two:

| Environment | Protection rules |
| --- | --- |
| `staging` | Deployment branches: **Selected branches → `main`** |
| `production` | **Required reviewers: you**. Deployment branches: **`main`**. Tick "Prevent self-review" off (you are the only reviewer). |

## 2. Repository secrets and variables

**Settings → Secrets and variables → Actions**.

Repository **secrets**:

| Name | Where to get it |
| --- | --- |
| `TMDB_API_TOKEN` | Already set. TMDB → Settings → API → *API Read Access Token* (the long v4 token). |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**. Account resources: your account. Zone resources: `ismymediaai.com`. Then add the permission **Zone → DNS → Edit** so the deploy can attach the custom domains. |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account (top right) → Access Tokens → Generate new token. Used only to run migrations. |

Repository **variables** (not secret):

| Name | Where to get it |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account details (right side) → Account ID. |

## 3. Environment secrets and variables

Open each environment (**Settings → Environments → staging / production**) and add:

| Name | Kind | Where to get it |
| --- | --- | --- |
| `SUPABASE_DB_PASSWORD` | secret | The database password you chose when creating that Supabase project. Forgot it? Project → Database → Settings → Reset database password. |
| `SUPABASE_SECRET_KEY` | secret | Project → Project Settings → API Keys → **Secret keys** (`sb_secret_…`). Create one named `github-actions`. |
| `SUPABASE_PUBLISHABLE_KEY` | variable | Project → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`). Public by design. |

Use the staging project (`raytxskehcrnbvyeebbf`) for `staging` and the
production project (`ifcwdqxukmauazzrmknf`) for `production`. The project refs
and site URLs are already in the workflows.

## 4. Branch protection for `main`

**Settings → Rules → Rulesets → New branch ruleset**, target `main`:

- Restrict deletions, block force pushes.
- Require a pull request before merging.
- Require status checks to pass: `Lint, types, unit tests`, `Database policies (pgTAP) and types`,
  `Worker build, integration and end-to-end`, `Secret scan (gitleaks)`, `Static analysis (Semgrep)`, `analyze (javascript-typescript)`, `analyze (actions)`.
  (They appear in the picker after the first CI run.)

## 5. Supabase project settings (both projects)

`supabase/config.toml` configures the local stack only. In each hosted project:

- **Authentication → URL Configuration**: Site URL `https://staging.ismymediaai.com` (staging) or
  `https://ismymediaai.com` (production). Redirect URLs: `<site>/auth/callback` only, no wildcards.
- **Authentication → Sign In / Providers → Email**: *Confirm email* on; minimum password length 10.
- **Authentication → Attack Protection**: turn on *Prevent use of leaked passwords* (needs the Pro plan;
  turn it on for production when you upgrade).
- **Database → Extensions**: nothing to do; migrations enable `pg_cron` themselves.

Google and GitHub sign-in, Resend email and Turnstile are set up in the auth milestone.

## 6. Cloudflare

- Keep **Workers Builds** (Git integration) **off**. GitHub Actions is the only thing that deploys.
- The first staging deploy creates the Worker `ismymediaai-staging` and attaches
  `staging.ismymediaai.com`. The first promotion creates `ismymediaai` and attaches the apex and
  `www.` (which the app redirects to the apex).
- SSL/TLS → Edge Certificates: **Always Use HTTPS** on.

## How a change reaches production

1. Open a PR. CI must be green.
2. Merge. `Deploy to staging` runs CI again, migrates the staging database, deploys, smoke tests
   `staging.ismymediaai.com`, and marks the commit `staging-verified`.
3. Actions → **Promote to production** → Run workflow (optionally give a commit SHA). Approve the
   `production` deployment when GitHub asks. It refuses commits that are not `staging-verified`,
   migrates production, deploys, smoke tests, and rolls back the Worker automatically if the
   smoke tests fail.
