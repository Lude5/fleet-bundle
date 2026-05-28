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
    ('accessories', _re.compile(r'\b(hat|hats|cap|caps|beanie|scarf|scarves|glove|gloves|belt|belts|wallet|cardholder|card[- ]?holder|sunglasses?|glasses?|watch|watches|jewel(?:ry|lery)?|necklace|chain|ring|earring|bracelet|brooch|bandana|tie\b|bowtie|cufflink|umbrella|keychain|sock|socks|mask)\b', _re.I)),
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
