import psycopg2
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# === CONFIGURATION ===
DB_CONFIG = {
    'host':     os.getenv("PG_HOST", "localhost"),
    'port':     os.getenv("PG_PORT"),
    'dbname':   os.getenv("PG_NAME"),
    'user':     os.getenv("PG_USER", "postgres"),
    'password': os.getenv("PG_PASSWORD"),
}

# === SQL QUERIES ===

# 1) Top 10 ASINs by number of unique price values
TOP_10_UNIQUE_PRICES_QUERY = """
SELECT
  asin,
  COUNT(DISTINCT price) AS unique_price_count
FROM price_history
GROUP BY asin
ORDER BY unique_price_count DESC
LIMIT 10;
"""

# 2) Top 10 products sorted by oldest last price update
LONGEST_STALE_PRODUCTS_QUERY = """
SELECT
  p.asin,
  p.title,
  MAX(ph.ts) AS last_update
FROM products p
LEFT JOIN price_history ph ON p.asin = ph.asin
GROUP BY p.asin, p.title
ORDER BY last_update ASC NULLS FIRST
LIMIT 10;
"""

def main():
    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cur:
                # Part A: Unique price counts
                cur.execute(TOP_10_UNIQUE_PRICES_QUERY)
                uniq_rows = cur.fetchall()

                print("Top 10 ASINs by unique price counts:")
                if not uniq_rows:
                    print("  (no price history data found)")
                else:
                    for rank, (asin, count) in enumerate(uniq_rows, start=1):
                        print(f"  {rank:2}. ASIN: {asin}, Unique Prices: {count}")

                print("\nTop 10 products by longest time since last update:")
                cur.execute(LONGEST_STALE_PRODUCTS_QUERY)
                stale_rows = cur.fetchall()
                now = datetime.utcnow()

                if not stale_rows:
                    print("  (no products or no price history at all)")
                else:
                    for rank, (asin, title, last_update) in enumerate(stale_rows, start=1):
                        if last_update is None:
                            age_desc = "Never updated"
                        else:
                            delta = now - last_update.replace(tzinfo=None)
                            days = delta.days
                            hours = delta.seconds // 3600
                            age_desc = f"{days}d {hours}h ago"
                        title_short = (title[:50] + "...") if title and len(title) > 50 else title
                        print(f"  {rank:2}. ASIN: {asin}, Last Update: {age_desc}, Title: {title_short}")

    except Exception:
        logging.exception("Failed to fetch product metrics")

if __name__ == "__main__":
    main()
