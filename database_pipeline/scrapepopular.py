import stealth_requests as requests
import json
import re
import time
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv
import os
from datetime import datetime

dont_include = {
    "Sponsored", "Currently unavailable", 
    "Deal of the Day", "", "Results",
    "RESULTS", "Refurbished", "Renewed"
}

def should_skip_div(div, text):
    """Helper function to determine if a div should be skipped"""
    if div.select_one('[data-component-type="sp-sponsored-result"]'):
        return True
    if div.select_one('.s-pagination-container'):
        return True
    if div.select_one('#s-refinements'):
        return True
    return False

# Load environment variables
load_dotenv()
DB_NAME = "staging"
DB_USER = "postgres"
DB_PASSWORD = os.getenv("PG_PASSWORD")
DB_HOST = os.getenv("PG_HOST")
DB_PORT = os.getenv("PG_PORT")

def insert_product_to_staging(product):
    conn = None
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        cur = conn.cursor()
        asin = product.get("asin")
        scraped_at = datetime.fromisoformat(product["timestamp"].replace("Z", "+00:00"))
        # Check for duplicate
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
            return
        # Insert new record
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
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error inserting product with ASIN {product.get('asin')}: {e}")
        print("Stopping program due to error.")
        exit(1)

def scrape_amazon_products_and_stage(search_query, category="mobile", max_pages=3):
    for page in range(1, max_pages + 1):
        url = f'https://www.amazon.in/s?k={search_query}&page={page}'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.amazon.in/',
        }
        try:
            print(f"\nFetching page {page} for '{category}'...")
            resp = requests.get(url, headers=headers)
            if resp.status_code == 503:
                print("Got 503 error - Service Unavailable, retrying after delay")
                time.sleep(5)
                continue
            if resp.status_code != 200:
                print(f"Got status code: {resp.status_code}")
                continue
            soup = resp.soup()
            if 'Robot Check' in soup.get_text():
                print("Got CAPTCHA/Robot check page, skipping page")
                continue
            product_divs = soup.select('div[data-component-type="s-search-result"]')
            print(f"Found {len(product_divs)} product containers on page {page}")
            for div in product_divs:
                text = div.get_text()
                if should_skip_div(div, text):
                    continue
                asin = div.get('data-asin') or None
                title_elem = (
                    div.select_one('h2 span.a-text-normal') or
                    div.select_one('.a-text-normal') or
                    div.select_one('h2 a') or
                    div.select_one('.a-link-normal .a-text-normal')
                )
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
                # Compute high_res_image_url using the regex
                high_res_image_url = None
                if image_url:
                    high_res_image_url = re.sub(r'_[^_]*UY[0-9]+_', '_SL1500_', image_url)
                discount = None
                discount_elem = div.select_one('.a-text-price span')
                if discount_elem:
                    original = discount_elem.get_text(strip=True)
                    if original.startswith('₹'):
                        try:
                            original_val = float(original[1:].replace(',', ''))
                            current_val = float(price[1:].replace(',', ''))
                            if original_val > current_val:
                                discount_percent = int(((original_val - current_val) / original_val) * 100)
                                discount = f"{discount_percent}% off"
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
                print(f"Scraped: {title[:50]}... Price: {price} at {timestamp}")
                insert_product_to_staging(product)
            time.sleep(2)
        except Exception as e:
            print(f"Error processing page {page}: {e}")
            print("Stopping program due to error.")
            exit(1)

if __name__ == "__main__":
    # Top 10 Amazon product categories to scrape
    categories = [
        "laptop", "mobile", "headphones", "camera", "television",
        "smartwatch", "tablet", "printer", "router", "gaming laptop"
    ]
    delay_between_categories = 10  # seconds
    for category in categories:
        print(f"\n=== Starting scrape for category: {category} ===")
        scrape_amazon_products_and_stage(category, category=category)
        print(f"Waiting for {delay_between_categories} seconds before next category...")
        time.sleep(delay_between_categories)
    print("\nAll products scraped and inserted into staging database.")
