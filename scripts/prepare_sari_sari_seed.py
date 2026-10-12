"""Prepare synthetic inventory SQL and licensed representative photos; no cloud writes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import html
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "sari-sari-starter"
PHOTOS = {
    "rice": (7232901, "close-up-shot-of-rice-grains", "Artem Podrez"),
    "sugar": (7966490, "person-pouring-sugar-in-a-bowl", "Felicity Tai"),
    "salt": (4475228, "wooden-spoon-with-salt-on-table", "Pexels photographer (see source)"),
    "eggs": (4045699, "eggs-on-a-red-background", "Pexels photographer (see source)"),
    "oil": (12284682, "clear-plastic-bottles-with-yellow-liquid", "Towfiqu barbhuiya"),
    "noodles": (6940984, "bowl-of-instant-noodles-placed-on-checkered-tablecloth-in-kitchen", "Pexels photographer (see source)"),
    "sardines": (9797030, "close-up-shot-of-sardines-in-a-can", "Towfiqu barbhuiya"),
    "coffee": (6781594, "jar-of-coffee-on-table", "Pexels photographer (see source)"),
    "milk": (6341410, "faceted-glass-of-fresh-milk-on-white-cloth", "Marta Dzedyshko"),
    "water": (11860560, "bottles-of-water", "Pexels photographer (see source)"),
    "cola": (19771998, "cola-in-glass-on-table", "Tom Johnny fotografias"),
    "biscuits": (1340465, "brown-crackers-on-black-cloth", "Pexels photographer (see source)"),
    "chips": (32457159, "close-up-of-crunchy-ridged-potato-chips-in-bowl", "Markus Winkler"),
    "candy": (1875919, "colourful-candies", "Alexander Grey"),
    "soap": (6690197, "close-up-photo-of-bath-soaps", "Pexels photographer (see source)"),
    "shampoo": (7440056, "photograph-of-a-white-bottle-with-shampoo", "cottonbro studio"),
    "detergent": (5218021, "plastic-bottle-of-detergent-in-studio", "Pexels photographer (see source)"),
    "dishwashing": (31175782, "hand-holding-lemon-dishwashing-liquid-by-waterfront", "Pexels photographer (see source)"),
    "toothpaste": (14456100, "colgate-toothpaste-on-yellow-surface", "Pexels photographer (see source)"),
    "soy-sauce": (19730266, "five-bottles-of-soy-sauce-in-the-kitchen", "Pexels photographer (see source)"),
    "bread": (8599584, "brown-bread-on-white-table", "Pexels photographer (see source)"),
}
# name, category, selling price in PHP, unit cost in PHP, opening units, low-stock threshold, photo
ROWS = [
    ("Regular White Rice - 1 kg", "Rice & Pantry", 55, 47, 50, 10, "rice"),
    ("Premium White Rice - 1 kg", "Rice & Pantry", 65, 56, 35, 8, "rice"),
    ("White Sugar - 250 g", "Rice & Pantry", 25, 19, 40, 10, "sugar"),
    ("White Sugar - 1 kg", "Rice & Pantry", 90, 75, 20, 5, "sugar"),
    ("Iodized Salt - 250 g", "Rice & Pantry", 12, 8, 30, 8, "salt"),
    ("Chicken Egg - 1 piece", "Eggs & Bread", 9, 7, 90, 20, "eggs"),
    ("Cooking Oil - 250 mL", "Condiments", 35, 27, 30, 8, "oil"),
    ("Cooking Oil - 1 L", "Condiments", 125, 105, 15, 4, "oil"),
    ("Instant Noodles Chicken - 55 g", "Noodles & Canned Goods", 12, 9, 60, 15, "noodles"),
    ("Instant Noodles Beef - 55 g", "Noodles & Canned Goods", 12, 9, 48, 12, "noodles"),
    ("Instant Pancit Canton Chili - 60 g", "Noodles & Canned Goods", 16, 12, 48, 12, "noodles"),
    ("Sardines in Tomato Sauce - 155 g", "Noodles & Canned Goods", 25, 20, 36, 10, "sardines"),
    ("Spicy Sardines - 155 g", "Noodles & Canned Goods", 27, 22, 24, 6, "sardines"),
    ("Instant Coffee - 2 g sachet", "Coffee & Milk", 5, 3, 100, 25, "coffee"),
    ("3-in-1 Coffee - 20 g sachet", "Coffee & Milk", 10, 7, 100, 25, "coffee"),
    ("Powdered Milk Drink - 33 g sachet", "Coffee & Milk", 15, 11, 60, 15, "milk"),
    ("Evaporated Milk - 150 mL", "Coffee & Milk", 30, 24, 24, 6, "milk"),
    ("Drinking Water - 500 mL", "Beverages", 15, 10, 48, 12, "water"),
    ("Drinking Water - 1 L", "Beverages", 25, 18, 24, 6, "water"),
    ("Cola Soft Drink - 250 mL", "Beverages", 20, 14, 36, 10, "cola"),
    ("Cola Soft Drink - 1.5 L", "Beverages", 75, 62, 12, 4, "cola"),
    ("Plain Crackers - 25 g pack", "Snacks & Candy", 8, 5, 60, 15, "biscuits"),
    ("Plain Crackers - 90 g pack", "Snacks & Candy", 25, 19, 24, 6, "biscuits"),
    ("Butter Biscuits - 30 g pack", "Snacks & Candy", 10, 7, 48, 12, "biscuits"),
    ("Potato Chips Original - 25 g", "Snacks & Candy", 15, 10, 40, 10, "chips"),
    ("Potato Chips Cheese - 25 g", "Snacks & Candy", 15, 10, 40, 10, "chips"),
    ("Fruit Candy - 1 piece", "Snacks & Candy", 2, 1, 200, 50, "candy"),
    ("Fruit Candy - 20 piece pack", "Snacks & Candy", 30, 20, 20, 5, "candy"),
    ("Bath Soap - 90 g bar", "Personal Care", 25, 19, 30, 8, "soap"),
    ("Shampoo - 12 mL sachet", "Personal Care", 8, 5, 100, 25, "shampoo"),
    ("Shampoo - 180 mL bottle", "Personal Care", 95, 75, 12, 4, "shampoo"),
    ("Liquid Laundry Detergent - 250 mL", "Household Cleaning", 35, 26, 24, 6, "detergent"),
    ("Liquid Laundry Detergent - 500 mL", "Household Cleaning", 65, 50, 18, 5, "detergent"),
    ("Dishwashing Liquid - 250 mL", "Household Cleaning", 35, 25, 24, 6, "dishwashing"),
    ("Toothpaste - 24 g tube", "Personal Care", 25, 18, 30, 8, "toothpaste"),
    ("Toothpaste - 100 g tube", "Personal Care", 65, 50, 18, 5, "toothpaste"),
    ("Soy Sauce - 200 mL", "Condiments", 20, 14, 24, 6, "soy-sauce"),
    ("Soy Sauce - 500 mL", "Condiments", 40, 30, 18, 5, "soy-sauce"),
    ("Sliced Bread - 400 g loaf", "Eggs & Bread", 55, 43, 15, 5, "bread"),
    ("Bath Soap - 135 g bar", "Personal Care", 38, 28, 24, 6, "soap"),
]


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def download(item):
    key, (photo_id, slug, credit) = item
    path = ASSETS / "images" / f"{key}.jpg"
    url = f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w=640"
    if not path.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "SmartPOS Starter Catalog"})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
            if not response.headers.get("Content-Type", "").startswith("image/"):
                raise ValueError(f"Expected an image for {key}")
        if not data.startswith(b"\xff\xd8") or len(data) > 5 * 1024 * 1024:
            raise ValueError(f"Invalid or oversized JPEG for {key}")
        path.write_bytes(data)
    return {"file": path.name, "source": f"https://www.pexels.com/photo/{slug}-{photo_id}/", "photographer": credit, "download_url": url}


def main():
    (ASSETS / "images").mkdir(parents=True, exist_ok=True)
    catalog = []
    for index, (name, category, price, cost, stock, low, image) in enumerate(ROWS, 1):
        catalog.append({"sku": f"SSS-{index:03d}", "name": name, "category": category,
                        "price_cents": price * 100, "cost_cents": cost * 100,
                        "stock": stock, "low_stock_threshold": low, "image_file": f"{image}.jpg"})
    assert len(catalog) == 40 and all(row["price_cents"] >= row["cost_cents"] for row in catalog)
    (ASSETS / "products.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    values = ",\n".join(" (" + ", ".join(literal(row[key]) if isinstance(row[key], str) else str(row[key]) for key in catalog[0]) + ")" for row in catalog)
    template = (ROOT / "scripts" / "sari_sari_seed_template.sql").read_text(encoding="utf-8")
    sql = template.replace("-- PRODUCT_VALUES", values)
    target = ROOT / "supabase" / "seeds" / "sari_sari_products.sql"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(sql, encoding="utf-8")
    with ThreadPoolExecutor(max_workers=4) as pool:
        sources = list(pool.map(download, PHOTOS.items()))
    (ASSETS / "image-sources.json").write_text(json.dumps(sources, indent=2) + "\n", encoding="utf-8")
    credits = "# Starter product photos\n\nRepresentative stock photographs, not exact brand, package, flavor or size matches.\nReplace with photos of your actual products when available.\n\nLicense: https://www.pexels.com/license/\nPhotos may be used on websites and apps under that license.\n\n"
    credits += "\n".join(f"- {row['file']}: {row['photographer']} — {row['source']}" for row in sources) + "\n"
    (ASSETS / "IMAGE-CREDITS.md").write_text(credits, encoding="utf-8")
    cards = []
    for row in sources:
        cards.append(f'<article><img src="images/{row["file"]}" alt="{html.escape(row["file"])}"><p>{html.escape(row["file"])}<br><a href="{row["source"]}">Pexels source</a></p></article>')
    preview = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Sari-sari starter photos</title><style>body{font:15px system-ui;background:#f5f7f5;color:#193a32;margin:24px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}article{background:white;padding:10px;border-radius:8px}img{width:100%;height:160px;object-fit:contain}p{margin:8px 0}a{color:#176e58}@media(max-width:700px){main{grid-template-columns:repeat(2,1fr)}}</style><h1>Sari-sari starter photos</h1><p>Representative free stock photos; sizes and flavors share images. Replace with actual product photos when available.</p><main>' + ''.join(cards) + '</main></html>'
    (ASSETS / "preview.html").write_text(preview, encoding="utf-8")
    zip_path = ROOT / "assets" / "sari-sari-starter-images.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((ASSETS / "images").glob("*.jpg")):
            archive.write(path, f"images/{path.name}")
        archive.write(ASSETS / "IMAGE-CREDITS.md", "IMAGE-CREDITS.md")
    print(json.dumps({"products": len(catalog), "categories": len(set(row['category'] for row in catalog)), "photos": len(sources), "sql": str(target), "images": str(zip_path)}))


if __name__ == "__main__":
    main()
