"""
Product scraper for the master admin's "Add to all sites" composer.

Given a pasted Weidian / Taobao / 1688 (or KakoBuy-wrapped) link, returns the
fields that CAN be reliably scraped, plus a manifest of fields the operator
must fill in by hand.

Scrapable:  name (raw), base price, per-style variants (name+image+price),
            image gallery, platform + item_id, derived USD price.
Manual:     qc_photos, sizes, batch, retail_price, quality, weight, seller.
            category is auto-suggested from the name but editable.

Ported/condensed from the per-site scraper.py (Weidian Thor API path is the
gold standard; Taobao/1688 are best-effort HTML).
"""
import os
import re
import json
import urllib.parse
import requests

CNY_TO_USD = 0.14
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
AI_CATEGORIES = ['shoes', 'shirts', 'hoodies', 'pants', 'shorts', 'jackets',
                 'headwear', 'accessories', 'bags', 'tech', 'womens']


def _ai_identify(image_url, listing_name=''):
    """One GPT-4o-mini vision call to clean up a scraped listing into a proper
    product: real brand+model name, category, search tags. Returns {} on any
    failure (so scrape still works without AI). Cheap: ONE call per scrape."""
    if not OPENAI_API_KEY or not image_url:
        return {}
    cats = ', '.join(AI_CATEGORIES)
    sys_prompt = (
        "You identify replica fashion products. Respond with ONLY valid JSON: "
        '{"name":"Brand Model Colorway","brand":"Brand","category":"category","tags":"search keywords"}. '
        "Rules: name = brand + specific model + color, MAX 6 words, use the REAL model name "
        "(e.g. 'Dunk Low Panda' not 'Sneaker', 'Reverend Hoodie' not 'Hoodie'). "
        f"category = one of [{cats}]. brand = the fashion house (Nike, Adidas, Jordan, "
        "Balenciaga, Louis Vuitton, Gucci, Chrome Hearts, Moncler, Yeezy, Off-White, Amiri, "
        "Represent, Essentials, Stussy, Supreme, Bape, Gallery Dept, Trapstar, Corteiz, etc). "
        "tags = lowercase space-separated keywords (brand, model, color, material, style). "
        "Color one word at the end."
    )
    try:
        resp = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
            json={
                'model': 'gpt-4o-mini',
                'messages': [
                    {'role': 'system', 'content': sys_prompt},
                    {'role': 'user', 'content': [
                        {'type': 'text', 'text': f'Listing title (may be Chinese/messy): "{listing_name}". Identify the product.'},
                        {'type': 'image_url', 'image_url': {'url': image_url}},
                    ]},
                ],
                'max_tokens': 120,
                'temperature': 0.1,
            },
            timeout=15,
        )
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content'].strip()
            content = re.sub(r'^```(?:json)?|```$', '', content, flags=re.I).strip()
            data = json.loads(content)
            if isinstance(data, dict):
                return data
    except Exception as e:
        print(f"[AI] identify failed: {e}")
    return {}

HEADERS_MOBILE = {
    "User-Agent": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                   "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.43"),
    "Accept": "application/json, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
HEADERS_DESKTOP = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# Fields the operator must always confirm/fill by hand (not on the source listing).
MANUAL_FIELDS = ["qc_photos", "sizes", "batch", "retail_price", "quality", "weight", "seller"]


def _unwrap_agent_url(url):
    """Return the inner Weidian/Taobao/1688 seller URL from any agent wrapper
    (kakobuy/mulebuy/cnfans/sugargoo/oopbuy/hipobuy/allchinabuy/hagobuy/… ), whether
    the seller link is carried in a ?url=-style param or embedded in the path/query."""
    if not url:
        return url
    try:
        # 1) common params that carry the (possibly double-encoded) seller URL
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        wanted = ("url", "producturl", "product_url", "productlink", "goodsurl",
                  "goods_url", "targeturl", "target_url", "link", "u")
        for k in qs:
            if k.lower() in wanted and qs[k]:
                inner = urllib.parse.unquote(qs[k][0])
                if inner.startswith("http"):
                    url = inner
                    break
        # 2) fallback: a seller URL embedded anywhere in the decoded string
        dec = urllib.parse.unquote(url)
        m = re.search(r'https?://[^\s"\'<>]*?(?:weidian\.com/item|(?:taobao|tmall)\.com/item|1688\.com/offer)[^\s"\'<>]*', dec, re.I)
        if m:
            return m.group(0)
    except Exception:
        pass
    return url


def _parse_item_url(url):
    """Return (platform, item_id) for a raw seller URL, or (None, None)."""
    url = _unwrap_agent_url(url or "")
    m = re.search(r'itemID(?:%3D|=)(\d+)', url, re.I)
    if 'weidian' in url and m:
        return ('weidian', m.group(1))
    m = re.search(r'[?&]id(?:%3D|=)(\d+)', url, re.I)
    if ('taobao' in url or 'tmall' in url) and m:
        return ('taobao', m.group(1))
    m = re.search(r'/offer/(\d+)', url)
    if '1688' in url and m:
        return ('1688', m.group(1))
    # last resort: any itemID / id digits
    m = re.search(r'itemID(?:%3D|=)(\d+)', url, re.I) or re.search(r'[?&]id(?:%3D|=)(\d+)', url, re.I)
    if m:
        plat = 'weidian' if 'weidian' in url else ('taobao' if ('taobao' in url or 'tmall' in url) else None)
        if plat:
            return (plat, m.group(1))
    return (None, None)


def _to_yuan(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 0.0
    return v / 100 if v > 500 else v  # fen -> yuan heuristic


def _scrape_weidian(item_id):
    out = {"name": "", "image": "", "images": [], "variants": [], "sizes": [], "price_cny": 0.0}
    try:
        param = urllib.parse.quote(json.dumps({"itemId": item_id}, separators=(',', ':')))
        api = f"https://thor.weidian.com/detail/getItemSkuInfo/1.0?param={param}"
        r = requests.get(api, headers={**HEADERS_MOBILE,
                         "Referer": f"https://shop.weidian.com/item.html?itemID={item_id}",
                         "Origin": "https://shop.weidian.com"}, timeout=12)
        data = (r.json() or {}).get("result") or {}
    except Exception:
        return out

    out["name"] = data.get("itemTitle") or data.get("title") or data.get("itemName") or ""
    main = data.get("itemMainPic", "")
    if main:
        out["image"] = main
        out["images"].append(main)

    # Per-color price map from skuInfos: attrIds[0] (color) -> lowest yuan price
    sku_prices = {}
    skus = data.get("skuInfos") or data.get("skuList") or data.get("skuMap") or []
    if isinstance(skus, dict):
        skus = list(skus.values())
    for sku in skus:
        info = sku.get("skuInfo", sku) if isinstance(sku, dict) else {}
        price = _to_yuan(info.get("discountPrice") or info.get("originalPrice") or info.get("price") or 0)
        if price <= 0:
            continue
        aid = sku.get("attrIds") or info.get("attrIds") or ""
        color_id = str(aid[0]) if isinstance(aid, list) and aid else (aid.split(';')[0].strip() if isinstance(aid, str) else "")
        if color_id and (color_id not in sku_prices or price < sku_prices[color_id]):
            sku_prices[color_id] = price

    # attrList -> color/style variants (with image+price) and sizes (separate)
    for group in data.get("attrList") or []:
        title = (group.get("attrTitle") or "").lower()
        is_size = any(k in title for k in ['size', '尺码', '码', '尺寸', '号'])
        is_color = any(k in title for k in ['色', 'color', '配色', '款式', '款', 'style', '版本'])
        for val in group.get("attrValues", []):
            name = val.get("attrValue", "")
            if not name:
                continue
            if is_size and not is_color:
                out["sizes"].append(name)
                continue
            vid = str(val.get("attrId", ""))
            img = val.get("img", "")
            variant = {"name": name, "image": img}
            if vid in sku_prices:
                variant["price_cny"] = round(sku_prices[vid], 2)
                variant["price"] = round(sku_prices[vid] * CNY_TO_USD, 2)
            if img and img not in out["images"]:
                out["images"].append(img)
            out["variants"].append(variant)

    prices = [v["price_cny"] for v in out["variants"] if v.get("price_cny")]
    if prices:
        out["price_cny"] = min(prices)
    elif sku_prices:
        out["price_cny"] = min(sku_prices.values())
    return out


def _scrape_html_generic(item_id, platform):
    """Best-effort Taobao/1688 — title + images only (variants/prices unreliable without auth)."""
    out = {"name": "", "image": "", "images": [], "variants": [], "sizes": [], "price_cny": 0.0}
    try:
        if platform == 'taobao':
            url = f"https://h5.m.taobao.com/awp/core/detail.htm?id={item_id}"
            cdn = r'(https?://(?:img|gw)\.alicdn\.com/[^\s"\'\\<>]+?\.(?:jpg|png|webp))'
        else:
            url = f"https://detail.1688.com/offer/{item_id}.html"
            cdn = r'(https?://cbu\d*\.alicdn\.com/[^\s"\'\\<>]+?\.(?:jpg|png|webp))'
        html = requests.get(url, headers=HEADERS_MOBILE, timeout=12).text
        for pat in [r'"title"\s*:\s*"([^"]{6,200})"', r'"subject"\s*:\s*"([^"]+)"']:
            m = re.search(pat, html)
            if m:
                out["name"] = m.group(1).strip()
                break
        seen = set()
        for img in re.findall(cdn, html):
            c = img.split('?')[0]
            if c not in seen and len(c) > 30:
                seen.add(c); out["images"].append(c)
            if len(out["images"]) >= 12:
                break
        if out["images"]:
            out["image"] = out["images"][0]
        for pat in [r'"price"\s*:\s*"?(\d+\.?\d{0,2})"?']:
            m = re.search(pat, html)
            if m:
                out["price_cny"] = float(m.group(1)); break
    except Exception:
        pass
    return out


def scrape(url):
    """Main entry. Returns a dict the composer UI consumes."""
    platform, item_id = _parse_item_url(url)
    if not platform or not item_id:
        return {"ok": False, "error": "Could not parse a Weidian / Taobao / 1688 link from that URL."}

    raw = _scrape_weidian(item_id) if platform == 'weidian' else _scrape_html_generic(item_id, platform)
    price_cny = raw.get("price_cny") or 0.0
    price_usd = round(price_cny * CNY_TO_USD, 2) if price_cny else 0.0

    source_url = {
        'weidian': f"https://weidian.com/item.html?itemID={item_id}",
        'taobao':  f"https://item.taobao.com/item.htm?id={item_id}",
        '1688':    f"https://detail.1688.com/offer/{item_id}.html",
    }.get(platform, url)

    # ONE AI call to turn the raw listing into a proper product (name/category/
    # brand/tags). Cheap + fast; degrades gracefully to the raw name if the key
    # is missing or the call fails.
    ai = _ai_identify(raw.get("image", ""), raw.get("name", ""))

    return {
        "ok": True,
        "platform": platform,
        "item_id": item_id,
        "source_url": source_url,
        "ai_enabled": bool(OPENAI_API_KEY),
        "scraped": {
            "name": (ai.get("name") or raw.get("name", "")),
            "name_raw": raw.get("name", ""),
            "brand": ai.get("brand", ""),
            "category": ai.get("category", ""),
            "tags": ai.get("tags", ""),
            "price": str(price_usd) if price_usd else "",
            "price_numeric": price_usd,
            "price_cny": price_cny,
            "image": raw.get("image", ""),
            "images": raw.get("images", []),
            "variants": raw.get("variants", []),   # [{name,image,price,price_cny}]
            "sizes_detected": raw.get("sizes", []), # informational; operator confirms
        },
        # Tell the UI exactly what still needs a human.
        "manual_required": MANUAL_FIELDS,
        "notes": {
            "name": "Raw listing title — clean it up before pushing.",
            "qc_photos": "Not scrapable (agent QC needs auth). Paste QC image URLs by hand.",
            "sizes": "Auto-detected sizes are unreliable — confirm/replace manually.",
            "category": "Set manually (or it defaults from name keywords).",
            "quality": "Manual: BUDGET / TOP / 1:1.",
        },
    }
