import stealth_requests as requests
import json
import re
import time
import random
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()
DB_NAME = os.getenv("PG_DB_NAME", "staging")
DB_USER = os.getenv("PG_USER", "postgres")
DB_PASSWORD = os.getenv("PG_PASSWORD")
DB_HOST = os.getenv("PG_HOST", "localhost")
DB_PORT = os.getenv("PG_PORT")

# Items to filter out from results
dont_include = {
    "Sponsored", "Currently unavailable", 
    "Deal of the Day", "", "Results",
    "RESULTS", "Refurbished", "Renewed"
}

# List of user agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
]

def should_skip_div(div, text):
    if div.select_one('[data-component-type="sp-sponsored-result"]'):
        return True
    if div.select_one('.s-pagination-container'):
        return True
    if div.select_one('#s-refinements'):
        return True
    if "Sponsored" in text:
        return True
    return False


def get_random_user_agent():
    return random.choice(USER_AGENTS)


def get_random_delay():
    return random.uniform(1, 3)


def get_db_connection():
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None


def update_product_availability(asin, available):
    """Mark a product's availability in the products table."""
    conn = get_db_connection()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE products SET availability = %s WHERE asin = %s",
                (available, asin)
            )
        conn.commit()
    except Exception as e:
        print(f"Error updating availability for ASIN {asin}: {e}")
    finally:
        conn.close()


def get_products_without_recent_updates():
    conn = get_db_connection()
    if not conn:
        return []

    try:
        with conn.cursor() as cur:
            cur.execute("""
                WITH latest_prices AS (
                    SELECT p.asin, p.title, p.category,p.availability, 
                           MAX(ph.ts) as latest_price_date,
                           CASE 
                               WHEN MAX(ph.ts) IS NULL THEN 0  
                               WHEN MAX(ph.ts) < NOW() - INTERVAL '14 day' THEN 1  
                               WHEN MAX(ph.ts) < NOW() - INTERVAL '7 day' THEN 2  
                               WHEN MAX(ph.ts) < NOW() - INTERVAL '3 day' THEN 3  
                               ELSE 4
                           END as age_group
                    FROM products p
                    LEFT JOIN price_history ph ON p.asin = ph.asin
                    GROUP BY p.asin, p.title, p.category
                )
                SELECT asin, title, category, latest_price_date, age_group
                FROM latest_prices
                WHERE (latest_price_date IS NULL 
                   OR latest_price_date < NOW() - INTERVAL '1 day')
                  AND availability = true
                ORDER BY age_group, latest_price_date ASC NULLS FIRST;
            """)
            rows = cur.fetchall()
    except Exception as e:
        import logging
        logging.error("Error getting products without recent updates", exc_info=e)
        conn.close()
        return []
    finally:
        conn.close()

    product_groups = {i: [] for i in range(5)}
    for asin, title, category, latest_date, age_group in rows:
        product_groups[age_group].append({"asin": asin, "title": title, "category": category})

    selected_products = []
    remaining_slots = 100
    if product_groups[0]:
        count_to_take = min(len(product_groups[0]), max(10, remaining_slots // 2))
        selected_products.extend(random.sample(product_groups[0], count_to_take))
        remaining_slots -= count_to_take
    if product_groups[1] and remaining_slots > 0:
        count_to_take = min(len(product_groups[1]), max(10, remaining_slots // 3))
        selected_products.extend(random.sample(product_groups[1], count_to_take))
        remaining_slots -= count_to_take
    for group_id in [2, 3, 4]:
        if remaining_slots <= 0:
            break
        if product_groups[group_id]:
            count_to_take = min(len(product_groups[group_id]), max(5, remaining_slots // (5 - group_id)))
            selected_products.extend(random.sample(product_groups[group_id], count_to_take))
            remaining_slots -= count_to_take
    all_products = []
    for group in product_groups.values():
        all_products.extend(group)
    if remaining_slots > 0 and len(all_products) > len(selected_products):
        remaining_products = [p for p in all_products if p not in selected_products]
        additional_count = min(len(remaining_products), remaining_slots)
        selected_products.extend(random.sample(remaining_products, additional_count))
    random.shuffle(selected_products)
    selected = selected_products[:100]
    print(f"Found {len(selected)} products that need price updates")
    return selected


def extract_keywords(title, category, max_keywords=3):
    clean_title = re.sub(r'[^\w\s]', ' ', title.lower())
    stop_words = {'with', 'and', 'for', 'the', 'in', 'of', 'to', 'a', 'an', 
                 'new', 'inch', 'cm', 'mm', 'latest', 'best'}
    words = [word for word in clean_title.split() if word not in stop_words and len(word) > 2]
    keywords = words[:max_keywords]
    if category.lower() not in keywords:
        keywords.append(category.lower())
    return keywords


def insert_product_to_staging(product):
    conn = get_db_connection()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        asin = product.get("asin")
        scraped_at = datetime.fromisoformat(product["timestamp"].replace("Z", "+00:00"))
        cur.execute(
            """
            SELECT 1 FROM staging_raw_products
            WHERE raw_payload->>'asin' = %s AND scraped_at = %s
            LIMIT 1;
            """,
            (asin, scraped_at)
        )
        if cur.fetchone():
            print(f"Skipping duplicate record for ASIN {asin} at {scraped_at}")
            cur.close()
            conn.close()
            return False
        cur.execute(
            """
            INSERT INTO staging_raw_products (
                raw_payload,
                raw_price,
                raw_discount,
                raw_url,
                scraped_at,
                processed
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                Json(product),
                product.get("price"),
                product.get("discount"),
                product.get("image_url"),
                scraped_at,
                False
            )
        )
        conn.commit()
        cur.close()
        conn.close()
        print(f"Inserted: {product.get('title')[:50]}...")
        return True
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error inserting product with ASIN {product.get('asin')}: {e}")
        return False


def search_amazon_for_product(product_info, max_pages=2):
    asin = product_info["asin"]
    title = product_info["title"]
    category = product_info["category"]
    keywords = extract_keywords(title, category)
    search_query = " ".join(keywords)
    print(f"\nSearching for product with ASIN {asin}")
    print(f"Using search query: '{search_query}'")
    product_found = False
    for page in range(1, max_pages + 1):
        if product_found:
            break
        url = f'https://www.amazon.in/s?k={search_query}&page={page}'
        headers = {
            'User-Agent': get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.amazon.in/',
        }
        try:
            print(f"Fetching page {page}...")
            resp = requests.get(url, headers=headers)
            if resp.status_code == 503:
                print("Got 503 error - Service Unavailable, retrying after delay")
                time.sleep(7)
                continue
            if resp.status_code != 200:
                print(f"Got status code: {resp.status_code}")
                continue
            soup = resp.soup()
            if 'Robot Check' in soup.get_text():
                print("Got CAPTCHA/Robot check page, skipping and waiting")
                time.sleep(15)
                continue
            product_divs = soup.select('div[data-component-type="s-search-result"]')
            print(f"Found {len(product_divs)} product containers on page {page}")
            for div in product_divs:
                div_asin = div.get('data-asin')
                if div_asin != asin:
                    continue
                text = div.get_text()
                if should_skip_div(div, text):
                    continue
                title_elem = div.select_one('h2 span.a-text-normal') or div.select_one('.a-text-normal')
                if not title_elem:
                    continue
                title = title_elem.get_text(strip=True)
                if title in dont_include:
                    continue
                price_elem = div.select_one('.a-price-whole')
                if not price_elem:
                    continue
                price = "₹" + price_elem.get_text(strip=True)
                image_elem = div.select_one('img.s-image')
                image_url = image_elem.get('src') if image_elem else None
                high_res_image_url = re.sub(r'_[^_]*UY[0-9]+_', '_SL1500_', image_url) if image_url else None
                discount = None
                discount_elem = div.select_one('.a-text-price span')
                if discount_elem:
                    original = discount_elem.get_text(strip=True)
                    if original.startswith('₹'):
                        try:
                            original_val = float(original[1:].replace(',', ''))
                            current_val = float(price[1:].replace(',', ''))
                            if original_val > current_val:
                                discount_pct = int(((original_val - current_val) / original_val) * 100)
                                discount = f"{discount_pct}% off"
                        except ValueError:
                            pass
                timestamp = datetime.utcnow().isoformat() + 'Z'
                product = {
                    "asin": asin,
                    "title": title,
                    "price": price,
                    "image_url": image_url,
                    "high_res_image_url": high_res_image_url,
                    "discount": discount,
                    "category": category,
                    "timestamp": timestamp
                }
                print(f"Scraped: {title[:50]}... Price: {price}")
                if insert_product_to_staging(product):
                    product_found = True
                    break
            delay = get_random_delay()
            print(f"Waiting {delay:.2f} seconds before next page...")
            time.sleep(delay)
        except Exception as e:
            print(f"Error processing page {page}: {e}")
            time.sleep(5)
            continue
    if not product_found:
        print(f"No product found for ASIN {asin}. Marking as unavailable.")
        update_product_availability(asin, False)
    return product_found


def main():
    print("Starting Amazon Product Price Update Check")
    products_to_update = get_products_without_recent_updates()
    if not products_to_update:
        print("No products need updating or database query failed.")
        return
    print(f"Found {len(products_to_update)} products that need updating.")
    stats = {"success": 0, "failed": 0, "total": len(products_to_update)}
    for i, product in enumerate(products_to_update):
        print(f"\n[{i+1}/{len(products_to_update)}] Processing product: {product['title'][:50]}...")
        success = search_amazon_for_product(product)
        if success:
            stats["success"] += 1
            update_product_availability(product['asin'], True)
        else:
            stats["failed"] += 1
        if i < len(products_to_update) - 1:
            delay = random.uniform(2, 5)
            print(f"Waiting {delay:.2f} seconds before next product...")
            time.sleep(delay)
    print("\n=== Update Summary ===")
    print(f"Total products processed: {stats['total']}")
    print(f"Successfully updated: {stats['success']}")
    print(f"Failed to update: {stats['failed']}")
    print("======================")

if __name__ == "__main__":
    main()
