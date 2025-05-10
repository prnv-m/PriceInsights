#!/usr/bin/env python3
"""
etl_staging_to_core.py

Reads raw staging records, upserts into products,
inserts into price_history, marks staging rows as processed,
and updates high_res_image_url in products.
"""
import re
import json
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from decimal import Decimal
import os
import logging
from dotenv import load_dotenv

load_dotenv()

# === CONFIGURATION ===
DB_CONFIG = {
    'host':     'localhost',
    'port':     os.getenv("PG_PORT"),
    'dbname':   'staging',
    'user':     os.getenv("PG_USER"),
    'password': os.getenv("PG_PASSWORD"),
}

BATCH_SIZE = 500  # adjust as needed

# === DB CONNECTION ===
def get_conn():
    return psycopg2.connect(**DB_CONFIG)

# === FETCH STAGING ===
def fetch_unprocessed(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT staging_id
                 , raw_payload
                 , raw_price
                 , raw_discount
                 , raw_url
                 , scraped_at
            FROM staging_raw_products
            WHERE processed = FALSE
            ORDER BY scraped_at
            LIMIT %s
        """, (BATCH_SIZE,))
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

# === PARSE JSON PAYLOAD ===
def parse_payload(raw_payload):
    """
    Accepts either a dict or JSON string,
    extracts fields plus cleaned price, discount, timestamp, currency.
    """
    obj = raw_payload if isinstance(raw_payload, dict) else json.loads(raw_payload)

    out = {
        'asin':      obj['asin'],
        'title':     obj.get('title'),
        'image_url': obj.get('image_url') or obj.get('image'),
        'category':  obj.get('category'),
    }

    # Clean price
    raw_p = obj.get('price') or ''
    p_str = re.sub(r'[^\d.]', '', raw_p)
    out['price'] = Decimal(p_str) if p_str else None
    out['currency'] = 'INR' if raw_p.startswith('₹') else 'USD' if raw_p.startswith('$') else None

    # Clean discount
    raw_d = obj.get('discount') or ''
    m = re.search(r'(\d+)%', raw_d)
    out['discount_pct'] = int(m.group(1)) if m else None

    # Timestamp
    ts = obj.get('timestamp')
    out['ts'] = datetime.fromisoformat(ts.replace('Z', '+00:00')) if ts else None

    return out

# === UPSERT PRODUCTS ===
def upsert_products(conn, products):
    """
    Upsert a list of product dicts:
      {'asin', 'title', 'image_url', 'category'}
    Deduped by asin already.
    """
    sql = """
    INSERT INTO products (asin, title, image_url, category)
    VALUES %s
    ON CONFLICT (asin) DO UPDATE
      SET title      = EXCLUDED.title,
          image_url  = EXCLUDED.image_url,
          category   = EXCLUDED.category,
          updated_at = now()
    """
    records = [(p['asin'], p['title'], p['image_url'], p['category']) for p in products]
    with conn.cursor() as cur:
        execute_values(cur, sql, records)
    conn.commit()

# === INSERT PRICE HISTORY ===
def insert_price_history(conn, history_rows):
    sql = """
    INSERT INTO price_history
      (asin, price, discount_pct, ts, currency, raw_price, raw_discount)
    VALUES %s
    ON CONFLICT (asin, ts) DO NOTHING
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, history_rows)
    conn.commit()

# === MARK STAGING PROCESSED ===
def mark_processed(conn, staging_ids):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE staging_raw_products
               SET processed = TRUE
             WHERE staging_id = ANY(%s)
        """, (staging_ids,))
    conn.commit()

# === UPDATE HIGH-RES IMAGE URLS ===
def update_high_res_image_urls(conn):
    """
    Computes and stores high_res_image_url based on existing image_url.
    """
    sql = """
    UPDATE products
       SET high_res_image_url = REGEXP_REPLACE(image_url, '_[^_]*UY[0-9]+_', '_SL1500_')
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()

# === MAIN ETL LOOP ===
def main():
    conn = get_conn()
    try:
        rows = fetch_unprocessed(conn)
        if not rows:
            print("☑️ No new rows to process.")
            return

        products_batch = []
        history_batch  = []
        processed_ids  = []

        for row in rows:
            sid    = row['staging_id']
            parsed = parse_payload(row['raw_payload'])

            # collect for products upsert
            products_batch.append({
                'asin':      parsed['asin'],
                'title':     parsed['title'],
                'image_url': parsed['image_url'],
                'category':  parsed['category'],
            })

            # collect for price_history insert
            if parsed['price'] is not None and parsed['ts'] is not None:
                history_batch.append((
                    parsed['asin'],
                    parsed['price'],
                    parsed['discount_pct'],
                    parsed['ts'],
                    parsed['currency'],
                    row.get('raw_price'),
                    row.get('raw_discount'),
                ))

            processed_ids.append(sid)

        # Dedupe products_batch by asin
        unique_products = {p['asin']: p for p in products_batch}.values()

        # Run DB operations
        upsert_products(conn, list(unique_products))
        insert_price_history(conn, history_batch)
        mark_processed(conn, processed_ids)

        # Finally, update high-res image URLs
        update_high_res_image_urls(conn)

        print(f"Processed {len(processed_ids)} rows and updated high-res URLs.")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
