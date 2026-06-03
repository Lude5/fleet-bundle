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
    'slide':      ['slides', 'sandals'],
    'slides':     ['slides', 'sandals'],
    'sandal':     ['sandals'],
    'sandals':    ['sandals'],
    'boot':       ['boots'],
    'boots':      ['boots'],

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
    'vest':       ['vest', 'outerwear'],

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
    'sb': ['nike sb', 'dunk'], 'dunks': ['dunk'],
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

_AUTO_CATEGORY_RULES = [
    ('bags',        _re.compile(r'\b(bag|backpack|tote|handbag|sling|duffel|messenger|crossbody|fanny[- ]?pack|pouch|luggage|suitcase|briefcase|clutch|satchel)\b', _re.I)),
    ('shoes',       _re.compile(r'\b(shoe|shoes|sneaker|sneakers|trainer|trainers|boot|boots|slipper|slippers|slide|slides|sandal|sandals|loafer|mule|flip[- ]?flop|jordan|yeezy|samba|gazelle|campus|forum|stan[ -]?smith|nb[ -]?\d+|new[ -]?balance|asics|nike|adidas|puma|converse|reebok|vans|onitsuka|salomon|hoka|crocs|dunk|af1|air[- ]?force|p6000|9060|1906|nocta|tabi|mm6|moc\b|cleats|runner|kicks|high[ -]?heel|heel|stiletto|pump)\b', _re.I)),
    # Luxury / archive sneaker brand-only names that lack a type word.
    # Common in rep catalogs (e.g. "Dior B22", "Golden Goose Low", "Balenciaga Track").
    ('shoes',       _re.compile(r'^(?:dior\s*b\s*\d|golden\s*goose|christian\s*loub(?:outin|otin)|birkenstock|maison\s*margiela|alexander\s*mcqueen|lanvin|bape(?:\s*sta)?|off\s*[- ]?white|timberland|loewe|valentino|ysl|balenciaga\s*(?:track|defender|3xl|alaska|speedhunter)|gucci\s*(?:chunky|rhyton|g\s*\d)|prada\s*(?:america|prax|downtown)|amiri|b\s*[1-9]\d?|hermes\s*(?:land|chypre|bouncing)|brunello\s*cucinelli|loro\s*piana|miu\s*miu|north\s*face|the\s*north\s*face|the\s*row|rick\s*owens)\b', _re.I)),
    ('hoodies',     _re.compile(r'\b(hoodie|hoody|hooded|sweatshirt|crewneck|crew[- ]?neck|pullover|zip[- ]?up|zipup|fleece(?!.*jacket))\b', _re.I)),
    ('jackets',     _re.compile(r'\b(jacket|coat|parka|puffer|vest|gilet|blazer|windbreaker|bomber|trench|overcoat|outerwear|down[- ]?jacket|quilted|softshell|hardshell|shell(?!\s*(?:tee|shirt)))\b', _re.I)),
    ('shorts',      _re.compile(r'\b(short|shorts|shortie|shorties|trunks|board[- ]?short)\b', _re.I)),
    ('pants',       _re.compile(r'\b(pant|pants|trouser|trousers|jean|jeans|denim|sweatpant|sweatpants|jogger|joggers|cargo|cargos|chino|chinos|legging|leggings|track[- ]?pant|track[- ]?pants|slack|slacks|skirt|skort)\b', _re.I)),
    ('shirts',      _re.compile(r'\b(t[- ]?shirt|tshirt|tee|tees|polo|polos|shirt|shirts|button[- ]?up|button[- ]?down|jersey|tank|top|tops|long[- ]?sleeve|short[- ]?sleeve|knit|knitted(?!\s*hat)|sweater|cardigan)\b', _re.I)),
    ('tech',        _re.compile(r'\b(iphone|samsung|airpod|airpods|earpod|earbud|earphone|headphone|laptop|macbook|ipad|tablet|charger|cable|speaker|airtag|dyson|stanley|kindle|switch|playstation|xbox|drone|smartwatch)\b', _re.I)),
    ('headwear',    _re.compile(r'\b(hat|hats|cap|caps|beanie|beanies|bucket[ -]?hat|trucker|snapback|fedora|visor|skull[ -]?cap|knit cap|toque)\b', _re.I)),
    ('accessories', _re.compile(r'\b(scarf|scarves|glove|gloves|belt|belts|wallet|cardholder|card[- ]?holder|sunglasses?|glasses?|watch|watches|jewel(?:ry|lery)?|necklace|chain|ring|earring|bracelet|brooch|bandana|tie\b|bowtie|cufflink|umbrella|keychain|sock|socks|mask)\b', _re.I)),
    ('womens',      _re.compile(r'\b(womens?|women\'s|female|ladies|dress|skirt|bra|bralette|crop[- ]?top|romper|jumpsuit|bodysuit)\b', _re.I)),
]

def auto_category(name, fallback=''):
    """Return the most likely category slug for a product name, or `fallback`.
    First-match-wins against the rules above. Used when the operator adds a
    product without picking a category (or when bulk-importing)."""
    if not name:
        return fallback
    for slug, pat in _AUTO_CATEGORY_RULES:
        if pat.search(name):
            return slug
    return fallback
