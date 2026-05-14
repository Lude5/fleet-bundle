# References — Primary Competitor Analysis

Design and feature reference for the fashion-finds builder template (Flask + Jinja). Each site was fetched live; where Cloudflare or 404 blocked access, findings are reconstructed from search results, traffic analytics, and what little markup leaked through. Recommendations focus on patterns the template should support natively.

---

## Per-site profiles

### topfits.com

- **Status**: blocked. Both `topfits.com` and `www.topfits.com` return HTTP 403 (Cloudflare bot challenge). Direct content inspection not possible; the rest of this profile is inference from external chatter and the family of sites it ships alongside.
- **Theme**: unconfirmed — community references treat it as a dark-mode hypebeast aggregator in the TopFits / rep-finds genre.
- **Accent colors**: unverified.
- **Typography**: unverified.
- **Layout**: unverified — Cloudflare challenge page only.
- **Product cards**: unverified.
- **Distinctive features**: unverified.
- **Tech stack guess**: Cloudflare in front of an unknown origin. The aggressive 403 (no challenge HTML, just deny) suggests a strict bot-fight rule set, common on SvelteKit/Next.js sites that proxy Vercel through Cloudflare.
- **Affiliate strategy**: unverified.
- **Mobile**: unverified.
- **Steal-worthy**: n/a (treat as a gap — worth asking your brother to load it in a real browser and screenshot before launch).
- **Skip**: Cloudflare bot-fight at "high" — it locks out legitimate scrapers, archive.org, and Claude-style assistants. Use "medium" or whitelist crawlers for your own sites.

### finds.cx

- **Status**: live (HTTP 200).
- **Theme**: light. White / off-white background, default light surface; no dark toggle visible in homepage markup.
- **Accent colors**: blue, sourced from the favicon/logo asset `blue-star-hi.png`. No CSS hex codes leaked into the rendered markup — color tokens are likely in a compiled CSS bundle.
- **Typography**: not exposed in the source excerpt (no Google Fonts `<link>` and no inline `font-family`). Looks system-stack or pre-bundled.
- **Layout**: horizontal top nav with five items — `Home | Finds | Converter | How to Buy | Discord`. Hero is metric-driven: "2,000+ Finds" and "2,233 Active Users" social-proof counters above an "Explore Finds" primary CTA. Layout cadence is hero → counters → converter teaser → KakoBuy giveaway band → footer.
- **Product cards**: visible from the /finds page only as listing references. Each card carries a product image, title, agent button reading "Open in KakoBuy". Hover transitions not exposed in the markup snippets returned.
- **Distinctive features**: dedicated **link converter** route at `/converter` with a paste-and-go input and an "Open in KakoBuy" output button (single-agent target — Kakobuy only). **Promo band** baked into the homepage advertising "$450 in coupons" plus code `Gino` for "$15 OFF". Discord link in primary nav rather than buried in the footer. No QC tool, no weight estimator, no currency switcher, no infinite scroll detected.
- **Tech stack guess**: hard to tell — markup is thin and clean, no `__NEXT_DATA__` or Svelte hydration markers leaked. Best guess is a small SvelteKit or Astro app, or a custom Node/Express+EJS setup; the brevity of the rendered HTML rules out WordPress.
- **Affiliate strategy**: KakoBuy exclusive — every CTA funnels there. Coupon offer is the headline conversion lever ($450 stack + Gino code). Signup CTA appears both in hero and in a dedicated promo band.
- **Mobile**: behavior not confirmed in markup. Five top-nav links is mobile-friendly and likely collapses to a hamburger.
- **Steal-worthy**:
  1. **Metric counters in hero** ("2,000+ Finds / 2,233 Active Users") — instant social proof, easy to fake-but-accurate for a new site.
  2. **Converter as a primary nav item** rather than a footer afterthought — frames the site as a tool, not just a list.
  3. **Discord link in top nav** as a permanent community anchor.
  4. **Single-agent funnel** — fewer choices = higher conversion. Pick one agent per template instance.
- **Skip**: light theme on a streetwear site is a missed opportunity; the audience expects dark. Also skip the "Gino $15 OFF" name-stamp inside the hero copy — it dates fast and looks personal-influencer rather than brand.

### doppel.fit

- **Status**: blocked. Direct fetch returns 403 (Cloudflare). However, SEMrush + search-results metadata give us strong inference: it's a **QC Finder** product-discovery platform with ~931K visits/month (March 2026), 31 pages/visit, 14-minute average session, 23% bounce, 90% direct traffic. German-origin (Germany 21% of audience, then UK / Poland).
- **Theme**: unconfirmed by markup, but engagement metrics (31 pageviews/session) imply a high-density gallery; community lookalikes in this niche are nearly always dark.
- **Accent colors**: unverified.
- **Typography**: unverified.
- **Layout**: inferred — landing page bridges into a **QC photo browser**. The pageviews-per-visit number only makes sense with a gallery + filter + lookup loop (browse → click QC → back → repeat).
- **Product cards**: inferred — image-first, presumably 1:1 or 3:4 square tiles given the QC-photo focus; titles + agent CTA.
- **Distinctive features**: **QC photo finder** is the core product — search by ID/link and surface a gallery of buyer photos. Likely also a link converter and a kakobuy/oopbuy referral pipe (search results explicitly say "after visiting doppel.fit users commonly go to oopbuy.com and kakobuy.com").
- **Tech stack guess**: not visible. Given the visit volume and image-heavy nature, suspect Next.js on Vercel with Cloudflare in front (consistent with the 403 pattern). The `.fit` ccTLD is purely cosmetic, no tech signal.
- **Affiliate strategy**: dual-agent — KakoBuy and Oopbuy are the documented click-out targets. No coupon amount confirmed.
- **Mobile**: unverified.
- **Steal-worthy**:
  1. **QC finder as a first-class tool** — the engagement metrics show this is what keeps people on the site. The Flask template should at minimum stub a `/qc?id=…` route that surfaces QC galleries from the cnfans/kakobuy QC endpoints.
  2. **Two-agent referral pipeline** (primary + fallback) — captures users who already have an account at one.
  3. **EU-first audience strategy** — German/UK/Polish copy options worth supporting in i18n.
- **Skip**: the heavy Cloudflare lockdown — it kills SEO indexability and tooling. SEMrush already shows only 5% organic search traffic, which confirms the cost of that strategy.

### onlyopponent.com

- **Status**: down. Returns HTTP 404 on `/`, `/index.html`, `/shop`, `/products`. The brand is alive on TikTok (@onlyopponent, ~17.5K followers, ~364K likes) and uses `beacons.ai/onlyopponent` as their current landing page. The `.com` itself is either retired or never built.
- **Theme**: n/a — site does not exist.
- **Accent colors**: n/a.
- **Typography**: n/a.
- **Layout**: the active funnel is a Beacons.ai bio-link page driving to a spreadsheet — a creator-led, not site-led, model.
- **Product cards**: n/a.
- **Distinctive features**: n/a from the domain; the **operating model is the lesson** — creator-first, link-in-bio, spreadsheet as the catalog.
- **Tech stack guess**: parked / no origin.
- **Affiliate strategy**: spreadsheet-driven affiliate, distribution via TikTok.
- **Mobile**: n/a.
- **Steal-worthy**:
  1. **Treat the spreadsheet as a fallback / "view all finds" link** — creators in this niche keep coming back to Google Sheets because it indexes well in TikTok bios.
  2. **Linktree-style fallback page** at e.g. `/links` on the template, so the same site can serve as a TikTok bio destination.
- **Skip**: don't rely on the `.com` as a learning reference — it's gone. The brand exists only on TikTok.

### repgalaxy.com

- **Status**: live.
- **Theme**: light. White/neutral background, dark text. No dark-mode toggle observed.
- **Accent colors**: not declared as hex in the visible markup. Visible signal colors include green ("Verified" / discount badges) and the standard agent-button blues. Logo is a `.webp` at 1024×765.
- **Typography**: no Google Fonts `<link>` observed. Default WP/Elementor system stack — Elementor's default is `"Roboto", sans-serif`, very likely in use.
- **Layout**: horizontal sticky nav, six items — `HOME | PRODUCTS | BEST VERSIONS | TOOLS | FAQ | HOW TO` — plus external social row (Discord / TikTok / YouTube / Instagram). Section pattern repeats identical product blocks, then a mid-page "ELEVATE YOUR REP GAME HERE" banner linking to `ikako.vip`, then a coupon band, then footer. Repetition of identical blocks is an Elementor tell.
- **Product cards**: each card shows image, title with colorway count appended (e.g. "Stone Island Jacket (6 Colorways)"), USD price (e.g. `27.12$` — dollar sign trailing, a small but jarring formatting choice), and **two CTAs side-by-side**: `[Buy on Kakobuy]` and `[Buy on CNfans]`. No hover-state CSS surfaced.
- **Distinctive features**: **dual-agent buy buttons per card** (Kakobuy + CNfans) — rare in this set. **Coupon band** with `CODE: ROMANIA 15% OFF` and `Sign up for 410$ Coupons`. **Elementor popup triggers** (`elementor-action` attributes) for at least one offer. Tools page exposes exactly two utilities: **Link Converter** and **Shipping Calculator** (no QC tool, no weight estimator). Affiliate codes embedded as `?affcode=clonesoles` on Weidian→Kakobuy redirects.
- **Tech stack guess**: WordPress + Elementor. The `elementor-action` attribute, the identical repeated section pattern, the webp logo at an Elementor-default aspect, and the `2026` copyright auto-updater all point at it. No `meta generator="WordPress"` leaked in the excerpt but the fingerprints are unmistakable.
- **Affiliate strategy**: dual-agent (Kakobuy primary, CNfans secondary). The `clonesoles` affcode tags every link. Signup CTAs include the mid-page "ELEVATE YOUR REP GAME HERE" banner and the "Sign up for 410$ Coupons" band. Explicit disclaimer that cnfans links are affiliate but earn commission only on the freight-forwarding fee.
- **Mobile**: responsive design is implied but mobile-specific markup not surfaced — likely the default Elementor hamburger.
- **Steal-worthy**:
  1. **Dual buy-buttons per card** — let the user pick their own agent without leaving the card.
  2. **Colorway counts in the title** ("(6 Colorways)") — communicates depth without an extra UI element.
  3. **Affiliate disclosure** stated openly in the footer — good legal hygiene and worth copying verbatim.
  4. **Coupon-amount call-out** ("410$ Coupons") repeated above and below the fold.
- **Skip**: WordPress + Elementor stack — slow, heavy, hard to make distinctive. The repeating identical-section pattern is the tell-tale "made on Elementor" look you want to avoid. Also skip the trailing dollar-sign price format (`27.12$`); use `$27.12`.

### cadenreps.net

- **Status**: live (homepage). Some sub-routes return 404 (e.g. `/qc` is not at that path).
- **Theme**: light. White/off-white surface, dark text. Green "Verified" badges, orange "New" labels are the spotted accent badges; agent buttons use a flat KakoBuy blue.
- **Accent colors**: not declared in inline CSS — bundle-compiled. Inferable palette: white surface, near-black text, green success (`#22c55e`-ish), orange (`#f97316`-ish), KakoBuy blue.
- **Typography**: no Google Fonts `<link>` surfaced; almost certainly bundled with the Next.js app or system stack. The "⌘K" search affordance implies a designer-aware build, so safe bet is `Inter` or `Geist`.
- **Layout**: horizontal top nav. Items: logo, **search input with `⌘K` indicator**, then `Spreadsheet | Finds gallery | QC lookup | Outfits | Sellers`, then a Tools dropdown with favorites + cart icons. Hero shows a "Loading..." state (client-side hydration confirms Next.js). Polish-language footer ("Nie jesteśmy powiązani z Weidian, Taobao, 1688, Tmall…") — Polish-origin operator.
- **Product cards**: image proxied via `/_next/image?url=…&w=1920&q=90&format=webp` (Next.js Image component). Each card carries: product name, USD price, `Category • Batch tier` line, **quality rating 7–9/10**, green "Verified" badge, a "Check more" link to a detail page, and a KakoBuy agent button bearing `?affcode=hago105`.
- **Distinctive features**: **`⌘K` command-palette search** in the nav (extremely strong UX move, rare in this niche). **Quality-score badge** (7–9/10) on every card — quantifies trust at a glance. **Outfits page** (curated flatlays) — sets it apart from a pure spreadsheet aggregator. **Sellers page** ranks the underlying Chinese sellers, not just the agents. Essential-Tools section lists: link converter, agent ranking, parcel tracking, shipping calculator. KakoBuy signup band offers "coupons worth 410 dollars" linking to `ikako.vip/r/hago105`.
- **Tech stack guess**: **Next.js** (confirmed by `/_next/image` and `/_next/static/` paths, plus the client-side "Loading…" hydration state). Likely Tailwind given the design vocabulary and the `⌘K` shortcut. Hosted on Vercel is a reasonable bet.
- **Affiliate strategy**: KakoBuy with affcode `hago105`. Signup CTA pushes "$410 coupons". No secondary agent visible — single-funnel.
- **Mobile**: not confirmed in markup. Given the Tailwind + Next.js stack, expect a hamburger collapse and a responsive grid; the `⌘K` will be replaced by a search icon on touch.
- **Steal-worthy**:
  1. **`⌘K` command-palette search** in the header — fastest implementation pattern is `cmdk` (npm) or a custom Alpine.js modal in Flask.
  2. **Quality score badge** on every card (e.g. "8.5/10") — quantifies opinion, builds trust.
  3. **Outfits + Sellers pages** as separate sections — diversifies the site beyond a flat product grid.
  4. **`Category • Batch tier` micro-line** under the title — packs metadata densely without clutter.
- **Skip**: light theme is still off-genre for streetwear. Also skip a client-rendered "Loading…" hero — if Flask-rendered, ship the data server-side and avoid that flash.

### agentlinks.de

- **Status**: blocked. Returns HTTP 403 (Cloudflare). The `.de` ccTLD and the name suggest a converter-first tool oriented at German EU buyers (parallel to JadeShip / RepSheet's converter tools). No content inspectable.
- **Theme**: unverified.
- **Accent colors**: unverified.
- **Typography**: unverified.
- **Layout**: inferred — a converter-first single-page tool, in the genre of `jadeship.com/converter` and `repsheet.net/tools/link-converter`. Likely: paste-bar → output cards per agent → copy/open buttons.
- **Product cards**: not applicable in the converter-only model.
- **Distinctive features**: inferred to be **bulk link conversion**, **multi-agent output** (one paste → buttons for KakoBuy, CNFans, Sugargoo, Superbuy, etc.), and possibly **affiliate-code rewriting** as the monetization angle. The German positioning suggests **EUR currency display** and German tutorial copy.
- **Tech stack guess**: unverified — Cloudflare hides it. The tool-only feature set fits SvelteKit, Astro, or even a static Vite build on Cloudflare Pages.
- **Affiliate strategy**: inferred to be **multi-agent** (every output button is an affiliate link). Coupon amounts unconfirmed.
- **Mobile**: unverified.
- **Steal-worthy**:
  1. **Multi-agent output cards** — one paste yields a card per agent; user picks. This is the standard converter UX and worth replicating.
  2. **German / EU localization** as a default option — most competitors are US-default; an EU-default template differentiates.
  3. **Converter-as-landing-page** model (skip the product grid for the converter-only template variant).
- **Skip**: ccTLD-only branding limits global reach; if your brother launches an EU-first site, consider buying the matching `.com` too so external links don't fragment.

---

## Cross-site patterns and template recommendations

Across the four sites I could read directly (finds.cx, repgalaxy.com, cadenreps.net, and inference from doppel.fit), the dominant patterns are: (1) **link converter is table stakes** — every live site has one and treats it as a primary nav item, not a footer link; (2) **KakoBuy is the universal primary agent**, with the coupon amount ($410–$450) repeated in 2–3 places on the homepage as the conversion lever; (3) **agent affcode tags** (`affcode=hago105`, `affcode=clonesoles`) are appended to every outbound link, sometimes via a redirect route, sometimes baked in; (4) **Discord is the de-facto community channel** and appears in the top nav, not the footer; (5) the **product card converges on**: image (Next/Image-style proxied webp), title, USD price, agent CTA — with the best-in-class versions (cadenreps) adding `Category • Batch tier`, quality score, and a verified badge. The strongest single UX move spotted is cadenreps' **`⌘K` command palette** in the header — borrow it. The strongest growth move is doppel.fit's **QC finder** keeping users at 31 pages/session — borrow it. The biggest collective miss is **dark mode**: every readable site here is light-themed, which is off-genre for streetwear and a clear differentiator the template should claim. Stack-wise, the modern competitors are on **Next.js + Tailwind** (cadenreps confirmed, doppel/topfits/agentlinks strongly suspected behind Cloudflare); the dated end of the spectrum is **WordPress + Elementor** (repgalaxy) — slower, heavier, and visibly repetitive. For a Flask + Jinja template the moves are clear: ship dark theme by default, a `⌘K` palette, a converter at `/converter` with multi-agent output cards, a QC stub at `/qc`, dual buy-buttons per product card, an `Outfits` page, a Discord link in primary nav, and a coupon-amount band repeated above and below the fold.
