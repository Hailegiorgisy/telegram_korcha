#!/usr/bin/env python3
"""
scrape_telegram_channel.py
Extracts 100 distinct products (name, price, size, description, photo URLs)
from https://t.me/s/originalcosmeticsaddisusa using only Python's standard library,
strips private contact info, categorizes them into USA, KOREAN, and ARABIAN shelves,
saves them to extracted_100_products.json for review/editing, and injects them
into Korcha's index.html and dist/index.html.

Usage (from D:\Projects\korcha):
    python scrape_telegram_channel.py           # Scrape 100 products + save JSON + inject into HTML
    python scrape_telegram_channel.py --inject  # Re-inject your edited extracted_100_products.json
"""

import html
import json
import os
import re
import sys
import time
import urllib.request

CHANNEL_URL = "https://t.me/s/originalcosmeticsaddisusa"
OUTPUT_JSON = "extracted_100_products.json"
TARGET_COUNT = 100
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

KOREA_KEYWORDS = [
    "korea", "korean", "k-beauty", "cosrx", "anua", "joseon", "skin1004",
    "laneige", "innisfree", "etude", "missha", "some by mi", "torriden",
    "tirtir", "medicube", "round lab", "klairs", "snail", "centella",
]
ARABIAN_KEYWORDS = [
    "arabian", "dubai", "uae", "saudi", "oud", "lattafa", "armaf", "afnan",
    "rasasi", "ajmal", "bakhoor", "attar", "musk", "amber", "khamrah",
    "al rehab", "swiss arabian",
]


def fetch_page(before_id=None):
    url = f"{CHANNEL_URL}?before={before_id}" if before_id else CHANNEL_URL
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_private_info(text):
    # Remove phone numbers, @handles, and t.me links
    text = re.sub(r"(?:\+?251|0)?[\s\-]?9\d{2}[\s\-]?\d{3}[\s\-]?\d{3}", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"https?://t\.me/\S+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def classify_origin(text):
    lower = text.lower()
    if any(k in lower for k in KOREA_KEYWORDS):
        return "KOREAN"
    if any(k in lower for k in ARABIAN_KEYWORDS):
        return "ARABIAN"
    return "USA"


def classify_category(text, origin):
    lower = text.lower()
    if any(k in lower for k in ["perfume", "eau de", "oud", "cologne", "fragrance", "mist", "body spray"]):
        return "Perfume & Oud" if origin == "ARABIAN" else "Others"
    if any(k in lower for k in ["pediasure", "ensure", "glucerna", "vitamin", "whey", "protein", "omega", "dha", "fish oil", "collagen", "supplement", "gummy", "gummies", "zinc", "magnesium"]):
        return "Supplements"
    if any(k in lower for k in ["serum", "cream", "cleanser", "lotion", "soap", "moisturizer", "sunscreen", "spf", "toner", "mask", "wash", "scrub", "essence", "retinol", "niacinamide", "dove", "irish spring", "cerave", "cetaphil", "neutrogena"]):
        return "Skin care products"
    if any(k in lower for k in ["chocolate", "coffee", "tea", "snack", "honey", "milk", "formula"]):
        return "Food"
    return "Others"


def extract_price_etb(text):
    patterns = [
        r"(?:price|ዋጋ|birr|etb)\s*[:\-]?\s*([\d,]{3,7})",
        r"([\d,]{3,7})\s*(?:birr|etb|ብር)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                val = int(m.group(1).replace(",", ""))
                if 50 <= val <= 500000:
                    return val
            except ValueError:
                pass
    return 0


def extract_size(text):
    m = re.search(r"\b(\d+(?:\.\d+)?\s*(?:ml|l|g|kg|oz|fl\.?\s*oz|pcs|tablets|capsules|pack))\b", text, re.IGNORECASE)
    return m.group(1).strip() if m else "Standard"


def parse_posts(page_html):
    blocks = re.split(r'<div class="tgme_widget_message_wrap[^"]*"', page_html)[1:]
    posts = []
    min_id = None

    for block in blocks:
        post_id_match = re.search(r'data-post="[^/]+/(\d+)"', block)
        post_id = int(post_id_match.group(1)) if post_id_match else None
        if post_id is not None:
            min_id = post_id if min_id is None else min(min_id, post_id)

        photos = re.findall(r"background-image:url\('([^']+)'\)", block)
        photos = [html.unescape(p) for p in photos if "cdn" in p or "telesco.pe" in p or "http" in p]

        text_match = re.search(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', block, re.DOTALL)
        if not text_match:
            continue

        raw_html = text_match.group(1)
        clean_text = re.sub(r"<br\s*/?>", "\n", raw_html)
        clean_text = re.sub(r"<[^>]+>", " ", clean_text)
        clean_text = html.unescape(clean_text)
        lines = [strip_private_info(ln) for ln in clean_text.splitlines()]
        lines = [ln for ln in lines if ln]

        if not lines or not photos:
            continue

        name = lines[0][:90]
        full_desc = " ".join(lines)[:260]
        price_etb = extract_price_etb(full_desc)
        if price_etb == 0:
            continue

        origin = classify_origin(full_desc)
        category = classify_category(full_desc, origin)

        posts.append({
            "post_id": post_id,
            "country": origin,
            "category": category,
            "name": name,
            "size": extract_size(full_desc),
            "price_etb": price_etb,
            "photo_url": photos[0],
            "photos": photos[:4],
            "description": full_desc,
            "is_bestseller": len(posts) < 15,
        })

    return posts, min_id


def inject_into_html(file_path, products):
    if not os.path.exists(file_path):
        return False
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = re.compile(r"const INITIAL_PRODUCTS\s*=\s*\[.*?\];", re.DOTALL)
    if not pattern.search(content):
        print(f"Skipping {file_path}: INITIAL_PRODUCTS block not found.")
        return False

    js_array = json.dumps(products, ensure_ascii=False, indent=2)
    updated = pattern.sub(f"const INITIAL_PRODUCTS = {js_array};", content, count=1)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated)
    print(f"Updated {file_path} with {len(products)} products.")
    return True


def main():
    if "--inject" in sys.argv:
        if not os.path.exists(OUTPUT_JSON):
            print(f"Error: {OUTPUT_JSON} not found. Run without --inject first.")
            sys.exit(1)
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            collected = json.load(f)
        print(f"Loaded {len(collected)} edited products from {OUTPUT_JSON}")
    else:
        collected = []
        seen_names = set()
        before_id = None
        pages_fetched = 0

        print(f"Fetching up to {TARGET_COUNT} products from {CHANNEL_URL}...")
        while len(collected) < TARGET_COUNT and pages_fetched < 30:
            pages_fetched += 1
            page_html = fetch_page(before_id)
            posts, min_id = parse_posts(page_html)

            for p in reversed(posts):
                key = p["name"].lower()
                if key not in seen_names:
                    seen_names.add(key)
                    p["id"] = len(collected) + 1
                    p.pop("post_id", None)
                    collected.append(p)
                    if len(collected) >= TARGET_COUNT:
                        break

            print(f"Page {pages_fetched}: collected {len(collected)}/{TARGET_COUNT} products (oldest post_id={min_id})")
            if min_id is None or min_id <= 1:
                break
            before_id = min_id
            time.sleep(0.5)

        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(collected, f, ensure_ascii=False, indent=2)
        print(f"\nSaved {len(collected)} products to {os.path.abspath(OUTPUT_JSON)}")

    for target in ["index.html", "dist/index.html", "../korcha_web/index.html", "../korcha_web/dist/index.html"]:
        inject_into_html(target, collected)


if __name__ == "__main__":
    main()