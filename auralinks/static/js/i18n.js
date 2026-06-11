/* Storefront i18n — EN / DE / PL / ES / FR.
 *
 * Usage in templates:
 *   data-i18n="key"           -> sets textContent
 *   data-i18n-html="key"      -> sets innerHTML (for strings containing markup)
 *   data-i18n-ph="key"        -> sets the placeholder attribute
 *   data-i18n-title="key"     -> sets title (and aria-label if present)
 *   data-i18n-n="123"         -> value substituted for the {n} token in the string
 *   data-i18n-name="AuraLinks" -> value substituted for the {name} token
 *
 * For JS-rendered content call window.i18nT('key') for the current language,
 * and window.applyI18n(rootEl) after injecting DOM to translate it.
 * English is the source language and is left untouched (no flash on default).
 */
(function () {
  var LANG_KEY = 'auralinks_lang';
  var SUPPORTED = ['en', 'de', 'pl', 'es', 'fr'];

  var I18N = {
    en: {
      nav_home: "Home", nav_shop: "Shop", nav_converter: "Converter", nav_howtobuy: "How to Buy",
      nav_signup: "Sign Up — Coupons $50–$500", wishlist: "Wishlist", search_btn: "Search",
      search_ph: "Search {n} finds…", mm_signup: "Sign Up", mm_coupons: "Coupons $50–$500",
      footer_desc: "An agent-neutral catalogue. Curated daily. Open every listing on the agent you trust.",
      footer_categories: "Categories", footer_shoes: "Shoes", footer_tracksuits: "Tracksuits & Sets",
      footer_hoodies: "Hoodies", footer_jackets: "Jackets", footer_tools: "Tools",
      footer_allproducts: "All Products", footer_linkconverter: "Link Converter", footer_legal: "Legal",
      footer_privacy: "Privacy", footer_terms: "Terms",
      footer_disclaimer: "{name} is a curated catalogue of independent third-party listings. We may earn a commission when you open or buy through our links, at no extra cost to you. {name} does not sell, stock, or ship any items.",
      side_howtobuy: "How to Buy", side_discord: "Join Discord", hero_browse: "Browse All Products →",
      hero_scroll: "Scroll Down", sec_latest: "Latest Drops", sec_best: "Best Selling", sec_viewall: "View All →",
      card_buy: "Buy", card_view: "View", badge_best: "Best Selling",
      mid_cta_1: "Sign Up to Any Agent — Get Coupons $50–$500", mid_cta_2: "Lowest shipping rates guaranteed.",
      cat_all: "All", cta_limited: "Limited Time", cta_coupons_title: "Coupons $50–$500",
      cta_coupons_sub: "Most agents offer a welcome credit when you sign up via a referral link. Use any agent — choose the one with the best rates.",
      cta_claim: "Claim Your Coupons", stat_products: "Products", stat_coupons: "In Coupons", stat_categories: "Categories",
      popup_welcome: "Welcome", popup_title_html: "Shipping Coupons <span class=\"accent\">$50–$500</span>",
      popup_sub: "Sign up to your agent of choice — claim your welcome credit.", popup_dismiss: "Maybe later",
      pd_buy: "Buy", pd_choose_agent: "Choose Agent", pd_pick_first: "Pick an agent first ↑",
      pd_copy_raw: "Copy raw seller link", pd_weight: "Weight", pd_sales: "Sales", pd_listing: "Listing",
      pd_batch: "Batch", pd_versions: "Versions", pd_qc: "QC photos",
      ap_openwith: "Open with", ap_choose: "Choose an agent", ap_loading: "Loading...", ap_buy: "Buy",
      ap_foot: "Pick an agent, then hit Buy.", back: "Back", sn_sub: "Someone just viewed this",
      wishlist_title: "Wishlist", wishlist_loading: "Loading your saved finds…",
      wishlist_empty_title: "Nothing saved yet", wishlist_empty_sub: "Tap the heart on any product to save it here for later.",
      wishlist_browse: "Browse products", oc_title: "The Open Catalogue — Any Agent, Any Time",
      oc_p1: "{name} is an agent-neutral catalogue of curated finds from trusted Weidian, Taobao, and 1688 sellers. Every listing — shoes, hoodies, shirts, jackets, accessories, tech, womens — can be opened on the shopping agent of your choice.",
      oc_p2: "Use our free link converter to switch any shopping-agent product link to the agent you actually use. No lock-in, no preferred partner — pick whichever agent has the best rates or shipping for you today."
    },
    de: {
      nav_home: "Home", nav_shop: "Shop", nav_converter: "Converter", nav_howtobuy: "So kaufst du",
      nav_signup: "Registrieren — Gutscheine $50–$500", wishlist: "Merkliste", search_btn: "Suchen",
      search_ph: "{n} Finds durchsuchen…", mm_signup: "Registrieren", mm_coupons: "Gutscheine $50–$500",
      footer_desc: "Ein agentenneutraler Katalog. Täglich kuratiert. Öffne jedes Listing beim Agent deines Vertrauens.",
      footer_categories: "Kategorien", footer_shoes: "Schuhe", footer_tracksuits: "Trainingsanzüge & Sets",
      footer_hoodies: "Hoodies", footer_jackets: "Jacken", footer_tools: "Tools",
      footer_allproducts: "Alle Produkte", footer_linkconverter: "Link-Converter", footer_legal: "Rechtliches",
      footer_privacy: "Datenschutz", footer_terms: "AGB",
      footer_disclaimer: "{name} ist ein kuratierter Katalog unabhängiger Drittanbieter-Listings. Wir erhalten möglicherweise eine Provision, wenn du über unsere Links öffnest oder kaufst — ohne Mehrkosten für dich. {name} verkauft, lagert oder versendet keine Artikel.",
      side_howtobuy: "So kaufst du", side_discord: "Discord beitreten", hero_browse: "Alle Produkte ansehen →",
      hero_scroll: "Nach unten scrollen", sec_latest: "Neueste Drops", sec_best: "Bestseller", sec_viewall: "Alle ansehen →",
      card_buy: "Kaufen", card_view: "Ansehen", badge_best: "Bestseller",
      mid_cta_1: "Bei einem Agent registrieren — Gutscheine $50–$500 sichern", mid_cta_2: "Niedrigste Versandkosten garantiert.",
      cat_all: "Alle", cta_limited: "Nur kurze Zeit", cta_coupons_title: "Gutscheine $50–$500",
      cta_coupons_sub: "Die meisten Agents bieten ein Startguthaben, wenn du dich über einen Empfehlungslink registrierst. Nutze jeden Agent — wähle den mit den besten Konditionen.",
      cta_claim: "Gutscheine sichern", stat_products: "Produkte", stat_coupons: "An Gutscheinen", stat_categories: "Kategorien",
      popup_welcome: "Willkommen", popup_title_html: "Versand-Gutscheine <span class=\"accent\">$50–$500</span>",
      popup_sub: "Registriere dich bei deinem Wunsch-Agent — sichere dir dein Startguthaben.", popup_dismiss: "Vielleicht später",
      pd_buy: "Kaufen", pd_choose_agent: "Agent wählen", pd_pick_first: "Erst einen Agent wählen ↑",
      pd_copy_raw: "Original-Verkäuferlink kopieren", pd_weight: "Gewicht", pd_sales: "Verkäufe", pd_listing: "Listing",
      pd_batch: "Batch", pd_versions: "Versionen", pd_qc: "QC-Fotos",
      ap_openwith: "Öffnen mit", ap_choose: "Agent wählen", ap_loading: "Lädt...", ap_buy: "Kaufen",
      ap_foot: "Agent wählen, dann auf Kaufen tippen.", back: "Zurück", sn_sub: "Gerade hat sich jemand das angesehen",
      wishlist_title: "Merkliste", wishlist_loading: "Deine gespeicherten Finds werden geladen…",
      wishlist_empty_title: "Noch nichts gespeichert", wishlist_empty_sub: "Tippe bei einem Produkt auf das Herz, um es hier für später zu speichern.",
      wishlist_browse: "Produkte durchstöbern", oc_title: "Der offene Katalog — jeder Agent, jederzeit",
      oc_p1: "{name} ist ein agentenneutraler Katalog kuratierter Finds von vertrauenswürdigen Weidian-, Taobao- und 1688-Verkäufern. Jedes Listing — Schuhe, Hoodies, Shirts, Jacken, Accessoires, Tech, Damenmode — lässt sich beim Agent deiner Wahl öffnen.",
      oc_p2: "Nutze unseren kostenlosen Link-Converter, um jeden Agent-Produktlink zu dem Agent zu wechseln, den du wirklich nutzt. Keine Bindung, kein bevorzugter Partner — wähle den Agent mit den besten Konditionen oder dem besten Versand für dich heute."
    },
    pl: {
      nav_home: "Start", nav_shop: "Sklep", nav_converter: "Konwerter", nav_howtobuy: "Jak kupić",
      nav_signup: "Zarejestruj się — kupony $50–$500", wishlist: "Lista życzeń", search_btn: "Szukaj",
      search_ph: "Szukaj wśród {n} produktów…", mm_signup: "Zarejestruj się", mm_coupons: "Kupony $50–$500",
      footer_desc: "Katalog niezależny od agentów. Codziennie aktualizowany. Otwórz każdą ofertę u agenta, któremu ufasz.",
      footer_categories: "Kategorie", footer_shoes: "Buty", footer_tracksuits: "Dresy i zestawy",
      footer_hoodies: "Bluzy z kapturem", footer_jackets: "Kurtki", footer_tools: "Narzędzia",
      footer_allproducts: "Wszystkie produkty", footer_linkconverter: "Konwerter linków", footer_legal: "Informacje prawne",
      footer_privacy: "Prywatność", footer_terms: "Regulamin",
      footer_disclaimer: "{name} to wyselekcjonowany katalog niezależnych ofert podmiotów trzecich. Możemy otrzymać prowizję, gdy otworzysz lub dokonasz zakupu przez nasze linki — bez dodatkowych kosztów dla Ciebie. {name} nie sprzedaje, nie magazynuje ani nie wysyła żadnych produktów.",
      side_howtobuy: "Jak kupić", side_discord: "Dołącz do Discorda", hero_browse: "Przeglądaj wszystkie produkty →",
      hero_scroll: "Przewiń w dół", sec_latest: "Najnowsze drops", sec_best: "Bestsellery", sec_viewall: "Zobacz wszystkie →",
      card_buy: "Kup", card_view: "Zobacz", badge_best: "Bestseller",
      mid_cta_1: "Zarejestruj się u dowolnego agenta — odbierz kupony $50–$500", mid_cta_2: "Gwarancja najniższych stawek za wysyłkę.",
      cat_all: "Wszystkie", cta_limited: "Oferta ograniczona", cta_coupons_title: "Kupony $50–$500",
      cta_coupons_sub: "Większość agentów oferuje kredyt powitalny przy rejestracji przez link polecający. Skorzystaj z dowolnego agenta — wybierz tego z najlepszymi stawkami.",
      cta_claim: "Odbierz swoje kupony", stat_products: "Produktów", stat_coupons: "W kuponach", stat_categories: "Kategorii",
      popup_welcome: "Witaj", popup_title_html: "Kupony na wysyłkę <span class=\"accent\">$50–$500</span>",
      popup_sub: "Zarejestruj się u wybranego agenta — odbierz kredyt powitalny.", popup_dismiss: "Może później",
      pd_buy: "Kup", pd_choose_agent: "Wybierz agenta", pd_pick_first: "Najpierw wybierz agenta ↑",
      pd_copy_raw: "Kopiuj surowy link sprzedawcy", pd_weight: "Waga", pd_sales: "Sprzedaż", pd_listing: "Oferta",
      pd_batch: "Partia", pd_versions: "Wersje", pd_qc: "Zdjęcia QC",
      ap_openwith: "Otwórz u", ap_choose: "Wybierz agenta", ap_loading: "Ładowanie...", ap_buy: "Kup",
      ap_foot: "Wybierz agenta, a następnie kliknij Kup.", back: "Wstecz", sn_sub: "Ktoś właśnie to oglądał",
      wishlist_title: "Lista życzeń", wishlist_loading: "Ładowanie zapisanych produktów…",
      wishlist_empty_title: "Nic jeszcze nie zapisano", wishlist_empty_sub: "Kliknij serce przy dowolnym produkcie, aby zapisać go tutaj na później.",
      wishlist_browse: "Przeglądaj produkty", oc_title: "Otwarty katalog — dowolny agent, o każdej porze",
      oc_p1: "{name} to niezależny od agentów katalog wyselekcjonowanych produktów od zaufanych sprzedawców z Weidian, Taobao i 1688. Każdą ofertę — buty, bluzy, koszulki, kurtki, akcesoria, elektronikę, modę damską — możesz otworzyć u wybranego przez siebie agenta.",
      oc_p2: "Skorzystaj z naszego darmowego konwertera linków, aby zmienić dowolny link do produktu na agenta, którego faktycznie używasz. Bez przywiązania, bez preferowanego partnera — wybierz tego agenta, który ma dziś dla Ciebie najlepsze stawki lub wysyłkę."
    },
    es: {
      nav_home: "Inicio", nav_shop: "Tienda", nav_converter: "Conversor", nav_howtobuy: "Cómo comprar",
      nav_signup: "Regístrate — Cupones de $50–$500", wishlist: "Favoritos", search_btn: "Buscar",
      search_ph: "Busca entre {n} hallazgos…", mm_signup: "Regístrate", mm_coupons: "Cupones de $50–$500",
      footer_desc: "Un catálogo independiente de agentes. Selección diaria. Abre cada producto en el agente que prefieras.",
      footer_categories: "Categorías", footer_shoes: "Zapatillas", footer_tracksuits: "Chándales y conjuntos",
      footer_hoodies: "Sudaderas", footer_jackets: "Chaquetas", footer_tools: "Herramientas",
      footer_allproducts: "Todos los productos", footer_linkconverter: "Conversor de enlaces", footer_legal: "Legal",
      footer_privacy: "Privacidad", footer_terms: "Términos",
      footer_disclaimer: "{name} es un catálogo seleccionado de productos de terceros independientes. Podemos ganar una comisión cuando abres o compras a través de nuestros enlaces, sin coste adicional para ti. {name} no vende, almacena ni envía ningún artículo.",
      side_howtobuy: "Cómo comprar", side_discord: "Únete a Discord", hero_browse: "Ver todos los productos →",
      hero_scroll: "Desliza hacia abajo", sec_latest: "Últimas novedades", sec_best: "Más vendidos", sec_viewall: "Ver todo →",
      card_buy: "Comprar", card_view: "Ver", badge_best: "Más vendido",
      mid_cta_1: "Regístrate en cualquier agente — Consigue cupones de $50–$500", mid_cta_2: "Las tarifas de envío más bajas garantizadas.",
      cat_all: "Todo", cta_limited: "Tiempo limitado", cta_coupons_title: "Cupones de $50–$500",
      cta_coupons_sub: "La mayoría de los agentes ofrecen un crédito de bienvenida al registrarte mediante un enlace de referido. Usa el agente que quieras — elige el de mejores tarifas.",
      cta_claim: "Consigue tus cupones", stat_products: "Productos", stat_coupons: "En cupones", stat_categories: "Categorías",
      popup_welcome: "Bienvenido", popup_title_html: "Cupones de envío <span class=\"accent\">$50–$500</span>",
      popup_sub: "Regístrate en el agente que prefieras — consigue tu crédito de bienvenida.", popup_dismiss: "Quizá más tarde",
      pd_buy: "Comprar", pd_choose_agent: "Elegir agente", pd_pick_first: "Elige un agente primero ↑",
      pd_copy_raw: "Copiar enlace original del vendedor", pd_weight: "Peso", pd_sales: "Ventas", pd_listing: "Producto",
      pd_batch: "Lote", pd_versions: "Versiones", pd_qc: "Fotos QC",
      ap_openwith: "Abrir con", ap_choose: "Elige un agente", ap_loading: "Cargando...", ap_buy: "Comprar",
      ap_foot: "Elige un agente y pulsa Comprar.", back: "Atrás", sn_sub: "Alguien acaba de ver esto",
      wishlist_title: "Favoritos", wishlist_loading: "Cargando tus hallazgos guardados…",
      wishlist_empty_title: "Aún no has guardado nada", wishlist_empty_sub: "Toca el corazón de cualquier producto para guardarlo aquí para más tarde.",
      wishlist_browse: "Ver productos", oc_title: "El catálogo abierto — Cualquier agente, en cualquier momento",
      oc_p1: "{name} es un catálogo independiente de agentes con hallazgos seleccionados de vendedores de confianza de Weidian, Taobao y 1688. Cada producto — zapatillas, sudaderas, camisetas, chaquetas, accesorios, tecnología, mujer — puede abrirse en el agente de compras que prefieras.",
      oc_p2: "Usa nuestro conversor de enlaces gratuito para pasar cualquier enlace de producto de un agente al agente que tú usas. Sin ataduras, sin socio preferente — elige el agente con las mejores tarifas o el mejor envío para ti hoy."
    },
    fr: {
      nav_home: "Accueil", nav_shop: "Boutique", nav_converter: "Convertisseur", nav_howtobuy: "Comment acheter",
      nav_signup: "Inscription — Coupons $50–$500", wishlist: "Favoris", search_btn: "Rechercher",
      search_ph: "Rechercher parmi {n} trouvailles…", mm_signup: "Inscription", mm_coupons: "Coupons $50–$500",
      footer_desc: "Un catalogue neutre, sans agent imposé. Sélection quotidienne. Ouvrez chaque article sur l'agent de votre choix.",
      footer_categories: "Catégories", footer_shoes: "Chaussures", footer_tracksuits: "Survêtements & ensembles",
      footer_hoodies: "Hoodies", footer_jackets: "Vestes", footer_tools: "Outils",
      footer_allproducts: "Tous les produits", footer_linkconverter: "Convertisseur de liens", footer_legal: "Mentions légales",
      footer_privacy: "Confidentialité", footer_terms: "Conditions",
      footer_disclaimer: "{name} est un catalogue sélectif d'annonces indépendantes de tiers. Nous pouvons percevoir une commission lorsque vous ouvrez ou achetez via nos liens, sans coût supplémentaire pour vous. {name} ne vend, ne stocke et n'expédie aucun article.",
      side_howtobuy: "Comment acheter", side_discord: "Rejoindre le Discord", hero_browse: "Voir tous les produits →",
      hero_scroll: "Faire défiler", sec_latest: "Dernières trouvailles", sec_best: "Meilleures ventes", sec_viewall: "Tout voir →",
      card_buy: "Acheter", card_view: "Voir", badge_best: "Meilleure vente",
      mid_cta_1: "Inscrivez-vous chez un agent — recevez des coupons $50–$500", mid_cta_2: "Tarifs d'expédition les plus bas garantis.",
      cat_all: "Tout", cta_limited: "Durée limitée", cta_coupons_title: "Coupons $50–$500",
      cta_coupons_sub: "La plupart des agents offrent un crédit de bienvenue à l'inscription via un lien de parrainage. Choisissez l'agent que vous voulez — prenez celui aux meilleurs tarifs.",
      cta_claim: "Récupérer vos coupons", stat_products: "Produits", stat_coupons: "En coupons", stat_categories: "Catégories",
      popup_welcome: "Bienvenue", popup_title_html: "Coupons d'expédition <span class=\"accent\">$50–$500</span>",
      popup_sub: "Inscrivez-vous chez l'agent de votre choix — récupérez votre crédit de bienvenue.", popup_dismiss: "Plus tard",
      pd_buy: "Acheter", pd_choose_agent: "Choisir un agent", pd_pick_first: "Choisissez d'abord un agent ↑",
      pd_copy_raw: "Copier le lien vendeur brut", pd_weight: "Poids", pd_sales: "Ventes", pd_listing: "Annonce",
      pd_batch: "Batch", pd_versions: "Versions", pd_qc: "Photos QC",
      ap_openwith: "Ouvrir avec", ap_choose: "Choisir un agent", ap_loading: "Chargement...", ap_buy: "Acheter",
      ap_foot: "Choisissez un agent, puis cliquez sur Acheter.", back: "Retour", sn_sub: "Quelqu'un vient de consulter cet article",
      wishlist_title: "Favoris", wishlist_loading: "Chargement de vos trouvailles enregistrées…",
      wishlist_empty_title: "Rien d'enregistré pour l'instant", wishlist_empty_sub: "Touchez le cœur sur un produit pour l'enregistrer ici.",
      wishlist_browse: "Parcourir les produits", oc_title: "Le catalogue ouvert — tous les agents, à tout moment",
      oc_p1: "{name} est un catalogue neutre de trouvailles sélectionnées chez des vendeurs Weidian, Taobao et 1688 de confiance. Chaque annonce — chaussures, hoodies, t-shirts, vestes, accessoires, tech, femme — peut être ouverte sur l'agent de votre choix.",
      oc_p2: "Utilisez notre convertisseur de liens gratuit pour basculer n'importe quel lien produit vers l'agent que vous utilisez vraiment. Aucun engagement, aucun partenaire imposé — choisissez l'agent aux meilleurs tarifs ou à la meilleure expédition pour vous aujourd'hui."
    }
  };

  // Shop-page + product-page extras (search / sort / pagination / labels)
  var EXTRA = {
    en: { shop_search_ph: "Search products...", sort_price_low: "Price: Low to High", sort_price_high: "Price: High to Low", shop_none: "No products found", pg_prev: "← Prev", pg_next: "Next →",
          pd_switch_agent: "Switch Agent", pd_retail: "Retail", pd_seller: "Seller", pp_agent_sub: "Same product — open it on whichever agent you trust. Your pick is remembered.", related_title: "You might also like" },
    de: { shop_search_ph: "Produkte suchen...", sort_price_low: "Preis: aufsteigend", sort_price_high: "Preis: absteigend", shop_none: "Keine Produkte gefunden", pg_prev: "← Zurück", pg_next: "Weiter →",
          pd_switch_agent: "Agent wechseln", pd_retail: "Originalpreis", pd_seller: "Verkäufer", pp_agent_sub: "Gleiches Produkt — öffne es bei dem Agent, dem du vertraust. Deine Wahl wird gespeichert.", related_title: "Das könnte dir auch gefallen" },
    pl: { shop_search_ph: "Szukaj produktów...", sort_price_low: "Cena: rosnąco", sort_price_high: "Cena: malejąco", shop_none: "Nie znaleziono produktów", pg_prev: "← Poprzednia", pg_next: "Następna →",
          pd_switch_agent: "Zmień agenta", pd_retail: "Cena katalogowa", pd_seller: "Sprzedawca", pp_agent_sub: "Ten sam produkt — otwórz go u dowolnego zaufanego agenta. Twój wybór zostanie zapamiętany.", related_title: "Może Ci się spodobać" },
    es: { shop_search_ph: "Buscar productos...", sort_price_low: "Precio: de menor a mayor", sort_price_high: "Precio: de mayor a menor", shop_none: "No se encontraron productos", pg_prev: "← Anterior", pg_next: "Siguiente →",
          pd_switch_agent: "Cambiar agente", pd_retail: "Precio original", pd_seller: "Vendedor", pp_agent_sub: "El mismo producto — ábrelo en el agente que prefieras. Recordamos tu elección.", related_title: "También te puede gustar" },
    fr: { shop_search_ph: "Rechercher des produits...", sort_price_low: "Prix : croissant", sort_price_high: "Prix : décroissant", shop_none: "Aucun produit trouvé", pg_prev: "← Préc.", pg_next: "Suivant →",
          pd_switch_agent: "Changer d'agent", pd_retail: "Prix de détail", pd_seller: "Vendeur", pp_agent_sub: "Même produit — ouvrez-le sur l'agent de votre choix. Votre choix est mémorisé.", related_title: "Vous aimerez aussi" }
  };
  // Dynamic strings injected by JS at runtime (agent picker / product modal /
  // variants / QC / wishlist). Looked up via window.i18nT() where they're built.
  var EXTRA2 = {
    en: { ap_none: "No agents available for this product.", ap_failed: "Failed to load agents.",
          pd_only_one: "Only one version", pd_single_variant: "Single variant", pd_no_variants: "No variants available",
          pd_loading_variants: "Loading variants…", qc_looking: "Looking for QC photos…",
          qc_none: "No QC photos available for this listing yet.", qc_failed: "Couldn't load QC photos.",
          pd_sold: "sold", badge_verified: "Verified", badge_quality: "Quality",
          wl_unit: "items", wl_add: "Add to wishlist", wl_remove: "Remove from wishlist" },
    de: { ap_none: "Für dieses Produkt sind keine Agents verfügbar.", ap_failed: "Agents konnten nicht geladen werden.",
          pd_only_one: "Nur eine Version", pd_single_variant: "Eine Variante", pd_no_variants: "Keine Varianten verfügbar",
          pd_loading_variants: "Varianten werden geladen…", qc_looking: "Suche nach QC-Fotos…",
          qc_none: "Für dieses Listing sind noch keine QC-Fotos verfügbar.", qc_failed: "QC-Fotos konnten nicht geladen werden.",
          pd_sold: "verkauft", badge_verified: "Geprüft", badge_quality: "Qualität",
          wl_unit: "Artikel", wl_add: "Zur Merkliste hinzufügen", wl_remove: "Von Merkliste entfernen" },
    pl: { ap_none: "Brak dostępnych agentów dla tego produktu.", ap_failed: "Nie udało się załadować agentów.",
          pd_only_one: "Tylko jedna wersja", pd_single_variant: "Jeden wariant", pd_no_variants: "Brak dostępnych wariantów",
          pd_loading_variants: "Ładowanie wariantów…", qc_looking: "Szukanie zdjęć QC…",
          qc_none: "Brak zdjęć QC dla tej oferty.", qc_failed: "Nie udało się załadować zdjęć QC.",
          pd_sold: "sprzedano", badge_verified: "Zweryfikowano", badge_quality: "Jakość",
          wl_unit: "produktów", wl_add: "Dodaj do listy życzeń", wl_remove: "Usuń z listy życzeń" },
    es: { ap_none: "No hay agentes disponibles para este producto.", ap_failed: "No se pudieron cargar los agentes.",
          pd_only_one: "Solo una versión", pd_single_variant: "Una sola variante", pd_no_variants: "No hay variantes disponibles",
          pd_loading_variants: "Cargando variantes…", qc_looking: "Buscando fotos QC…",
          qc_none: "Aún no hay fotos QC para este producto.", qc_failed: "No se pudieron cargar las fotos QC.",
          pd_sold: "vendidos", badge_verified: "Verificado", badge_quality: "Calidad",
          wl_unit: "artículos", wl_add: "Añadir a favoritos", wl_remove: "Quitar de favoritos" },
    fr: { ap_none: "Aucun agent disponible pour ce produit.", ap_failed: "Échec du chargement des agents.",
          pd_only_one: "Une seule version", pd_single_variant: "Variante unique", pd_no_variants: "Aucune variante disponible",
          pd_loading_variants: "Chargement des variantes…", qc_looking: "Recherche de photos QC…",
          qc_none: "Pas encore de photos QC pour cette annonce.", qc_failed: "Impossible de charger les photos QC.",
          pd_sold: "vendus", badge_verified: "Vérifié", badge_quality: "Qualité",
          wl_unit: "articles", wl_add: "Ajouter aux favoris", wl_remove: "Retirer des favoris" }
  };
  for (var _lc in EXTRA) { if (I18N[_lc]) { for (var _k in EXTRA[_lc]) I18N[_lc][_k] = EXTRA[_lc][_k]; } }
  for (var _lc2 in EXTRA2) { if (I18N[_lc2]) { for (var _k2 in EXTRA2[_lc2]) I18N[_lc2][_k2] = EXTRA2[_lc2][_k2]; } }

  function getLang() {
    try { var l = localStorage.getItem(LANG_KEY); if (l && SUPPORTED.indexOf(l) > -1) return l; } catch (e) {}
    return 'en';
  }
  function t(key, lang) {
    lang = lang || getLang();
    var d = I18N[lang] || I18N.en;
    if (d && d[key] != null) return d[key];
    return (I18N.en[key] != null) ? I18N.en[key] : null;
  }
  function subst(str, el) {
    if (str == null) return str;
    if (el && str.indexOf('{n}') > -1) { var n = el.getAttribute('data-i18n-n'); str = str.replace(/\{n\}/g, n != null ? n : ''); }
    if (el && str.indexOf('{name}') > -1) { var nm = el.getAttribute('data-i18n-name'); str = str.replace(/\{name\}/g, nm != null ? nm : ''); }
    return str;
  }
  function each(root, sel, fn) { var ns = (root || document).querySelectorAll(sel); for (var i = 0; i < ns.length; i++) fn(ns[i]); }

  function applyTo(root, lang) {
    lang = lang || getLang();
    each(root, '[data-i18n]', function (el) { var v = t(el.getAttribute('data-i18n'), lang); if (v != null) el.textContent = subst(v, el); });
    each(root, '[data-i18n-html]', function (el) { var v = t(el.getAttribute('data-i18n-html'), lang); if (v != null) el.innerHTML = subst(v, el); });
    each(root, '[data-i18n-ph]', function (el) { var v = t(el.getAttribute('data-i18n-ph'), lang); if (v != null) el.setAttribute('placeholder', subst(v, el)); });
    each(root, '[data-i18n-title]', function (el) {
      var v = t(el.getAttribute('data-i18n-title'), lang);
      if (v != null) { v = subst(v, el); el.setAttribute('title', v); if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', v); }
    });
  }
  function updateLabels(lang) {
    each(document, '[data-lang-label]', function (el) { el.textContent = lang.toUpperCase(); });
    each(document, '.mm-lang button', function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === lang); });
    each(document, '.lang-menu button', function (b) {
      var oc = b.getAttribute('onclick') || ''; b.classList.toggle('active', oc.indexOf("'" + lang + "'") > -1);
    });
  }

  // Public API
  window.i18nT = function (key) { return t(key); };
  window.applyI18n = function (root) { applyTo(root || document, getLang()); };
  window.i18nLang = getLang;
  window.setLang = function (code) {
    if (SUPPORTED.indexOf(code) < 0) code = 'en';
    try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
    document.documentElement.setAttribute('lang', code);
    applyTo(document, code);
    updateLabels(code);
    var m = document.getElementById('langMenu'); if (m) m.classList.remove('open');
  };
  window.toggleLangMenu = function () {
    var m = document.getElementById('langMenu'); if (!m) return;
    var c = document.getElementById('currencyMenu'); if (c) c.classList.remove('open');
    m.classList.toggle('open');
  };
  document.addEventListener('click', function (e) {
    var m = document.getElementById('langMenu');
    if (m && m.classList.contains('open') && e.target.closest && !e.target.closest('.lang-switcher')) m.classList.remove('open');
  });

  function init() {
    var lang = getLang();
    document.documentElement.setAttribute('lang', lang);
    if (lang !== 'en') applyTo(document, lang); // EN is the source markup — no work / no flash
    updateLabels(lang);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
