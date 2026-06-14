"""Auto-generate searchable tags from a product name + category.

Goal: a customer typing "yzy slide" or "jordan 4 panda" should hit the right
products even if the official name uses different wording. Tags are baked at
import time so search stays a single fast LIKE query.
"""
import re

# Known brand keywords. If a brand appears in the name we add it as a single
# canonical tag plus common aliases.
BRANDS = {
    'nike':          ['nike'],
    'jordan':        ['jordan', 'aj'],
    'air jordan':    ['jordan', 'air-jordan', 'aj'],
    'adidas':        ['adidas'],
    'yeezy':         ['yeezy', 'yzy'],
    'new balance':   ['new-balance', 'nb'],
    'asics':         ['asics'],
    'converse':      ['converse'],
    'vans':          ['vans'],
    'puma':          ['puma'],
    'reebok':        ['reebok'],
    'salomon':       ['salomon'],

    'supreme':       ['supreme'],
    'bape':          ['bape', 'a-bathing-ape'],
    'a bathing ape': ['bape', 'a-bathing-ape'],
    'palace':        ['palace'],
    'stussy':        ['stussy'],
    'kith':          ['kith'],
    'off-white':     ['off-white', 'offwhite'],
    'off white':     ['off-white', 'offwhite'],
    'fear of god':   ['fear-of-god', 'fog', 'essentials'],
    'essentials':    ['essentials', 'fog', 'fear-of-god'],
    'gallery dept':  ['gallery-dept', 'gallery-department'],
    'gallery department': ['gallery-dept'],
    'rhude':         ['rhude'],
    'amiri':         ['amiri'],
    'represent':     ['represent'],
    'corteiz':       ['corteiz', 'crtz'],
    'crtz':          ['corteiz', 'crtz'],
    'trapstar':      ['trapstar'],
    'syna world':    ['syna-world', 'syna'],
    'syna':          ['syna-world', 'syna'],
    'broken planet': ['broken-planet'],
    'hellstar':      ['hellstar'],
    'travis scott':  ['travis-scott', 'cactus-jack'],
    'cactus jack':   ['cactus-jack', 'travis-scott'],
    'denim tears':   ['denim-tears'],
    'chrome hearts': ['chrome-hearts'],
    'celine':        ['celine'],
    'dior':          ['dior'],
    'gucci':         ['gucci'],
    'louis vuitton': ['louis-vuitton', 'lv'],
    'prada':         ['prada'],
    'balenciaga':    ['balenciaga', 'bal'],
    'fendi':         ['fendi'],
    'burberry':      ['burberry'],
    'moncler':       ['moncler'],
    'stone island':  ['stone-island'],
    'cp company':    ['cp-company'],
    'arc\'teryx':    ['arcteryx', 'arc-teryx'],
    'arcteryx':      ['arcteryx'],
    'the north face':['north-face', 'tnf'],
    'north face':    ['north-face', 'tnf'],
    'patagonia':     ['patagonia'],
    'carhartt':      ['carhartt'],

    'rolex':         ['rolex'],
    'patek':         ['patek-philippe', 'patek'],
    'audemars':      ['audemars-piguet', 'ap'],
    'cartier':       ['cartier'],
    'omega':         ['omega'],

    'apple':         ['apple'],
    'airpods':       ['airpods', 'airpod'],
    'airpod':        ['airpods'],
    'airtag':        ['airtag'],
}

COLORS = {
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
    'orange', 'brown', 'grey', 'gray', 'beige', 'cream', 'navy', 'olive',
    'tan', 'silver', 'gold', 'rose', 'mint', 'sage', 'sand', 'bone', 'ivory',
}

# Product-type tokens → canonical category + synonyms
TYPE_SYNONYMS = {
    'shoe':       ['shoes', 'sneaker', 'sneakers', 'footwear'],
    'shoes':      ['shoes', 'sneaker', 'sneakers', 'footwear'],
    'sneaker':    ['shoes', 'sneaker', 'sneakers'],
    'sneakers':   ['shoes', 'sneaker', 'sneakers'],
    # slip-ons: slides / slippers / sandals / mules / flip-flops are the same thing
    # to a shopper — treat them as one synonym set so any term finds all of them.
    'slide':      ['slide', 'slipper', 'sandal', 'mule', 'flip flop'],
    'slides':     ['slide', 'slipper', 'sandal', 'mule', 'flip flop'],
    'slipper':    ['slide', 'slipper', 'sandal', 'mule', 'flip flop'],
    'slippers':   ['slide', 'slipper', 'sandal', 'mule', 'flip flop'],
    'sandal':     ['slide', 'slipper', 'sandal', 'mule'],
    'sandals':    ['slide', 'slipper', 'sandal', 'mule'],
    'mule':       ['slide', 'slipper', 'mule'],
    'slider':     ['slide', 'slipper', 'sandal'],
    'flipflop':   ['flip flop', 'slide', 'sandal', 'slipper'],
    'boot':       ['boot', 'boots'],
    'boots':      ['boot', 'boots'],
    'trainer':    ['trainer', 'sneaker', 'shoe'],
    'trainers':   ['trainer', 'sneaker', 'shoe'],
    'kicks':      ['shoe', 'sneaker'],

    'hoodie':     ['hoodie', 'hoodies', 'sweatshirt'],
    'hoodies':    ['hoodie', 'hoodies', 'sweatshirt'],
    'sweater':    ['sweater', 'sweatshirt', 'knit'],
    'sweatshirt': ['sweatshirt', 'hoodie'],
    'crewneck':   ['crewneck', 'sweatshirt'],

    'tee':        ['tee', 't-shirt', 'shirt'],
    't-shirt':    ['tee', 't-shirt', 'shirt'],
    'tshirt':     ['tee', 't-shirt', 'shirt'],
    'shirt':      ['shirt', 'tee'],
    'polo':       ['polo'],

    'pant':       ['pants', 'trousers'],
    'pants':      ['pants', 'trousers'],
    'jean':       ['jeans', 'denim'],
    'jeans':      ['jeans', 'denim'],
    'short':      ['shorts'],
    'shorts':     ['shorts'],
    'jogger':     ['joggers', 'pants', 'sweatpants'],
    'joggers':    ['joggers', 'pants', 'sweatpants'],
    'sweatpants': ['sweatpants', 'joggers', 'pants'],

    'jacket':     ['jacket', 'outerwear'],
    'puffer':     ['puffer', 'jacket', 'outerwear'],
    'coat':       ['coat', 'outerwear'],
    'vest':       ['vest', 'gilet', 'outerwear'],
    'gilet':      ['gilet', 'vest', 'outerwear'],
    'tank':       ['tank', 'singlet', 'vest'],
    'flannel':    ['flannel', 'plaid'],
    'loafer':     ['loafer', 'moccasin'],
    'loafers':    ['loafer', 'moccasin'],

    'bag':        ['bag', 'accessory'],
    'backpack':   ['backpack', 'bag'],
    'wallet':     ['wallet', 'accessory'],
    'belt':       ['belt', 'accessory'],
    'hat':        ['hat', 'cap', 'accessory'],
    'cap':        ['cap', 'hat'],
    'beanie':     ['beanie', 'hat'],
    'watch':      ['watch', 'accessory'],
    'glasses':    ['glasses', 'sunglasses', 'accessory'],
    'sunglasses': ['sunglasses', 'glasses', 'accessory'],
    # jewelry: the catalog names items necklace/bracelet/etc., never "jewelry".
    # (avoid bare 'ring' — it substring-matches 'tRAINING', 'eaRRING' etc.)
    'jewelry':    ['necklace', 'bracelet', 'earring', 'pendant', 'chain', 'jewelry'],
    'jewellery':  ['necklace', 'bracelet', 'earring', 'pendant', 'chain'],
    'necklace':   ['necklace', 'pendant', 'chain'],
    'bracelet':   ['bracelet', 'chain'],
    'earrings':   ['earring'],
}

STOP_WORDS = {
    'the', 'and', 'a', 'an', 'of', 'with', 'for', 'in', 'on', 'to',
    'or', 'is', 'by', 'at', 'as',
}

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'\-]*")


def _phrases(text):
    """Return all 2-word phrases in text (helps catch 'travis scott' etc)."""
    words = WORD_RE.findall(text)
    return [' '.join(words[i:i + 2]).lower() for i in range(len(words) - 1)]


def generate_tags(name, category=''):
    """Return a space-separated tag string for a product."""
    tags = set()
    if not name:
        return ''

    name_lower = name.lower()
    if category:
        tags.add(category.lower())

    # Multi-word brand matches (check phrases first)
    for phrase in _phrases(name_lower):
        if phrase in BRANDS:
            tags.update(BRANDS[phrase])
    # Single-word brand matches
    for word in WORD_RE.findall(name_lower):
        if word in BRANDS:
            tags.update(BRANDS[word])

    # Type / category synonyms
    for word in WORD_RE.findall(name_lower):
        if word in TYPE_SYNONYMS:
            tags.update(TYPE_SYNONYMS[word])

    # Colors
    for word in WORD_RE.findall(name_lower):
        if word in COLORS:
            tags.add(word)

    # Every meaningful word from the name (so partial matches work too)
    for word in WORD_RE.findall(name_lower):
        if len(word) >= 2 and word not in STOP_WORDS:
            tags.add(word)

    return ' '.join(sorted(tags))


def tokenize_query(q):
    """Split a search query into searchable tokens."""
    if not q:
        return []
    return [t for t in WORD_RE.findall(q.lower()) if t not in STOP_WORDS]


# ============================================================
# Extensive fuzzy search: shorthand expansion + number handling + typo tolerance
# ============================================================
# Captures words, numbers AND alphanumeric shorthand (j4, am90) — unlike WORD_RE,
# which drops bare numbers so "jordan 4" used to search only "jordan".
SEARCH_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9'\-]*")

# Shorthand → one or more canonical search phrases (OR'd). Curated for the
# sneaker / streetwear / luxury rep market this catalogue covers.
QUERY_SHORTHAND = {
    'af1': ['air force 1'], 'af': ['air force'], 'forces': ['air force 1'],
    'am1': ['air max 1'], 'am90': ['air max 90'], 'am95': ['air max 95'],
    'am97': ['air max 97'], 'am270': ['air max 270'], 'am720': ['air max 720'],
    'tn': ['air max plus', 'tn'], 'tns': ['air max plus', 'tn'], 'vapormax': ['vapormax'],
    'sb': ['nike sb', 'dunk', 'sb'], 'dunks': ['dunk'],
    'aj': ['jordan'], 'jordans': ['jordan'],
    'yzy': ['yeezy'], 'yeezys': ['yeezy'], 'foams': ['yeezy foam', 'foam runner'],
    'nb': ['new balance'], 'tnf': ['north face'], 'northface': ['north face'],
    'fog': ['fear of god', 'essentials'], 'essentials': ['essentials', 'fear of god'],
    'bal': ['balenciaga'], 'balys': ['balenciaga'], 'lv': ['louis vuitton', 'lv'],
    'ch': ['chrome hearts'], 'gd': ['gallery dept', 'gallery department'],
    'crtz': ['corteiz'], 'ow': ['off white', 'off-white'], 'pa': ['palm angels'],
    'bbc': ['billionaire boys club'], 'cdg': ['comme des garcons', 'play'],
    'sp5der': ['spider', 'sp5der', 'sp5der'], 'spider': ['spider', 'sp5der'],
    'gg': ['golden goose'], 'mm6': ['mm6', 'maison margiela'], 'tabi': ['tabi', 'margiela'],
    'rep': [''], 'reps': [''],   # ignore filler
    'ap': ['audemars piguet', 'royal oak'], 'pp': ['patek philippe', 'philipp plein', 'pp'], 'rm': ['richard mille'],
    'sammies': ['samba'], 'sambas': ['samba'], 'gazelles': ['gazelle'],
    # concatenated brand / model names (no space)
    'airforce': ['air force'], 'airforce1': ['air force 1'], 'airmax': ['air max'],
    'airjordan': ['jordan'], 'newbalance': ['new balance'], 'offwhite': ['off white', 'off-white'],
    'stoneisland': ['stone island'], 'chromehearts': ['chrome hearts'], 'palmangels': ['palm angels'],
    'fearofgod': ['fear of god', 'essentials'], 'denimtears': ['denim tears'],
    'gallerydept': ['gallery dept'], 'northface': ['north face'], 'louisvuitton': ['louis vuitton'],
    'travisscott': ['travis scott', 'cactus jack'], 'cactusjack': ['cactus jack', 'travis scott'],
    'broken': ['broken planet'], 'syna': ['syna world', 'syna'],
}

# Model-number shorthand → canonical phrase, e.g. j4 -> "jordan 4", am90 -> "air max 90".
_MODEL_PATTERNS = [
    (re.compile(r'^(?:aj|j|jordan)(\d{1,2})$'), 'jordan {0}'),
    (re.compile(r'^(?:am|airmax)(\d{1,3})$'), 'air max {0}'),
    (re.compile(r'^nb(\d{2,4})$'), 'new balance {0}'),
    (re.compile(r'^(?:yzy|yeezy)(\d{3})$'), 'yeezy {0}'),
]

_SEARCH_VOCAB = None


def invalidate_search_vocab():
    """Drop the cached typo-correction vocabulary (call after product writes)."""
    global _SEARCH_VOCAB
    _SEARCH_VOCAB = None


def set_search_vocab(rows):
    """Build the typo-correction vocabulary from product rows ({name, tags})."""
    global _SEARCH_VOCAB
    vocab = set()
    for r in rows or []:
        for field in ('name', 'tags'):
            for w in SEARCH_TOKEN_RE.findall((r.get(field) or '').lower()):
                if len(w) >= 3 and not w.isdigit():
                    vocab.add(w)
    _SEARCH_VOCAB = vocab
    return vocab


def get_search_vocab():
    return _SEARCH_VOCAB


def expand_search_query(query):
    """Turn a query into a list of GROUPS (cheap: shorthand + model + number-merge,
    NO fuzzy). A product matches if EVERY group has at least one alternative present
    (OR within a group, AND across groups). Each group is a list of substrings."""
    toks = [t for t in SEARCH_TOKEN_RE.findall((query or '').lower()) if t not in STOP_WORDS]
    groups = []
    for tok in toks:
        # a bare number right after a plain word → merge into a phrase ("jordan","4" → "jordan 4")
        if tok.isdigit() and groups and len(groups[-1]) == 1 and groups[-1][0].isalpha():
            groups[-1] = [groups[-1][0] + ' ' + tok]
            continue
        alts = set()
        is_shorthand = tok in QUERY_SHORTHAND
        if is_shorthand:
            alts.update(a for a in QUERY_SHORTHAND[tok] if a)
        for pat, tmpl in _MODEL_PATTERNS:
            m = pat.match(tok)
            if m:
                alts.add(tmpl.format(*m.groups()))
        # product-type synonyms so "slipper" finds slides, "trainer" finds sneakers, etc.
        if tok in TYPE_SYNONYMS:
            alts.update(TYPE_SYNONYMS[tok])
        if not alts and is_shorthand:
            continue  # mapped to filler only (e.g. "rep"/"reps") → drop the token
        # COVERAGE GUARANTEE: a token of >=3 chars must always also match itself, so
        # every product stays findable by its own name words even when a shorthand
        # expands to something else (e.g. "offwhite" -> "off white", but "OffWhite"
        # products only contain the literal "offwhite").
        if len(tok) >= 3 and not tok.isdigit():
            alts.add(tok)
        if not alts:
            alts.add(tok)
        groups.append(sorted(alts))
    return groups


def fuzzy_correct_groups(groups, vocab):
    """Apply typo correction (only to single plain-word groups whose word is unknown)
    against the product vocabulary. Returns possibly-corrected groups + whether any
    changed. Run only as a fallback when the exact search found little."""
    import difflib
    if not vocab:
        return groups, False
    changed = False
    out = []
    for group in groups:
        if len(group) == 1:
            w = group[0]
            if (' ' not in w) and len(w) >= 4 and not w.isdigit() and w not in vocab:
                close = difflib.get_close_matches(w, vocab, n=4, cutoff=0.78)
                if close:
                    out.append(sorted(set(close)))
                    changed = True
                    continue
        out.append(group)
    return out, changed


# ============================================================
# Auto-categorization
# ============================================================
# Maps a name pattern -> canonical category slug. First match wins.
# Order matters: more specific categories before generic ones (e.g. bags
# before shoes since some "bag" patterns could match shoe regex if loose).
import re as _re

# ------------------------------------------------------------------
# Tracksuits & Sets collection
# ------------------------------------------------------------------
# A "feature" category that gathers every co-ord / two-piece / tracksuit /
# matching set / suit, no matter what single-garment bucket the source data put
# it in (most arrive mislabelled as 'hoodies'). Used by both auto_category (new
# products) and a boot-time re-assert in app.py (existing products), so the
# collection self-heals after every re-seed.
_TS_STRONG = _re.compile(
    r'\b(track[ -]?suit|tracksuits?|sweat[ -]?suit|two[ -]?piece|three[ -]?piece|'
    r'[234][ -]?piece|[234]\s?pc|co[ -]?ord|coord|matching\s+set|'
    r'training\s+(?:clothes\s+)?suit|vest\s+set)\b', _re.I)
_TS_WEAK = _re.compile(r'\b(sets?|suits?)\b', _re.I)
# Nouns that mean a "set"/"suit" is NOT an apparel co-ord (bag suit, jewelry set,
# suit trousers as standalone dress-pants, tech/homeware sets, …).
_TS_NOT = _re.compile(
    r'\b(bag|backpack|cross[ -]?body|tote|handbag|sling|duffel|messenger|wallet|'
    r'purse|pouch|clutch|satchel|jewel\w*|watch|chess|lego|dinner|tea|coffee|'
    r'cutlery|knife|knives|dish|towel|bedding|pillow|brush|makeup|cosmetic|nail|'
    r'lash|stationery|mug|plate|bowl|airpod|earbud|charger|'
    r'suit\s+trousers?|suit\s+pants?)\b', _re.I)


def is_tracksuit(name):
    """True if the product name reads as a tracksuit / co-ord / matching set / suit.
    Strong signals (tracksuit, two-piece, training suit, …) always win; the weak
    standalone 'set'/'suit' is suppressed when a non-apparel noun is present."""
    if not name:
        return False
    strong = bool(_TS_STRONG.search(name))
    if _TS_NOT.search(name) and not strong:
        return False
    return strong or bool(_TS_WEAK.search(name))


# GARMENT-TYPE rules — matched FIRST, in this order. The product TYPE word
# (tee, shorts, hoodie, belt…) decides the category. Critically these contain
# NO multi-category brand names (nike/adidas/bape/amiri make shoes AND apparel),
# so "Nike Tee" -> shirts and "Bape Shorts" -> shorts instead of both wrongly
# landing in shoes. Only AFTER no type word matches do we fall back to the
# brand/model shoe heuristic below.
_TYPE_RULES = [
    ('bags',        _re.compile(r'\b(bag|backpack|tote|handbag|sling|duffel|duffle|messenger|cross[- ]?body|fanny[- ]?pack|pouch|luggage|suitcase|briefcase|clutch|satchel|keepall|cardholder|card[- ]?holder)\b', _re.I)),
    ('headwear',    _re.compile(r'\b(hat|hats|cap|caps|beanie|beanies|bucket[ -]?hat|trucker|snapback|fedora|visor|skull[ -]?cap|knit[ -]?cap|toque|balaclava)\b', _re.I)),
    ('accessories', _re.compile(r'\b(scarf|scarves|glove|gloves|belt|belts|wallet|sunglass(?:es)?|glasses|watch|watches|jewel(?:ry|lery)?|necklace|chain|ring|rings|earring|bracelet|brooch|bandana|tie\b|bowtie|cufflink|umbrella|keychain|key[- ]?ring|sock|socks|mask|underwear|boxer)\b', _re.I)),
    ('tech',        _re.compile(r'\b(iphone|samsung|airpod|airpods|earpod|earbud|earphone|headphone|laptop|macbook|ipad|tablet|charger|cable|speaker|jbl|airtag|dyson|stanley|kindle|switch|playstation|xbox|drone|smart[- ]?watch|power[- ]?bank|flip\s*5)\b', _re.I)),
    # require the PLURAL "shorts" (+ trunks/boardshorts) — bare "short" is an
    # adjective in "short coat" / "short-sleeved shirt" and must NOT match here
    ('shorts',      _re.compile(r'\b(shorts|shorties|trunks|board[- ]?shorts?|swim[- ]?shorts?)\b', _re.I)),
    ('pants',       _re.compile(r'\b(pants?|trousers?|jeans?|sweat[- ]?pants?|joggers?|cargos?|chinos?|leggings?|track[- ]?pants?|slacks?|skort)\b', _re.I)),
    ('hoodies',     _re.compile(r'\b(hoodie|hoody|hooded|sweat[- ]?shirt|crew[- ]?neck|crewneck|pullover|zip[- ]?up|zipup|sweater|knitwear|cardigan|jumper)\b', _re.I)),
    ('jackets',     _re.compile(r'\b(jacket|coat|parka|puffer|vest|gilet|blazer|windbreaker|bomber|trench|overcoat|outerwear|down[- ]?jacket|quilted|softshell|hardshell)\b', _re.I)),
    ('womens',      _re.compile(r'\b(womens?|women\'s|female|ladies|dress|skirt|bra|bralette|romper|jumpsuit|bodysuit)\b', _re.I)),
    # shirts LAST among apparel; note: bare "top" is intentionally excluded — in
    # rep listings "Top"/"Good" are QUALITY tiers ("Dior B30 Top" = a shoe), so
    # it can't mean the garment here. Real tops say tank/polo/tee/crop.
    ('shirts',      _re.compile(r'\b(t[- ]?shirts?|tshirts?|tees?|polos?|shirts?|button[- ]?up|button[- ]?down|jersey|tank|crop[- ]?top|long[- ]?sleeve|short[- ]?sleeve)\b', _re.I)),
    # explicit shoe TYPE / MODEL words (shoe-dominant brands only — NOT nike/adidas/puma)
    ('shoes',       _re.compile(r'\b(shoe|shoes|sneakers?|trainers?|boots?|slippers?|slides?|sandals?|loafer|mule|flip[- ]?flop|cleats?|heels?|stiletto|pump|'
                               r'jordan|yeezy|dunk|af1|air[- ]?force|air[- ]?max|airmax|vapormax|samba|gazelle|campus|spezial|handball|forum|stan[ -]?smith|superstar|'
                               r'new[ -]?balance|nb[ -]?\d+|asics|onitsuka|salomon|hoka|crocs|converse|vans|reebok|'
                               r'p6000|9060|1906r?|2002r|990|550|530|327|shox|uptempo|foamposite|kobe|cortez|blazer|vomero|nocta|tabi|mm6|gel[- ]?\w+|protro)\b', _re.I)),
]

# Brand/model names that ARE a shoe even with no type word ("Dior B22",
# "Golden Goose", "Balenciaga Track"). Tried LAST so a garment word always wins.
_SHOE_BRAND_ONLY = _re.compile(
    r'^(?:\s*\d+[、,.]?\s*)?(?:dior\s*b\s*\d|golden\s*goose|christian\s*loub(?:outin|otin)|louboutin|birkenstock|'
    r'maison\s*margiela|margiela|alexander\s*mcqueen|mcqueen|lanvin|bape\s*sta|timberland|valentino|'
    r'balenciaga\s*(?:track|defender|3xl|alaska|speed|runner)|gucci\s*(?:chunky|rhyton|screener|g\s*\d)|'
    r'prada\s*(?:america|prax|downtown|sport)|hermes\s*(?:land|chypre|bouncing|izmir)|'
    r'loro\s*piana\s*(?:summer|walk)|brunello\s*cucinelli\s*shoe|miu\s*miu\s*(?:shoe|sneak)|rick\s*owens\s*(?:ramones|geo)|b\s*[1-9]\d?\b)',
    _re.I)


def auto_category(name, fallback=''):
    """Most likely category slug for a product name (else `fallback`).

    Precedence: tracksuit/co-ord → garment TYPE word (brand-agnostic) →
    brand-only shoe model. The TYPE word always beats a brand, so multi-category
    brands (Nike, Bape, Amiri, Off-White) no longer dump tees/shorts into shoes."""
    if not name:
        return fallback
    if is_tracksuit(name):
        return 'tracksuits'
    for slug, pat in _TYPE_RULES:
        if pat.search(name):
            return slug
    if _SHOE_BRAND_ONLY.search(name):
        return 'shoes'
    return fallback


# Back-compat: some callers import _AUTO_CATEGORY_RULES directly.
_AUTO_CATEGORY_RULES = [('tracksuits', _TS_STRONG)] + _TYPE_RULES + [('shoes', _SHOE_BRAND_ONLY)]
