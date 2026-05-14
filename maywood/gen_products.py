"""Generate 100 placeholder products with cartoon SVG illustrations for Kai Finds."""
import json, secrets, os, random

os.makedirs('static/products', exist_ok=True)

# Cartoon SVG generators for each product type
def shoe_svg(c1, c2, sole='#f0f0f0'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(50,120)">
<path d="M40,160 C40,160 30,140 50,120 L80,100 C80,100 120,80 160,80 L260,85 C260,85 300,90 310,110 C320,130 300,160 300,160 Z" fill="{c1}" stroke="{c2}" stroke-width="3"/>
<path d="M30,160 L310,160 C310,160 320,160 320,170 L320,185 C320,195 310,195 310,195 L30,195 C20,195 20,185 20,185 L20,170 C20,160 30,160 30,160 Z" fill="{sole}"/>
<path d="M80,100 C80,100 100,95 120,100 L130,120 L90,125 Z" fill="{c2}" opacity="0.7"/>
<circle cx="270" cy="120" r="15" fill="{c2}" opacity="0.5"/>
</g></svg>'''

def hoodie_svg(c1, c2):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(60,40)">
<path d="M80,80 L60,280 L220,280 L200,80 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<path d="M80,80 L40,180 L20,180 L60,80 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<path d="M200,80 L240,180 L260,180 L220,80 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<path d="M100,60 C100,40 180,40 180,60 L180,90 L100,90 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<ellipse cx="140" cy="55" rx="25" ry="15" fill="{c2}" opacity="0.15"/>
</g></svg>'''

def tee_svg(c1, c2, accent='#fff'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(60,60)">
<path d="M80,40 L40,80 L10,60 L60,0 L100,20 L180,20 L220,0 L270,60 L240,80 L200,40 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<path d="M80,40 L70,280 L210,280 L200,40 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<text x="140" y="170" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="42" font-weight="900" fill="{accent}" opacity="0.4">TEE</text>
</g></svg>'''

def pants_svg(c1, c2):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(80,30)">
<path d="M20,20 L220,20 L220,60 L180,60 L160,320 L120,320 L120,140 L110,140 L80,320 L40,320 L60,60 L20,60 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<rect x="60" y="80" width="50" height="40" rx="6" fill="{c2}" opacity="0.15"/>
<rect x="130" y="80" width="50" height="40" rx="6" fill="{c2}" opacity="0.15"/>
</g></svg>'''

def jacket_svg(c1, c2):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(50,40)">
<path d="M90,50 L50,100 L20,90 L70,10 L110,30 L190,30 L230,10 L280,90 L250,100 L210,50 Z" fill="{c1}" stroke="{c2}" stroke-width="2.5"/>
<path d="M90,50 L80,290 L145,290 L145,50 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<path d="M155,50 L155,290 L220,290 L210,50 Z" fill="{c1}" stroke="{c2}" stroke-width="2"/>
<line x1="150" y1="50" x2="150" y2="290" stroke="{c2}" stroke-width="3"/>
<circle cx="130" cy="160" r="5" fill="{c2}"/>
<circle cx="130" cy="200" r="5" fill="{c2}"/>
<circle cx="130" cy="240" r="5" fill="{c2}"/>
</g></svg>'''

def bag_svg(c1, c2):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(70,40)">
<rect x="20" y="100" width="220" height="220" rx="16" fill="{c1}" stroke="{c2}" stroke-width="2.5"/>
<path d="M80,100 L80,60 C80,30 180,30 180,60 L180,100" fill="none" stroke="{c2}" stroke-width="4"/>
<rect x="100" y="170" width="60" height="40" rx="8" fill="{c2}" opacity="0.25"/>
</g></svg>'''

def acc_svg(c1, c2):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(40,150)">
<rect x="10" y="20" width="310" height="50" rx="6" fill="{c1}" stroke="{c2}" stroke-width="2.5"/>
<rect x="130" y="5" width="60" height="80" rx="8" fill="{c2}" opacity="0.3"/>
<circle cx="160" cy="45" r="12" fill="{c2}"/>
</g></svg>'''

def tech_svg(c1, c2):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#141414" rx="20"/>
<g transform="translate(110,60)">
<ellipse cx="90" cy="140" rx="75" ry="95" fill="{c1}" stroke="{c2}" stroke-width="2.5"/>
<ellipse cx="90" cy="140" rx="55" ry="70" fill="#141414"/>
<rect x="65" y="240" width="50" height="80" rx="25" fill="{c1}" stroke="{c2}" stroke-width="2"/>
</g></svg>'''

# Color palettes for each category
shoe_styles = [
    ('Nike Dunk Low Panda', '#f5f5f5', '#1a1a1a'),
    ('Jordan 4 Black Cat', '#2a2a2a', '#888'),
    ('Jordan 4 White Cement', '#e5e5e5', '#aaa'),
    ('Jordan 1 Chicago', '#f0f0f0', '#cc0000'),
    ('Jordan 1 Bred', '#1a1a1a', '#cc0000'),
    ('Air Force 1 White', '#ffffff', '#999'),
    ('Yeezy Slide Bone', '#d4c5a8', '#a89580'),
    ('Yeezy Slide Onyx', '#222', '#555'),
    ('New Balance 550 Green', '#fff', '#2d6a4f'),
    ('Travis Scott AJ1 Low', '#8B6914', '#5c4a1e'),
    ('Balenciaga Track Sneaker', '#1a1a2e', '#4cc9f0'),
    ('Adidas Samba Black White', '#1a1a1a', '#fff'),
    ('Vans Old Skool Black', '#1a1a1a', '#fff'),
    ('Converse Chuck Taylor', '#fff', '#1a1a1a'),
    ('Asics Gel-Kayano 14', '#c0c0c0', '#3b82f6'),
]

hoodie_styles = [
    ('Essentials Hoodie Black', '#1a1a1a', '#444'),
    ('Essentials Hoodie Cream', '#e8e0d0', '#a89880'),
    ('Chrome Hearts Hoodie Black', '#1a0a2a', '#c77dff'),
    ('Stussy Hoodie Grey', '#888', '#aaa'),
    ('Supreme Box Logo Red', '#cc0000', '#fff'),
    ('Represent Hoodie Charcoal', '#3a3a3a', '#aaa'),
    ('Travis Scott Hoodie Brown', '#5c4a1e', '#aaa'),
    ('Gallery Dept Hoodie White', '#f0f0f0', '#e63946'),
    ('Trapstar Hoodie Black', '#1a1a1a', '#ff4d6d'),
    ('Corteiz Hoodie Olive', '#5d6a3f', '#aaa'),
    ('Hellstar Hoodie Black', '#0a0a0a', '#ff6b6b'),
    ('Denim Tears Cotton Wreath', '#1a3a5c', '#fff'),
]

shirt_styles = [
    ('Stussy Logo Tee White', '#f0f0f0', '#222'),
    ('Bape Camo Tee Green', '#5d6a3f', '#3a2a1a'),
    ('Palm Angels Logo Tee', '#f5f5f5', '#cc0000'),
    ('Chrome Hearts Horseshoe Tee', '#1a1a1a', '#aaa'),
    ('Gallery Dept Tee Cream', '#e8e0d0', '#cc0000'),
    ('Trapstar Tee Black', '#1a1a1a', '#ff4d6d'),
    ('Off-White Diagonal Tee', '#1a1a1a', '#fff'),
    ('Travis Scott Cactus Jack Tee', '#3a2a1a', '#d4a574'),
    ('Vetements Logo Tee White', '#f0f0f0', '#1a1a1a'),
    ('Yeezy Season Tee Sand', '#d4c5a8', '#888'),
    ('Vlone V Tee Black', '#1a1a1a', '#cc0000'),
    ('Anti Social Social Club Tee', '#f0f0f0', '#ff66b3'),
]

pants_styles = [
    ('Nike Tech Fleece Joggers', '#1a1a1a', '#444'),
    ('Essentials Sweatpants Cream', '#e8e0d0', '#a89880'),
    ('Cargo Pants Khaki', '#a0855b', '#7a6540'),
    ('Corteiz Cargo Black', '#1a1a1a', '#5d6a3f'),
    ('Amiri Jeans Blue Distressed', '#1a3a5c', '#90e0ef'),
    ('Gallery Dept Flare Jeans', '#1a3a5c', '#fff'),
    ('Stussy Sweatpants Grey', '#888', '#aaa'),
    ('Palm Angels Track Pants', '#1a1a1a', '#fff'),
    ('Represent Distressed Jeans', '#3a3a3a', '#aaa'),
    ('True Religion Jeans Indigo', '#1a3a5c', '#d4a574'),
]

jacket_styles = [
    ('Moncler Maya Puffer Black', '#1a1a1a', '#888'),
    ('Moncler Maya Puffer Navy', '#1a3a5c', '#aaa'),
    ('North Face Nuptse Black', '#1a1a1a', '#fff'),
    ('North Face Nuptse Brown', '#5c4a1e', '#aaa'),
    ('Stone Island Down Jacket', '#5d6a3f', '#aaa'),
    ('Carhartt Detroit Jacket Brown', '#8B6914', '#aaa'),
    ('Trapstar Irongate Jacket', '#1a1a1a', '#ff4d6d'),
    ('Canada Goose Chilliwack', '#1a1a1a', '#fff'),
    ('Patagonia Retro-X Fleece', '#d4a574', '#5c4a1e'),
]

bag_styles = [
    ('Goyard Tote Bag Black', '#1a1a1a', '#fff'),
    ('LV Keepall 50 Monogram', '#5c4a1e', '#d4a574'),
    ('Gucci Soho Disco Bag', '#5c4a1e', '#cc0000'),
    ('Dior Saddle Bag Black', '#1a1a1a', '#d4a574'),
    ('Prada Re-Edition 2005', '#1a1a1a', '#fff'),
    ('Balenciaga Hourglass Bag', '#1a1a1a', '#888'),
    ('Chanel Classic Flap Black', '#1a1a1a', '#d4af37'),
    ('Hermès Birkin 30 Black', '#1a1a1a', '#d4af37'),
]

acc_styles = [
    ('Off-White Industrial Belt', '#1b1b1b', '#ffd60a'),
    ('LV Initiales Belt Brown', '#5c4a1e', '#d4af37'),
    ('Gucci GG Belt Black', '#1a1a1a', '#d4af37'),
    ('Cartier Love Bracelet Gold', '#d4af37', '#fff'),
    ('Rolex Submariner Black', '#1a1a1a', '#d4af37'),
    ('Casio G-Shock GA-2100', '#1a1a1a', '#fff'),
    ('Ray-Ban Wayfarer Sunglasses', '#1a1a1a', '#888'),
    ('Dior Mens Sunglasses', '#1a1a1a', '#d4a574'),
    ('Supreme Box Logo Beanie', '#cc0000', '#fff'),
    ('Burberry Cashmere Scarf', '#d4a574', '#1a1a1a'),
    ('Van Cleef Alhambra Necklace', '#d4af37', '#fff'),
    ('Chrome Hearts Cross Ring', '#c0c0c0', '#1a1a1a'),
]

tech_styles = [
    ('AirPods Pro 2 White', '#e8e8e8', '#cccccc'),
    ('AirPods Max Silver', '#c0c0c0', '#aaa'),
    ('Apple Watch Ultra Black', '#1a1a1a', '#d4af37'),
    ('Beats Studio Pro Black', '#1a1a1a', '#cc0000'),
    ('Sony WH-1000XM5 Silver', '#c0c0c0', '#1a1a1a'),
    ('Bose QuietComfort 45', '#1a1a1a', '#fff'),
]

womens_styles = [
    ('Lululemon Align Leggings Black', '#1a1a1a', '#888'),
    ('Skims Cotton Set Mocha', '#5c4a1e', '#d4a574'),
    ('Alo Yoga High-Waist Legging', '#1a3a5c', '#fff'),
    ('Free People Beach Set Cream', '#e8e0d0', '#a89880'),
]

# Build all products
products = []

categories = [
    ('shoes', shoe_styles, shoe_svg),
    ('hoodies', hoodie_styles, hoodie_svg),
    ('shirts', shirt_styles, tee_svg),
    ('pants', pants_styles, pants_svg),
    ('jackets', jacket_styles, jacket_svg),
    ('bags', bag_styles, bag_svg),
    ('accessories', acc_styles, acc_svg),
    ('tech', tech_styles, tech_svg),
    ('womens', womens_styles, pants_svg),
]

# Reasonable price ranges per category
price_ranges = {
    'shoes': (25, 95),
    'hoodies': (22, 55),
    'shirts': (12, 38),
    'pants': (18, 48),
    'jackets': (35, 140),
    'bags': (45, 280),
    'accessories': (8, 85),
    'tech': (28, 145),
    'womens': (18, 65),
}

for cat, styles, svg_fn in categories:
    for i, (name, c1, c2) in enumerate(styles):
        slug = name.lower().replace(' ', '-').replace('/', '-').replace("'", '')
        svg_path = f'static/products/{cat}-{i}.svg'
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_fn(c1, c2))
        lo, hi = price_ranges[cat]
        price = round(random.uniform(lo, hi), 2)
        products.append({
            'id': f'p{secrets.token_hex(4)}',
            'name': name,
            'category': cat,
            'price': f'{price:.2f}',
            'price_numeric': price,
            'url': 'https://weidian.com/item.html?itemID=placeholder',
            'image': f'/static/products/{cat}-{i}.svg',
            'seller': '',
            'batch': '',
            'retail_price': '',
            'tags': cat,
        })

# Add some "trending" items by tagging the most popular ones
trending_picks = random.sample(products, min(15, len(products)))
for p in trending_picks:
    trend_copy = dict(p)
    trend_copy['id'] = f'p{secrets.token_hex(4)}'
    trend_copy['category'] = 'trending'
    trend_copy['tags'] = 'trending'
    products.append(trend_copy)

# Save
with open('static/products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

from collections import Counter
cats = Counter(p['category'] for p in products)
print(f'Generated {len(products)} placeholder products:')
for c, n in cats.most_common():
    print(f'  {c}: {n}')
