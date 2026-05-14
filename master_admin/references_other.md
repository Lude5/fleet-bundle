# Competitor Reference: 4 Fashion-Finds Sites

Date analyzed: 2026-05-11
Method: Playwright DOM inspection + computed styles (WebFetch returned static HTML only / 403 for findsbymase, so live JS-rendered DOM was scraped instead).

---

## Site Profiles

### findsbymase.com
- **Status**: live (WebFetch hit 403; bypassed with headless browser).
- **Theme**: dark. Primary background `#070707` (CSS var `--bg`). Surface `#1a1a1a` (`--surface-3`). Borders `rgba(255,255,255,0.14)`.
- **Accent colors**: aggressive red — primary `#ff1f1f` (`--red`), deep accent `#c70000` (`--red-2`), soft halo `rgba(255,31,31,.18)` (`--red-soft`). White-glow shadow `0 0 22px 2px rgba(255,255,255,.25)`.
- **Typography**: body is Inter via Tailwind's system stack (no Google Fonts request — likely self-hosted/system). Font Awesome 6 Free + Brands for icons (`--fa-font-regular`, `--fa-font-brands`). Sizing scale uses CSS vars `--fs-20`, `--fs-40` etc.
- **Layout**: sticky glassmorphism header — `header.nb.nb--in` with `position:sticky`, `background:rgba(7,7,7,0.72)`, `backdrop-filter:blur(12px)`. Container max-width `1440px` (`--container-wide`). Right-side icon row (Discord, TikTok, YouTube) plus red CTA button (`nb__btn--danger`). Mobile uses an off-canvas drawer (`nbDrawer__panel` with backdrop).
- **Product cards**: `<article class="pcCard">` with a `pcCard__inner`, animated `pcShine` overlay (staggered `animation-delay` per card), `pcMedia` image block, two top badges (`pcBadge` for category, `pcBadge--sub` for subcategory like "+1 sub"). Body shows `pcTitle` + `pcPrice`, action row with `pcBtn pcBtn--primary` ("Buy") and `pcBtn pcBtn--ghost` ("Details"). Image aspect is roughly 4:3 / variable — not strictly square.
- **Distinctive features**:
  - Onboarding modal (`ppOverlay isOpen` → `ppCard`) on first visit: "$500 coupon" pitch + currency selector (USD/EUR/GBP/CAD/AUD/CNY). Saves preference and never shows again.
  - Currency switcher persisted globally (class `currency-selector`).
  - "ARCHIVE SPREADSHEET" vs "OG SPREADSHEET" toggle — two product universes.
  - In-grid filters: category strip (All / T-shirts / Hoodies / Shoes / Pants / Misc / Jackets / Jewelry), price min/max range, "Load more" pagination button.
  - Item count badge ("2,440 items") next to filter bar.
  - Discord/TikTok/YouTube icon row baked into nav.
- **Tech stack guess**: **Vite-bundled SPA** (single hashed bundle `/assets/index-Dfkvbt-R.js`), not Next/Nuxt/SvelteKit. API on subdomain `api.findsbymase.com` returning JSON product data. Cloudflare in front (`beacon.min.js`). Meta Pixel + GA4 + GTM all live.
- **Affiliate strategy**: **Kakobuy only**. Single sign-up link `kakobuy.com/register/?affcode=bymase`. Pitched as "up to $500 coupon" in the onboarding popup. Pure shilling — no individual product affiliate IDs visible.
- **Mobile**: header collapses to brand + hamburger (`nb__menuBtn` with `fa-bars`). Drawer slides in with backdrop + same nav items stacked.
- **Steal-worthy**:
  1. The `pcCard` shine sweep — staggered `animation-delay` on each card on grid render creates a luxury reveal.
  2. First-visit modal that pairs the affiliate CTA with the currency selector — kills two onboarding birds at once.
  3. Dual spreadsheet toggle (Archive vs OG) — easy way to organize a growing catalog without exploding the filter UI.
  4. Sub-category badge (`+1 sub`) hint that a card has variants without cluttering the title.
- **Skip**: the heavy red `--red #ff1f1f` everywhere — it screams "sale site" and lowers perceived premium. Also avoid the multi-step onboarding overlay on every fresh visitor; can hurt SEO bounce signals.

### s1ckfit.com
- **Status**: live.
- **Theme**: light. Body background `#ffffff`, text `#000000`. No dark mode.
- **Accent colors**: no custom CSS variables — straight black/white minimal palette. Subtle gray dividers, no brand color.
- **Typography**: custom display font `unica77` (loaded via Next.js font CSS, class `__variable_fc9a06` + `fonts-loaded` on `<html>`). No Google Fonts.
- **Layout**: top nav class `navigation__wrapper` with social icons (TikTok, Instagram, MuleBuy logo, YouTube) — not sticky. Page is single-column: hero/logo banner → "Latest Videos" YouTube grid → email signup → "Featured Categories" section (Tops / Bottoms / Brands) each with a 4-up product grid and "View All →" link.
- **Product cards**: CSS-Modules pattern (`FeaturedProducts_productCard__NphLO`). `productImageContainer` wraps a `productImage`; below sits `productInfo` with `productTitle` and `productPrice` (CAD format like `C$75.35`). No badges, no hover state visible in markup. Image is 300x300 (square).
- **Distinctive features**:
  - YouTube videos grid pulling latest uploads with thumbnails + dates (`youtube-videos_videoCard__oSnE6`). Doubles as content + social proof.
  - Email newsletter signup (`EmailSignup_emailSignup__O0xt1`).
  - Platform tag on each product link (`platform=TAOBAO`, `platform=WEIDIAN`, `ALI_1688`) appended to the affiliate URL.
- **Tech stack guess**: **Next.js (App Router)**. `/_next/static/chunks/app/layout-…`, `app/page-…`, Vercel Insights script. CMS is **Prismic** (`images.prismic.io/bdf-s1ckfit/...`). Image optimization via `next/image`.
- **Affiliate strategy**: **MuleBuy only**. Affiliate code `ref=200649928` (and second `ref=200272230` chained on product URLs). CTA: "Sign up for MuleBuy here!" in nav row. No coupon amount surfaced.
- **Mobile**: didn't fully test, but the CSS-module class naming doesn't expose a bottom-bar pattern; navigation likely just stacks.
- **Steal-worthy**:
  1. YouTube grid as the secondary hero — directly leverages the creator's social channels as content for the site, low maintenance.
  2. Three category sections on the home page (Tops/Bottoms/Brands), each with 4 products and a "View All" link — clean discovery scaffold instead of one giant grid.
  3. Platform-tag query string on every affiliate URL — useful for downstream analytics and showing source on the product detail page.
- **Skip**: the bare white aesthetic with zero color is forgettable; in a sea of fashion sites it doesn't stand out. Also the homepage hero is literally just a giant logo PNG — no real value proposition above the fold.

### trentinfinds.com
- **Status**: live.
- **Theme**: light. Background `#ffffff`, text `#000000`. Editorial/magazine vibe.
- **Accent colors**: pure monochrome — black-to-gray-600 gradient on the H1 (`bg-gradient-to-r from-black via-gray-600 to-black bg-clip-text` with animated `bg-[length:200%_auto]`). No color accents. Subtle background squares + grid pattern at `opacity-[0.02]`.
- **Typography**: Inter, Tailwind system stack — `font-sans antialiased` on body. H1 is `128px` (text-9xl) "Trentin's Finds" with letter-tracking-tight. All-caps `text-[11px]` nav labels with `tracking-wider`.
- **Layout**: fixed-top white nav (`fixed top-0 left-0 w-full bg-white border-b border-gray-200 z-40`), three uppercase links: SPREADSHEET / OUTFITS / HOW TO BUY. Hero is full-viewport (`h-screen relative bg-white overflow-hidden pt-16`) with giant title, "SAVE MONEY, DRESS BETTER" tagline, dual CTAs (BROWSE PRODUCTS + SIGN UP FOR $400), animated SCROLL indicator. Then a "RECENT HAUL" horizontal marquee ("11 NEW ITEMS / $554.62 TOTAL VALUE") with all 11 products scrolling. Followed by "POPULAR ITEMS" carousel, "Categories" pill grid, "SHOP BY OUTFITS" curated bundles.
- **Product cards**: simple `<a>` wrapping a Next/Image (160x160 or 160x213 ratio, mixed). Title above price below. The card-level class is `group block` with `group-active:text-gray-500` for tap states. CTA wording: "SHOP NOW" in all caps.
- **Distinctive features**:
  - "RECENT HAUL" feature: a single bundled drop with item count + total value. Frames the catalog like an editor's column.
  - "SHOP BY OUTFITS" — pre-curated multi-item looks (e.g. "Balenciaga Pants — 4 items — $354.17"). Strong differentiator vs spreadsheet-only sites.
  - Decorative grid/dot/rotated shape background (`bg-[linear-gradient(to_right,#000000_1px,transparent_1px),...] bg-[size:4rem_4rem]`).
  - Numbered nav items in drawer ([01] Spreadsheet, [02] Outfits, [04] How to Buy) — editorial issue feel.
  - Animated gradient text reveal + `animate-fade-in-up-delay-1/2` staged hero entrance.
- **Tech stack guess**: **Next.js App Router** on Vercel (`dpl_BdLGsqez6VkgVVJXupMjFZie3TKs` deployment ID in script URLs). Data on **Supabase** (`nogkfcsbkbpilgiwjkxv.supabase.co/storage/v1/object/public`). Tailwind utility classes everywhere — no custom design tokens.
- **Affiliate strategy**: **MuleBuy only**. Affiliate code `ref=200654729`. CTA: "SIGN UP FOR $400" (doubled in DOM, possibly a label swap animation). Per-product URLs include `platform=TAOBAO` / `ALI_1688`.
- **Mobile**: mobile menu is a **full-screen slide-in panel** (`fixed inset-0 bg-white z-[99999] md:hidden ... translate-x-full`) with numbered items, social icons, decorative dividers. No bottom bar.
- **Steal-worthy**:
  1. Editorial "RECENT HAUL" framing with item count + cumulative value — gives the site cadence and reasons to return.
  2. Outfit bundles as a top-level browse mode separate from the spreadsheet — solves the "I want a complete look" intent that flat product grids ignore.
  3. Animated gradient title + decorative subtle grid background — high taste-level for near-zero CSS cost.
  4. Numbered, editorial menu items ([01]…[04]) on mobile — feels like a magazine issue rather than an e-commerce nav.
- **Skip**: the 128px H1 is gorgeous on desktop but pushes everything below the fold on tablet; reconsider clamp(). Also the doubled "SIGN UP FOR $400" text node looks like a bug, not a feature.

### theqcbook.com
- **Status**: live (intro is a full-screen "book" agent picker — actual catalog hidden behind the first click).
- **Theme**: light, warm-paper. Body `#fafaf8` (`--qc-surface`), text `#111` (`--qc-text`), card `#f3f3f0` (`--qc-card`), border `#ececea`. Optional **dark mode** toggle in the header. Editorial book-design aesthetic.
- **Accent colors**: high-contrast black `--qc-contrast` on the surface paper. Discord-purple CTA `--qc-discord` for "Sign in" (with `--qc-discord-hover`). Subtle line color `#11111114`. Tier badges use semantic colors: green `#2d6a4f` (`--qc-success-bg-strong`), and the BUDGET/TOP/1:1 chips are visually distinct but use neutral surfaces with text differentiation.
- **Typography**: **DM Sans** (sans body, 400/500/600/700) + **Instrument Serif** (italic display) — loaded from Google Fonts in a single `css2?family=` request. Mono fallback is system mono for catalog numbers ("001", "002", "VOL. 1 — 2026"). Headings are `font-serif italic` — distinctive.
- **Layout**: opens with a **3D book intro** (`perspective:2000px; rotateX(5deg) rotateY(-15deg)` on a wrapper with two cover panels, spine, and texture overlay from Unsplash). User picks one of 8 agents (USFans/Hipobuy/AllChinaBuy/Kakobuy/LitBuy/BBDBuy/LoveGoBuy/OopBuy). After that, sticky transparent header at `z-[55]` with progress-scroll bar at `z-[56]`. Nav: Catalog / Reviews / Guide pills, plus `$ · EN` currency-language combo button, dark-mode toggle, agent dropdown, Discord-purple "Sign in" button. Below: a horizontal category strip (All / Shoes / Clothing / Bags / Watches / Jewelry / Accessories / Electronics / Home & Lifestyle). Hero: serif italic headline "Find the best version faster" + search input. Sections: Trending → New arrivals → Explore → "QCBOOK METHOD" pillar explainer → Current Selections.
- **Product cards** (catalog grid): aspect `1/0.85`, `object-contain` on `bg-[var(--qc-card)]`, hover zoom `scale-[1.04]` with `cubic-bezier(0.22,1,0.36,1)` ease. Top-left/bottom-left **quality-tier badges** (`BUDGET` / `TOP` / `1:1`) stacked, plus contextual chips `TREND` / `NEW`. Title in serif. Color count ("23 colors") above price. Price is a **range** when variants exist: `$35.20–$60.20`. "Quick View" button bottom of each card. Horizontal snap-scrolling carousels (`flex snap-x snap-mandatory gap-3 overflow-x-auto`) for Trending / New / Explore.

#### QCBook-specific: QC galleries, lightbox, measurements (deep dive)
- **Product detail page** (`/product/:id`) layout: two-column grid `grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-12` — left is the **zoom-on-click image** in a rounded card `rounded-2xl bg-[var(--qc-card)] p-3 sm:p-8 lg:p-10`, with a hover-revealed "Click to zoom" pill (`bg-[var(--qc-card)]/80 backdrop-blur-sm` at bottom-right). Class `group/zoom relative cursor-zoom-in overflow-hidden`. Floating top-corner controls (`absolute right-4 top-4` / `left-4 top-4`) are 40x40 rounded-xl icon buttons — likely heart/share/back.
- **Variant gallery**: thumbnail strip below the title, `flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2`. Each thumb is `h-11 w-11 sm:h-14 sm:w-14` rounded-lg with a 2px border that turns into `border-[var(--qc-contrast)] shadow-sm` for the active variant. There is a `+N` overflow button (`flex h-11 w-11 ... border-dashed`) that opens the full variant list. Variant images live at the pattern `…/products/{id}/{index}.webp` — so up to N sub-images per product (saw 7 variants on Fear of God Shorts: `/0.webp` through `/6.webp`).
- **QC pictures section**: separate header "QC Pictures" with an empty state card (`flex flex-col items-center rounded-xl bg-[var(--qc-card)] px-6 py-10`) reading "No QC yet — QC pictures will be available soon." So the **section exists as a slot** even when empty — the structure is there waiting for user-uploaded QC photos.
- **Reviews section**: also empty-state by default, with "Write a review" button and a dashed-border empty card ("No reviews yet — Be the first to share your QC experience"). Reviews are explicitly framed as **QC experiences** — i.e. users post their own QC photos when they share reviews. That's the ingestion mechanism for the QC photo corpus.
- **Quality tiers**: pillar block "BUDGET / TOP / 1:1" defined as: BUDGET = "Best quality at a low price", TOP = "The highest quality possible", 1:1 = "Exactly authentic, same as retail". These tiers are filterable and shown as stacked badges on every product card. **This is the entire content differentiator** — they curate by tier, not just by item.
- **Scale / measurement tools**: none visible. The site does **not** show a weight estimator, ruler overlay, or dimension table — surprising given the "QC" name. Sizes appear as a simple list ("COLOR / Main / +9" pattern); no per-batch comparison or measurement gallery.
- **Search**: a single text input below the hero with "Find the best version faster". Category strip serves as primary filter. No advanced filter drawer visible on home/catalog; tier toggles likely live elsewhere.

- **Distinctive features (overall)**:
  - **3D book intro** as a brand moment — agent picker doubles as onboarding/preference capture, like findsbymase but executed with far more design ambition.
  - **Agent switcher persists in nav** as a dropdown — affiliate URL rewrites server-side. Supports 8 different agents (USFans, Hipobuy, AllChinaBuy, Kakobuy, LitBuy, BBDBuy, LoveGoBuy, OopBuy). Single product can be bought through whichever agent the user picked.
  - **Mobile bottom nav**: `fixed inset-x-0 bottom-0 z-50 ... sm:hidden` with Home/Reviews/Favorites/Account and `backdrop-blur(24px)` + `pb-[env(safe-area-inset-bottom)]` for iOS safe area. Clear app-feel.
  - **Scroll progress bar** at `top:0; h-px; animation-timeline:scroll()` — using the native CSS scroll-driven animation API. Very 2026.
  - **Currency + language combo** in one chip `$ · EN`.
  - **Dark-mode toggle** as a first-class header button.
  - **"Quick View"** on every card opens a modal without leaving the grid.
  - Catalog numbered (`001`, `002`, `VOL. 1 — 2026`) — leans hard into the book/archive metaphor.
  - Privacy preferences banner (Customize / Reject all / Accept all) — GDPR-compliant.
  - Sign-in via Discord (purple CTA matches Discord brand `#5865F2`).
- **Tech stack guess**: **Vite SPA** (single hashed bundle `/assets/main-_6IyV7Xx.js`). React-ish utility class patterns suggest Tailwind v4 (uses `bg-[var(--qc-…)]` arbitrary values heavily and has many `--color-*` lab() palette tokens, classic Tailwind v4 generated CSS). Data on **Supabase storage** (`jwbwyjnbvwgzzpdziokb.supabase.co/storage/v1/object/public/products/{id}.webp`). All WebP. No Next/Nuxt/Svelte markers. Auth probably Discord OAuth.
- **Affiliate strategy**: **multi-agent** by design. User selects agent up-front and every "Buy on USFans" CTA rewrites accordingly. No coupon amount visible in markup. Aggressive about being a neutral **discovery layer** ("QCBook is a discovery engine, not a marketplace. We do not sell products.") — legally protective framing.
- **Mobile**: full bottom-bar (Home / Reviews / Favorites / Account) + collapsed header. The book intro adapts (`max-[360px]` breakpoints throughout). Snap-scroll carousels work natively on touch.
- **Steal-worthy**:
  1. **Agent switcher in the nav** with per-agent URL rewriting — single product DB, many affiliate streams. Massively reduces the "site per agent" problem.
  2. **Quality-tier badge system** (BUDGET / TOP / 1:1) — gives users a fast filter that maps to the rep-buying mental model. No competitor has this.
  3. **Variant thumb strip + `+N` overflow button** for clean variant browsing without clutter.
  4. **Mobile bottom bar with safe-area inset** + scroll-progress bar + book-themed intro — three small polish moves that together feel like a native app, not a Bootstrap clone.
- **Skip**: the 3D book intro is gorgeous but adds ~2s of friction before the user sees any product — not great for cold paid traffic. Consider a fast-path skip. Also the "QC Pictures" / Reviews sections are empty-state across the catalog — looks unfinished. Either hide the section or pre-seed with at least one example QC.

---

## Cross-site patterns (summary)

Across the four sites, the consistent design language is **dark + red high-contrast OR warm-paper editorial**, with sticky/fixed headers (glass-blur on dark, solid white on light), Inter or DM-Sans/serif-italic typography, and Tailwind utility class soup behind the scenes. Three of four are JS SPAs (findsbymase = Vite, s1ckfit & trentinfinds = Next.js App Router, theqcbook = Vite); none use WordPress/Elementor. Affiliate strategy splits: s1ckfit and trentinfinds are MuleBuy-only with a `ref=...` code on every product URL, findsbymase is Kakobuy-only with a pitched "$500 / $400 coupon" hero modal, and theqcbook is the multi-agent outlier that lets users pick from 8 agents and rewrites links accordingly — the most flexible and most replicable pattern. Distinctive primitives worth porting into the Flask+Jinja template: (a) a one-time onboarding modal that captures currency + affiliate-agent preference, (b) a quality-tier badge taxonomy on every product card, (c) horizontal snap-scroll carousels with category strips, (d) a mobile bottom-bar with safe-area-inset padding, (e) a "Recent Haul" or "Volume N" editorial framing to make the catalog feel curated rather than auto-scraped, and (f) outfit bundles as a parallel browse mode. Things to skip: empty "QC Pictures / Reviews" placeholder slots, all-monochrome white pages with no accent, ultra-saturated red `#ff1f1f` everywhere, and gigantic immovable hero typography that breaks on tablets.
