# Master Admin — Client Site Builder

You (Claude Code) are running in **`C:\Users\talan\clients\_master_admin\`**, the control room for Talan's client-website business.

Each client gets their own fashion-finds site that promotes a shopping agent (KakoBuy, JoyaGoo, CNFans, etc.) with the user's affiliate code. Every site is built from the **Kai Finds template** at `..\kai\`.

## What lives in this folder

```
_master_admin/
├── CLAUDE.md            ← this file
├── index.html           ← password-gated dashboard linking to every client admin panel
└── scripts/
    ├── parse_spreadsheet.py   ← Google Sheets → products.json (auto-detects columns)
    └── create_site.py         ← one-shot: clone template, swap config, push to GitHub, deploy on Render
```

Existing client sites live one level up:
```
clients/
├── kai/        ← the template (do not edit casually)
├── jake/       ← Kakobuy.Locker (live)
├── tobey/      ← JoyaFinds (live)
├── john/       ← MrPutYouOnFinds (live)
└── portfolio/  ← landing page
```

---

## The standard workflow ("build me a new site for X")

When the user says **"build me a new site called Acme Finds"** (or similar), run this:

```bash
python scripts/create_site.py \
  --slug acmefinds \
  --name "Acme Finds" \
  --domain acmefinds.com \
  --agent kakobuy \
  --affcode acme \
  --color "#06b6d4" \
  --spreadsheet "https://docs.google.com/spreadsheets/d/..." \
  --push --deploy
```

If the user doesn't give you all of those values, **ask once** for what's missing (or just run `python scripts/create_site.py` with no flags — it prompts interactively).

### What the user has to provide

| Flag             | What it is                                        | Example                       |
|------------------|---------------------------------------------------|-------------------------------|
| `--slug`         | folder + GitHub repo name. lowercase, no spaces   | `acmefinds`                   |
| `--name`         | display name shown on the site                    | `"Acme Finds"`                |
| `--domain`       | the public domain (or `.onrender.com` initially)  | `acmefinds.com`               |
| `--agent`        | shopping agent key (see below)                    | `kakobuy`                     |
| `--affcode`      | affiliate code on that agent                      | `acme`                        |
| `--color`        | brand hex color                                   | `"#ef4444"` (red)             |
| `--spreadsheet`  | (optional) Google Sheets URL of their products    | `https://docs.google.com/...` |
| `--pixel`        | (optional) Meta Pixel ID                          | `123456789`                   |
| `--push`         | create GitHub repo and push                       |                               |
| `--deploy`       | create Render service (requires API key — below)  |                               |

### Supported agents (`--agent`)

`kakobuy`, `joyagoo`, `cnfans`, `sugargoo`, `oopbuy`, `allchinabuy`, `mulebuy`, `hoobuy`

These are pre-wired with the correct signup-URL + product-URL formats. If the client needs a different agent, edit `AGENT_PRESETS` in `scripts/create_site.py`.

### Render deployment

`--deploy` needs two env vars set on **your** PC before running:

```bash
export RENDER_API_KEY=rnd_xxxxxxxxxxxx
export RENDER_OWNER_ID=tea_xxxxxxxxxxxx
```

(Render → Account Settings → API Keys. Owner ID is on the team page URL.)

Without `--deploy`, the script still creates the GitHub repo (with `--push`). The user can then connect the repo on Render manually in 30 seconds.

---

## After the site is created

The script prints the **admin password** at the end. Save it. Then:

1. **Test locally first**:  `cd ..\<slug> && python app.py` → opens `http://localhost:5000`
2. **First Render deploy takes ~5 min.** Live URL = `https://<slug>.onrender.com`
3. **Add the domain in Render**:  Dashboard → Service → Settings → Custom Domains → add `acmefinds.com` + `www.acmefinds.com`
4. **Namecheap DNS**:  Add a CNAME → `<slug>.onrender.com`. Tell the user the DNS records to paste; do **not** touch their Namecheap account.
5. **Update the master dashboard** (`index.html`):  add a new site card so the user has one-click access. Copy an existing card and swap the slug, password, and URLs.

---

## Updating an existing site

```bash
cd ..\<slug>
# make your edits…
git add -A && git commit -m "your message" && git push
```

Render auto-deploys on push (unless auto-deploy was disabled — check Settings).

Env vars (admin password, Meta Pixel, affiliate code, etc.) live in Render → Environment, **not** in the repo. Never commit a `.env`. The `.env.example` file in each site folder is the canonical list.

---

## Importing products from a spreadsheet

The spreadsheet parser auto-detects columns by scoring (no header config needed):

```bash
python scripts/parse_spreadsheet.py \
  "https://docs.google.com/spreadsheets/d/..." \
  ..\<slug>\static\products.json
```

It looks for:
- **name**: long text, not a URL
- **link**: hyperlinks or `http://...item...` URLs
- **price**: `$...` (USD) or `¥.../CNY` (gets converted at `--cny-rate`, default 6.5)
- **image**: `=IMAGE(...)` formulas or `.jpg/.png/.webp` URLs

Sheet names get mapped to categories (e.g. a sheet called "Shoes" → category `shoes`, "Trending Finds" → `trending`). Edit `sheet_cat_map` in `parse_spreadsheet.py` to add more.

After importing, the next request to the site triggers DB reload from `products.json`. Or restart the Render service.

---

## Common asks and how to handle them

**"Change the affiliate code on Acme Finds to xyz"**
→ Render dashboard → service → Environment → change `AFFILIATE_CODE` and `AGENT_SIGNUP_URL` (which contains the code). Save = auto-redeploys.

**"Add 50 more products to Acme Finds"**
→ Get the Google Sheets URL → run `parse_spreadsheet.py` → push the new `products.json`.

**"The Meta Pixel isn't firing"**
→ Check `META_PIXEL_ID` is set in Render env. Then verify by opening the site with the Meta Pixel Helper Chrome extension. Buy clicks fire `ViewContent`, signup clicks fire `Lead`.

**"Change the brand color"**
→ Edit `BRAND_COLOR` in Render env (e.g. `#ef4444` for red). The whole CSS theme switches via CSS variables in `base.html`.

**"I want to add a new page"**
→ Add a route in `app.py`, a template in `templates/`, link it in `base.html` nav. Keep it `{{ site.* }}` driven so it works across every site built from the template.

---

## Things to NOT do

- Don't edit `..\kai\` casually — it's the template. Anything you change there gets copied to every future site.
- Don't commit `.env`, `data/`, or `*.db` files.
- Don't push to a client repo without testing locally first.
- Don't manually edit `products.json` for big changes — use `parse_spreadsheet.py`.
- Don't bypass the Render API for new sites — the script sets all the env vars correctly in one shot.
- Don't add Render auto-deploy back if it was disabled. (It got disabled because deploys kill in-flight background scraping threads — that's intentional.)
- Don't `git push --force` to a client repo. Ever.

---

## Where to find things

- **Live admin panels**: every site has `/admin` (password = whatever's in `index.html` for that card).
- **Analytics**: `/admin/analytics` on each site — clicks, conversions, top products.
- **Database backup**: `/admin/backup/download` returns the SQLite file.
- **Render logs**: Dashboard → service → Logs. Or `https://api.render.com/v1/logs?ownerId=<>&resource=srv-<>` with API key.
- **Other PC's backup**: see `memory/reference_other_pc.md` in Talan's user memory.
