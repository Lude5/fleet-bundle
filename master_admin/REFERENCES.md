# Reference Sites — Design & Feature Bible

This is the design source-of-truth for building new fashion-finds sites from the Kai Finds template. It synthesizes detailed research across **17 competitor sites** into actionable patterns, plus links to deep-dive files and screenshot galleries.

**Last refreshed:** 2026-05-11

---

## Files in this folder

| File | What it has | When to use |
|---|---|---|
| `REFERENCES.md` *(this file)* | Executive summary, cross-site patterns, top features to port | Default entry point |
| `references_playwright.md` | Deep Playwright pass on 16 sites with computed styles + screenshots | Need exact hex/font/CSS values |
| `references_other.md` | Playwright deep-dive on findsbymase, s1ckfit, trentinfinds, theqcbook | Need stack/affiliate strategy detail |
| `references_primary.md` | WebFetch analysis on topfits, finds.cx, doppel.fit, repgalaxy, cadenreps, agentlinks | Need business-strategy context |
| `references_competitors.md` | Tool-landscape analysis: jadeship, repsheet, weidianrep, w2crep, gotfinds, findqc, plug4 | Need feature-engineering ideas |
| `references/screenshots/{site-slug}/*.png` | 33 screenshots across 16 site folders | Visual reference |

---

## TL;DR — the 10 things to actually port

Ranked by ROI for a Flask + Jinja template. Numbers in brackets ≈ days of work.

1. **`⌘K` command palette** *(cadenreps)* — modal with fuzzy search over products, categories, tools. Single biggest "feels-like-a-product" upgrade. **[1d]**
2. **Multi-agent picker per product** *(theqcbook, w2crep)* — one product, user-selectable agent switcher (8 agents on theqcbook). Rewrites affiliate URL server-side. Breaks "site per agent" lock-in. **[1d]**
3. **Quality-tier badge system: BUDGET / TOP / 1:1** *(theqcbook)* — filterable badge taxonomy. **No competitor has this.** Killer differentiator. **[0.5d]**
4. **Dual-currency inline display** *(finds.cx)* — render `$59.85, ¥430.92` on every card. Sidesteps the switcher entirely (or supplements it). **[2h]**
5. **Variant-stack pill on cards** *(doppel.fit)* — `+N variants` count + 2 overlapping mini-thumbs, `backdrop-filter: blur(8px)`. Density signal without clutter. **[3h]**
6. **Tools-hub page** *(agentlinks + repsheet + jadeship)* — `/tools` index with Track, Convert, Weight Estimate, QC, Coupons as separate one-job pages. **[1d for scaffolds]**
7. **Live Feed / Wishlist Feed** *(jadeship)* — `Activity` model + timestamped recent-activity stream on home. Gives the site a heartbeat. **[2d]**
8. **Onboarding modal capturing currency + agent preference** *(theqcbook, findsbymase)* — one-time interstitial. Saves to localStorage; rewrites every buy-button thereafter. **[0.5d]**
9. **Mobile bottom bar with `safe-area-inset`** *(theqcbook)* — Home / Reviews / Favorites / Account fixed bottom row, iOS-friendly. App-feel on phones. **[0.5d]**
10. **Weight estimator** *(repsheet)* — category-based avg-grams table + multi-add cart + kg/lbs output. Real pre-purchase pain point. **[1d]**

### Bonus longer-term ports

- **Karma / reputation score on cards** *(findqc)* — brand differentiator
- **Coupons aggregator page** *(plug4)* — high-conversion content
- **Browser extension companion** *(plug4)* — 20 KiB Manifest V3 content script that injects QC + price-compare buttons on agent product pages
- **Image proxy with `?w=&q=&format=webp`** *(cadenreps)* — Pillow-based Flask route
- **Seller directory** *(jadeship `/sellers`)* — tag + marketplace filters, contact rows. SEO + trust signal.
- **Reverse image search** via CLIP embeddings *(findqc)*

---

## Universal patterns (every readable site does these)

| Pattern | Why it matters |
|---|---|
| **Dark theme dominates** primary finds sites (12/16). Tools/utility sites skew light. | Our template defaults to dark — matches genre. |
| **`Inter` is the most-used webfont** (8 of 16). Then DM Sans, Instrument Sans, Outfit. | Default to Inter unless brand requires display font. |
| **Discord link in top nav** — 11 of 16. Never in footer alone. | Our floating side widget + nav placement is correct. |
| **Link converter is table stakes** — 11 of 16. Treated as primary nav item, not footer. | Already in our template. |
| **KakoBuy is the universal primary agent**, $410–$450 coupon repeated 2-3× per homepage. | Already config-driven. |
| **Category strip / pills** on home — universal. | Already in our template. |
| **Affcode tags appended to every outbound link** — `affcode=hago105`, `?ref=...`. | Already done via `/go/<id>` redirect. |
| **Product card converges on**: image (proxied WebP) + title + USD price + agent CTA. | Match. |

---

## Polarizing patterns (split ~50/50)

- **Tools tab vs distributed tools** — half collect under `/tools/...` (agentlinks, repsheet, jadeship), half treat converter as standalone (topfits, finds.cx).
- **Currency switcher vs inline dual-currency** — half have switchers, half render both inline (finds.cx, topfits).
- **Light vs dark theme** — 12 dark, 4 light. Light skews "fashion-editorial," dark skews "rep/streetwear."
- **Affiliate signup as nav CTA** — ~5 have a "Sign Up" button in nav (repsheet's "KakoBuy Register"); rest hide affiliate links inside product buy buttons.

---

## Unique-to-one-site features (the differentiators)

| Site | Unique thing |
|---|---|
| **cadenreps.net** | `⌘K` command palette |
| **topfits.com** | Visual search by image upload |
| **doppel.fit** | Auto-cross-fade variant images on idle product cards |
| **findqc.com** | Karma Index (reputation score per item) |
| **agentlinks.de** | Package tracking tool by tracking number |
| **plug4.me** | Named-user profile concept ("Plug4lio") + Coupons aggregator |
| **jadeship.com** | Live Feed + public Wishlist Feed |
| **trentinfinds.com** | Bracket-numbered nav (`[01]`, `[02]`, `[04]`) |
| **s1ckfit.com** | Leads with YouTube embeds as hero content |
| **repsheet.net** | h1 over 150px (literally 160px) |
| **theqcbook.com** | Serif h1 (system serif, editorial framing), 3D book intro, multi-agent switcher in nav |

---

## What to deliberately NOT copy

- **All-monochrome white pages** with zero accent (off-genre for streetwear)
- **Ultra-saturated red `#ff1f1f`** everywhere
- **Gigantic immovable hero type** that breaks on tablets
- **Empty placeholder "QC Pictures / Reviews"** sections that look unfinished
- **Light theme** for sites pitching to streetwear/rep audience
- **WordPress + Elementor** stack (repgalaxy) — slow, heavy, visibly repetitive
- **Client-rendered "Loading…" hero** — ship data server-side
- **ccTLD-only branding** (agentlinks.de) without matching `.com` — fragments external links
- **Dual desktop/mobile templates** — one responsive template is enough
- **"100k items" claims** you can't back up
- **3D book intro adding 2s friction** before any product (theqcbook, gorgeous but kills cold paid traffic)
- **System font stack** (`Segoe UI`, `ui-sans-serif`) — too utilitarian

---

## Stack hints across the field

| Stack | Sites | Telltales |
|---|---|---|
| **Next.js + Tailwind** | cadenreps (confirmed), s1ckfit, trentinfinds, topfits/doppel/agentlinks (strongly suspected behind Cloudflare) | `__NEXT_DATA__`, `/_next/`, `next/image` |
| **Vite SPA + Tailwind v4** | findsbymase, theqcbook | hashed bundle, `var(--qc-*)` tokens, `bg-[var(--...)]` arbitrary values |
| **WordPress + Elementor** | repgalaxy | `elementor-action` attrs, repeated-section pattern |
| **Supabase storage for images** | s1ckfit, trentinfinds, theqcbook | `*.supabase.co/storage/v1/object/public/` paths |
| **Prismic CMS** | s1ckfit | Prismic asset hosts |
| **Self-built API** | findsbymase | API subdomain |

For our Flask template we're already in a good spot — SQLite + WebP via Pillow gives us the same UX without the framework overhead.

---

## Per-site quick lookup table

| Site | Status | Theme | Killer feature | Deep file |
|---|---|---|---|---|
| topfits.com | live (8s CF wait) | dark | Visual search by image | `references_playwright.md`, `references_primary.md` |
| finds.cx | live | dark | Dual-currency inline | `references_playwright.md`, `references_primary.md` |
| doppel.fit | live | light | Auto-cross-fade variant images | `references_playwright.md`, `references_primary.md` |
| repgalaxy.com | live | mixed | Dual CTA per product (KakoBuy + CNFans) | `references_playwright.md`, `references_primary.md` |
| cadenreps.net | live | dark | `⌘K` command palette | `references_playwright.md`, `references_primary.md` |
| agentlinks.de | live | — | Package tracking tool | `references_playwright.md`, `references_primary.md` |
| onlyopponent.com | **404** (now TikTok-only via beacons.ai) | — | — | `references_primary.md` |
| findsbymase.com | live | dark+red | `$500 coupon` onboarding modal | `references_playwright.md`, `references_other.md` |
| s1ckfit.com | live | light | YouTube embed hero, MuleBuy-locked | `references_playwright.md`, `references_other.md` |
| trentinfinds.com | live | light | Bracket-numbered nav | `references_playwright.md`, `references_other.md` |
| theqcbook.com | live | light editorial | Multi-agent switcher, BUDGET/TOP/1:1 tiers | `references_playwright.md`, `references_other.md` |
| jadeship.com | live | dark | Live Feed + Wishlist Feed | `references_playwright.md`, `references_competitors.md` |
| repsheet.net | live | dark | Weight estimator | `references_playwright.md`, `references_competitors.md` |
| weidianrep.com | live | mixed | 5k+ QC photo catalog | `references_playwright.md`, `references_competitors.md` |
| w2crep.com | live | light | Multi-agent picker modal | `references_playwright.md`, `references_competitors.md` |
| gotfinds.net | **SSL cert invalid + timeout** | — | (inferred: dead-link checker) | `references_competitors.md` |
| findqc.com | live | mixed | Karma Index, AI/CLIP search | `references_playwright.md`, `references_competitors.md` |
| plug4.me | live | dark purple | Chrome extension companion, Plug4lio profiles, coupons | `references_playwright.md`, `references_competitors.md` |

---

## Concrete priorities for the Flask template

Reading our current state vs the field:

### Already shipped in Kai Finds template ✅
- Dark theme default
- Link converter at `/link-converter` (in primary nav)
- KakoBuy-default with config-swappable agent
- Affcode appended via `/go/<id>` redirect
- Product card: image + title + USD price + agent CTA
- Discord link in floating side widget (when configured)
- Tutorial page at `/tutorial` (5-step how-to-buy)
- Currency switcher (USD/CNY/EUR/GBP/CAD)
- Auto-generated tags + token fuzzy search
- Featured-pin + drag-reorder admin

### Highest-ROI next adds (matches "10 things to port" above)
1. **`⌘K` command palette** — biggest single feel-of-product upgrade
2. **Quality-tier badge system (BUDGET / TOP / 1:1)** — differentiator, no competitor has it
3. **Multi-agent picker on each product** — break the "one-site-per-agent" model
4. **Variant-stack pill on cards** — density signal
5. **Live Feed page** — heartbeat for SEO and returning visitors

### Watch list (do later)
- Tools-hub page (Track, Weight, QC, Coupons)
- Onboarding modal (currency + agent)
- Mobile bottom bar
- Browser extension companion
- Karma score on cards

---

## How to use this with Claude Code

When working on a new site, paste into chat:
> "Look at REFERENCES.md and steal the X pattern from {site-slug}."

Claude will read this doc, find the screenshot folder, and either copy the layout from `references_playwright.md` or open the screenshot to see the visual.

For visual comparison: every site has at least one screenshot under `references/screenshots/{site-slug}/`. Open them side-by-side with your in-progress design.
