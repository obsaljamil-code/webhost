# WebHost LavaMC — free website hosting

A small Netlify-style platform. People sign up with email + password,
upload a site (one HTML file, a whole folder, or a .zip), and it's live at:

```
https://host.lavamc.dpdns.org/<their-chosen-name>
```

Path-based — no wildcard DNS needed, just one `host` subdomain pointed at
Vercel.

Backend: Supabase (Auth + Database + Storage) — already created for you.
Frontend/server: Next.js — push this to GitHub, Vercel deploys it.

---

## 1. What's already done for you (Supabase)

Project `website-hosting-platform` (region ap-southeast-1):

- **Tables:** `profiles`, `sites`, `site_files`, `reserved_subdomains`
- **Storage bucket:** `site-files` (public read, owner-only write)
- **Row Level Security** on everything
- **Database functions:** username/address availability checks, view
  counter, username→email lookup for login — all explained in section 4
- **Free-plan website limit:** every account has a `site_limit` (default
  3). The dashboard shows "x / y websites used" and blocks a new site past
  that number; you can raise or lower it per-user from `/admin`.
- **Auto-admin:** the very first person who ever signs up on this app
  automatically becomes an admin (`is_admin = true`). Nobody had signed up
  yet (checked: 0 rows in `profiles`), so sign up first with
  `codexbazarshop@gmail.com` and you'll get admin automatically — no SQL
  needed from me.

## 2. Things you need to configure in Supabase before it all works

Go to **supabase.com/dashboard → website-hosting-platform**:

### a) Let people sign up with just a password (no email click needed)
Authentication → Providers → Email → turn **"Confirm email"** OFF.
With it on, `signUp()` creates the account but won't log them in until
they click a link in their inbox — the flow I built logs them in
immediately after signup, matching what you asked for.

### b) Turn the "forgot password" email into a 6-digit code
Authentication → Email Templates → **Magic Link** → edit the body so it
shows `{{ .Token }}` somewhere, e.g.:

```
Your WebHost LavaMC verification code is: {{ .Token }}
```

That's the code the "forgot password" page asks people to type in. (We
reuse the Magic Link template/mechanism for this rather than the Reset
Password one, because it's the one that gives a plain 6-digit code.)

### c) The admin API's secret key
Project Settings → API → copy the **`service_role`** key (click reveal).
This is secret — it bypasses all security rules — so it goes into Vercel
as `SUPABASE_SERVICE_ROLE_KEY`, never into a file you commit to Git, and
never with a `NEXT_PUBLIC_` prefix.

## 3. Deploying

```bash
git init
git add .
git commit -m "WebHost LavaMC"
git remote add origin <your GitHub repo URL>
git push -u origin main
```

Then on [vercel.com](https://vercel.com): **Add New Project** → pick the
repo → set these Environment Variables → Deploy.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pplocqxuudixppecsfxa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_DBHH6ATEA2evTI_L5ejARA_F6k9Wuky` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `host.lavamc.dpdns.org` |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | (optional, see 3b) |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key from step 2c |

**After this first deploy, you never need to send me a zip again** — every
`git push` to this repo redeploys automatically on Vercel.

### Point your domain at it
Vercel → your project → Settings → Domains → add `host.lavamc.dpdns.org`.
Vercel shows a CNAME target (usually `cname.vercel-dns.com`) — add that as
a CNAME record for `host` in dpdns.org's DNS panel.

### Google Search Console
Don't use the "upload an HTML file" verification method — it can clash
with this app's routing. Use **"HTML tag"** instead: Search Console gives
you a code, you put just that code in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
on Vercel and redeploy. `/sitemap.xml` is already built in and lists every
published site automatically — submit that URL in Search Console too.

## 4. Every file, what it's for

```
hosting-platform/
├── README.md                  you're reading it
├── .env.local.example          template for local dev env vars (copy to .env.local)
├── .gitignore                  keeps node_modules/.next/.env.local out of Git
├── jsconfig.json                lets code import things as "@/lib/..." etc.
├── next.config.js               Next.js config (currently just defaults)
├── package.json                 the 3 dependencies this needs: next, react, @supabase/supabase-js, jszip
│
├── public/
│   ├── mark.svg                  the logo (browser window + upload arrow), used in headers
│   └── favicon.svg               same mark on a dark background, used as the browser tab icon
│
├── lib/
│   ├── supabaseClient.js         browser-side Supabase connection (safe to expose - uses the public anon key)
│   ├── supabaseServer.js          server-side helpers: one client that carries a logged-in user's
│   │                              token (keeps Row Level Security working), one plain public client
│   │                              for reading published sites (no login needed to view a site)
│   ├── supabaseAdmin.js           SERVER-ONLY: the service-role client (bypasses all security rules)
│   │                              and requireAdmin(), which checks a request's token belongs to an
│   │                              admin before any /api/admin/* route does anything
│   └── authHelpers.js             small client helpers: turn a typed username into its email for
│                                  login, and generate a random strong password
│
├── app/
│   ├── layout.js                  the outer HTML shell: loads global CSS, Google Fonts, sets the
│   │                              page title/favicon, and (if you set it) the Google Search Console
│   │                              verification tag
│   ├── globals.css                the entire visual design: colors, fonts, buttons, inputs, the
│   │                              admin table, the create-site wizard's modal, availability dots, etc.
│   ├── sitemap.js                 generates /sitemap.xml automatically - lists the homepage plus
│   │                              every published site, for Google to crawl
│   │
│   ├── page.js                    the public homepage/landing page: hero with an animated glow,
│   │                              "Create your site" / "I already have one" buttons, a 3-step
│   │                              "how it works" row, a 3-item features grid (live instantly / your
│   │                              own address / any static site), a "Free plan" pricing-style card
│   │                              ($0 forever, up to 3 sites, zip/folder uploads, custom domain
│   │                              review), a short "why this exists" blurb, and a footer
│   ├── login/page.js               log in with username-or-email + password; link to forgot-password
│   │                              and to sign up (no Google - email/password only)
│   ├── signup/page.js               sign-up form: first/last name, username (checked live as you type -
│   │                              green dot = available, red = taken), email, password (with a
│   │                              "Generate one" button), confirm password
│   ├── forgot-password/page.js      3-step flow: enter username/email → get a 6-digit code by email →
│   │                              type the code → set a new password (and you're logged in)
│   │
│   ├── dashboard/page.js            the main app once logged in: sidebar (your sites, admin link if
│   │                              you're an admin, sign out), a "x / y websites used" counter with
│   │                              the "+ New site" button disabled once you hit your free-plan limit,
│   │                              the 3-step creation wizard (name+description → what you'll upload →
│   │                              pick an address with a live available/taken check - creating a site
│   │                              also auto-generates a starter `index.html` + `style.css` so the
│   │                              address is never empty), and for each site: copy-link, a file
│   │                              manager (upload by single file / folder / zip; checkboxes + bulk
│   │                              "Delete N selected"; click any HTML/CSS/JS/JSON/TXT/SVG/MD filename
│   │                              to edit it in a textarea and "Save & publish" straight back to the
│   │                              live site; a "⋯" per-file menu with Edit / Rename-move / Download /
│   │                              Delete), a "request a custom domain" box, and a site-level "⋯" menu
│   │                              with "Delete site" (asks you to click twice to confirm)
│   │
│   ├── admin/page.js                admin-only panel (redirects anyone else back to /dashboard):
│   │                              a Users tab (every account's email, name, username, how many sites
│   │                              they own next to an editable free-plan limit (type a new number,
│   │                              a "Save" button appears), last sign-in, and a Ban/Unban button -
│   │                              never shows passwords, because Supabase never stores or returns
│   │                              them to anyone, including admins) and a Domain requests tab
│   │                              (approve/reject each custom domain someone asked for)
│   │
│   ├── api/admin/
│   │   ├── users/route.js            server endpoint the admin page calls to list every user, with
│   │   │                            their site count and site_limit (checks you're an admin first,
│   │   │                            then uses the secret service-role key to read Supabase's user
│   │   │                            list - this key never reaches the browser)
│   │   ├── limit/route.js            server endpoint that changes one user's free-plan website limit
│   │   ├── ban/route.js              server endpoint to ban/unban one user
│   │   └── domains/route.js          server endpoint to list and approve/reject custom-domain requests
│   │
│   └── [slug]/[[...path]]/route.js   THE CORE OF THE WHOLE THING: every request that isn't one of
│                                    the pages above (i.e. anyone visiting /someones-site or
│                                    /someones-site/about.html) lands here. It looks up which site
│                                    owns that name, finds the right file in Supabase Storage, counts
│                                    it as a view if it's the site's homepage, and streams the file
│                                    back with the right content type. Shows a "No site here" page
│                                    if the name doesn't exist or isn't published.
```

### Database objects (already created in Supabase, not in this zip)

| Object | What it's for |
|---|---|
| `profiles` table | one row per user: email, display name, first/last name, username, `is_admin`, `is_banned`, `site_limit` (free-plan website cap, default 3, admin-editable) |
| `sites` table | one row per hosted site: owner, address (`subdomain` column), title, description, upload type, `view_count`, custom domain + its approval status |
| `site_files` table | one row per uploaded file: which site it belongs to, its path, where it lives in Storage |
| `reserved_subdomains` table | names nobody can claim (`dashboard`, `admin`, `login`, etc.) |
| `is_subdomain_available(text)` | used by the creation wizard's live green/red check |
| `is_username_available(text)` | used by the sign-up page's live green/red check |
| `email_for_username(text)` | lets someone log in by typing their username instead of email |
| `increment_site_view(uuid)` | bumps a site's view counter without needing owner-level access |
| trigger on sign-up | creates the `profiles` row automatically, and makes the first-ever user an admin |
| trigger on `sites` (reserved names) | rejects any attempt to create/rename a site to a reserved name |
| trigger on `sites` (free-plan limit) | blocks creating a new site once the owner already has `site_limit` of them |

## 5. Known limits / possibly next

- **Custom domains are manually approved, by design** (you asked for this):
  someone requests a domain in their dashboard → it shows "pending" → you
  see it in `/admin` → Approve/Reject. Approving only flips the status
  shown to them - to make it actually resolve, you still add that domain
  in Vercel → Settings → Domains yourself and follow the DNS instructions
  Vercel gives for it. There's no way around that manual step on Vercel's
  free plan (full automation needs their paid Domains API).
- **No real "uptime" or "abuse warning" monitoring.** I didn't add this -
  a trustworthy version needs a real external monitoring/malware-scanning
  service, and faking it would just show numbers that mean nothing. The
  view counter is real and built in, though.
- No per-user storage size limit in the code yet (Supabase's free tier
  itself caps you at 1GB storage / 5GB bandwidth per month). The
  `site_limit` feature caps how many *sites* someone can create, not how
  much they can upload to each one.
