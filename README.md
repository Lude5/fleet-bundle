# Fleet Bundle

A single Render Web Service that hosts the **master admin control plane** plus every **template site** under one URL. Used to show Talan and Mimi big updates without deploying each site to its own Render service.

## Mounted apps

| Path | App | Purpose |
|---|---|---|
| `/` | `master_admin` | Control plane: dashboard, sites registry, products, analytics, template Studio |
| `/kai/` | `kai` | Canonical streetwear template (cyan, dark) |
| `/maywood/` | `maywood` | Refined editorial template (teal, light, serif italic) |

The live production sites (jake, tobey, john, reptools) stay on **their own** Render services — this bundle is for templates kaiom is building.

## Local development

```bash
pip install -r requirements.txt
python wsgi.py            # serves the bundle at http://localhost:5000
```

- Master admin: <http://localhost:5000/> (password: `lude2026`)
- Kai template: <http://localhost:5000/kai/>
- Maywood template: <http://localhost:5000/maywood/>

## How sub-mounting works

`wsgi.py` uses `werkzeug.middleware.dispatcher.DispatcherMiddleware` to mount each Flask app at a path prefix. A small `URLPrefixMiddleware` then rewrites root-relative URLs (`/static/...`, `/api/...`, `href="/..."`) in HTML/JS responses so links and fetches resolve to the right sub-app.

Each subapp keeps its own SQLite at `/var/data/<slug>/site.db` (or `./data/<slug>/` locally).

## Deployment

- **Hosted on Render.** See `render.yaml` for full config.
- **Plan**: Starter ($7/mo) for persistent disk + 512 MB RAM.
- **Auto-deploy is OFF.** Pushing to GitHub will NOT trigger a deploy. Trigger manually in the Render dashboard or via the Render API when ready.

## Updating

When you (kaiom) make changes in `C:\Users\kaiom\clients\<slug>\`:

1. Sync changes into the bundle: copy the relevant subfolder into `_fleet_bundle/<slug>/`
2. Commit and push to GitHub
3. Manually trigger a Render deploy (Render dashboard → service → "Deploy latest commit")

Or ask Claude: "deploy the latest changes to the bundle".

## Things to NOT do

- **Don't host live sites here.** jake / tobey / john / reptools have their own Render services and live URLs (kakobuy.locker, joyafinds.onrender.com, etc.). Bundling them would break those URLs.
- **Don't enable autoDeploy.** Manual deploys are the entire point.
- **Don't commit `.env` or any `*.db` files.** See `.gitignore`.
