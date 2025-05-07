import stealth_requests as requests
import json
import re
import time
from datetime import datetime

dont_include = {
    "Sponsored", "Currently unavailable", 
    "Deal of the Day", "", "Results",
    "RESULTS"
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


def scrape_amazon_products(search_query, category="mobile", max_pages=3):
    products = []
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

                # Extract ASIN
                asin = div.get('data-asin') or None

                # Title extraction
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

                # Price
                price_elem = div.select_one('.a-price-whole')
                if not price_elem:
                    continue
                price = "₹" + price_elem.get_text(strip=True)

                # Image
                image_elem = div.select_one('img.s-image')
                image_url = image_elem.get('src') if image_elem else None

                # Discount calculation
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

                # Timestamp
                timestamp = datetime.utcnow().isoformat() + 'Z'

                products.append({
                    "asin": asin,
                    "title": title,
                    "price": price,
                    "image_url": image_url,
                    "discount": discount,
                    "category": category,
                    "timestamp": timestamp
                })
                print(f"Added: {title[:50]}... Price: {price} at {timestamp}")

            time.sleep(2)
        except Exception as e:
            print(f"Error processing page {page}: {e}")
            continue
    return products

if __name__ == "__main__":
    # Top 10 Amazon product categories to scrape
    categories = [
        "laptop", "mobile", "headphones", "camera", "television",
        "smartwatch", "tablet", "printer", "router", "gaming laptop"
    ]
    delay_between_categories = 10  # seconds
    all_products = []

    for category in categories:
        print(f"\n=== Starting scrape for category: {category} ===")
        products = scrape_amazon_products(category, category=category)
        if not products:
            print(f"No products found for '{category}'.")
        else:
            all_products.extend(products)
            print(f"Found {len(products)} products for '{category}'.")

        print(f"Waiting for {delay_between_categories} seconds before next category...")
        time.sleep(delay_between_categories)

    # Save all categories into a single JSON
    output_file = 'amazon_all_categories_with_ts2.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_products, f, indent=4, ensure_ascii=False)
    print(f"\nTotal products scraped: {len(all_products)}. Saved to {output_file}")
