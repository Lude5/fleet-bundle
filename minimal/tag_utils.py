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
