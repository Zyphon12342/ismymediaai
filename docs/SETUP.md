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
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account (top right) → Access Tokens → Generate new token. Used to run migrations (no database password needed). |

Repository **variables** (not secret):

| Name | Where to get it |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account details (right side) → Account ID. |

## 3. Environment secrets and variables

Open each environment (**Settings → Environments → staging / production**) and add:

| Name | Kind | Where to get it |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | secret | Project → Project Settings → API Keys → **Secret keys** (`sb_secret_…`). Create one named `github-actions`. |
| `SUPABASE_PUBLISHABLE_KEY` | variable | Project → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`). Public by design. |
| `POSTHOG_KEY` | variable (optional) | posthog.com → create one project per environment (e.g. "isMyMediaAI staging" and "isMyMediaAI") → Project settings → **Project API key** (`phc_…`). Public by design. Unset: no analytics. |
| `POSTHOG_HOST` | variable (optional) | `https://us.i.posthog.com` for US cloud (the default) or `https://eu.i.posthog.com` for EU cloud. |
| `CF_BEACON_TOKEN` | variable (optional) | Cloudflare dashboard → Analytics & Logs → **Web Analytics** → Add a site → `ismymediaai.com` (or `staging.ismymediaai.com`) → choose **manual setup** → copy the `token` value from the snippet. |

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

## 5. Supabase Auth settings (do this in both projects)

`supabase/config.toml` configures the local stack only. Open each hosted project at
supabase.com/dashboard (staging `raytxskehcrnbvyeebbf`, production `ifcwdqxukmauazzrmknf`) and:

1. **Authentication → URL Configuration**
   - Site URL: `https://staging.ismymediaai.com` (staging) or `https://ismymediaai.com` (production).
   - Redirect URLs → **Add URL**: `https://staging.ismymediaai.com/auth/callback` (staging) or
     `https://ismymediaai.com/auth/callback` (production). Exactly that one, no wildcards. **Save**.
2. **Authentication → Sign In / Providers → Email**: *Confirm email* on, *Secure email change* on,
   minimum password length **10**. **Save**.
3. **Authentication → Emails → Templates**. For each of the three below, replace the subject and the
   whole message body with the file from `supabase/templates/`, then **Save**:

   | Template | Subject | Body file |
   | --- | --- | --- |
   | Confirm sign up | `Confirm your isMyMediaAI account` | `confirmation.html` |
   | Reset password | `Reset your isMyMediaAI password` | `recovery.html` |
   | Change email address | `Confirm your new email for isMyMediaAI` | `email_change.html` |

   These links work even when someone opens the email in a different browser. Without them the
   default links still work, but only in the browser that signed up.
4. **Authentication → Attack Protection**: turn on *Prevent use of leaked passwords* (Pro plan;
   do it for production when you upgrade).
5. Until custom SMTP is set up (launch milestone), Supabase only sends auth email to members of
   your Supabase organization, at most a few an hour. That is enough to test staging yourself.

### Turnstile bot check (optional until launch, do staging first)

The app shows the widget only when `TURNSTILE_SITE_KEY` is set, and Supabase checks the token only
when CAPTCHA is on, so do the steps in this order:

1. Cloudflare dashboard → **Turnstile** → **Add widget**. Name `ismymediaai-staging`, hostname
   `staging.ismymediaai.com`, mode **Managed**, pre-clearance **No**. **Create**. Keep the page open.
2. Supabase (staging) → **Authentication → Attack Protection → Enable CAPTCHA protection** on,
   provider **Turnstile by Cloudflare**, paste the widget's **Secret key**. **Save**.
3. GitHub → **Settings → Environments → staging → Environment secrets → Add environment secret**:
   `TURNSTILE_SECRET_KEY` = the same **Secret key**. The app uses it to check the bot test when
   someone adds a title or posts one of their first three comments.
4. Same page → **Environment variables → Add variable**:
   `TURNSTILE_SITE_KEY` = the widget's **Site key** (public by design).
5. Re-run the latest **Deploy to staging** workflow (Actions → Deploy to staging → Re-run all jobs).

Repeat with a second widget for `ismymediaai.com` and the `production` environment before launch.
To turn it off, do the steps in reverse order (delete the variable and redeploy first, then the secret).

### Google and GitHub sign-in (optional)

The buttons appear only for providers listed in the environment variable `AUTH_PROVIDERS`
(for example `google,github`). For each provider and each environment:

- **GitHub**: github.com → Settings → Developer settings → OAuth Apps → **New OAuth App**.
  Homepage URL `https://staging.ismymediaai.com`; Authorization callback URL
  `https://raytxskehcrnbvyeebbf.supabase.co/auth/v1/callback`. Register, then **Generate a new client
  secret**. In Supabase → Authentication → Sign In / Providers → **GitHub**: on, paste Client ID and
  secret, **Save**.
- **Google**: console.cloud.google.com → APIs & Services → **OAuth consent screen** (External, app
  name isMyMediaAI, your email) → **Credentials → Create credentials → OAuth client ID** → Web
  application. Authorized JavaScript origin `https://staging.ismymediaai.com`; Authorized redirect URI
  `https://raytxskehcrnbvyeebbf.supabase.co/auth/v1/callback`. In Supabase → **Google**: on, paste
  Client ID and secret, **Save**.
- Then GitHub → Settings → Environments → staging → **Add variable** `AUTH_PROVIDERS` =
  `google,github` (or just one), and re-run **Deploy to staging**.

For production use `https://ismymediaai.com` and `ifcwdqxukmauazzrmknf` in the URLs above.

## 6. Cloudflare

- Keep **Workers Builds** (Git integration) **off**. GitHub Actions is the only thing that deploys.
- The first staging deploy creates the Worker `ismymediaai-staging` and attaches
  `staging.ismymediaai.com`. The first promotion creates `ismymediaai` and attaches the apex and
  `www.` (which the app redirects to the apex).
- SSL/TLS → Edge Certificates: **Always Use HTTPS** on.

## 7. Comment word filter and blocked link domains (optional)

Both lists start empty. To add entries, in the Supabase dashboard for each project open **SQL Editor** → **New query**, paste and edit, then click **Run**:

```sql
insert into private.blocked_terms (term) values ('exampleslur');           -- lower case, whole words
insert into private.blocked_domains (domain) values ('malware.example');  -- also blocks its subdomains
```

To remove one: `delete from private.blocked_terms where term = 'exampleslur';`

## 8. Make yourself a moderator or admin

Moderators see **Mod queue** in the header and can hide, restore and ban. In the Supabase dashboard for the project open **SQL Editor** → **New query**, paste this with your username, then click **Run**:

```sql
update public.profiles set role = 'admin', trust_level = 2 where handle = 'your_username';
```

After that, promote other moderators from SQL the same way with `role = 'moderator'`.

**2-step login.** Moderator and admin powers only work from a session that passed 2-step login with an authenticator app (TOTP). The first time you open **Mod queue**, the site walks you through setting it up. After that, each sign-in asks for a 6-digit code.

- Supabase turns TOTP on by default. To check, open the project → **Authentication → Multi-Factor** (under Configuration) → **TOTP (App Authenticator)** should be **Enabled**. If it isn't, set it to **Enabled** and click **Save**.
- If a moderator loses their phone, an admin removes their authenticator so they can set it up again: Supabase → **Authentication → Users** → click the user → **Multi-Factor Authentication** section → delete the factor. Or run this in the **SQL Editor**:

  ```sql
  delete from auth.mfa_factors where user_id = (select id from public.profiles where handle = 'their_username');
  ```

## 9. Fill staging with titles

GitHub → **Actions → Seed staging catalogue → Run workflow** → keep the defaults (60 movies, 40 TV shows, 40 books) → **Run workflow**. It takes a few minutes. Titles already there are skipped, so you can run it again at any time. There is no production version on purpose: production fills up from members.

Locally: `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=<local secret> TMDB_API_TOKEN=fixture npx tsx --import ./scripts/fixture-fetch.ts scripts/seed-catalogue.ts` seeds the fixture titles.

## How a change reaches production

1. Open a PR. CI must be green.
2. Merge. `Deploy to staging` runs CI again, migrates the staging database, deploys, smoke tests
   `staging.ismymediaai.com`, and marks the commit `staging-verified`.
3. Actions → **Promote to production** → Run workflow (optionally give a commit SHA). Approve the
   `production` deployment when GitHub asks. It refuses commits that are not `staging-verified`,
   migrates production, deploys, smoke tests, and rolls back the Worker automatically if the
   smoke tests fail.
