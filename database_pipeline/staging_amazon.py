import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv
import os
import json
import datetime

# Load environment variables
load_dotenv()

DB_NAME = "staging"
DB_USER = "postgres"
DB_PASSWORD = os.getenv("PG_PASSWORD")
DB_HOST = os.getenv("PG_HOST")
DB_PORT = os.getenv("PG_PORT")

def insert_to_staging(file_path):
    # Load JSON data
    with open(file_path, 'r', encoding='utf-8') as f:
        data_list = json.load(f)

    # Establish database connection
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()

    for item in data_list:
        # Parse timestamp and ASIN
        scraped_at = datetime.datetime.fromisoformat(
            item.get("timestamp").replace("Z", "+00:00")
        )
        asin = item.get("asin")

        # Skip if this ASIN + timestamp already exists
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
            continue

        # Insert new raw record
        try:
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
                    Json(item),
                    item.get("price"),
                    item.get("discount"),
                    item.get("image_url"),  # map to image URL
                    scraped_at,
                    False
                )
            )
            conn.commit()
        except Exception as e:
            print(f"Error inserting item with ASIN {asin}: {e}")
            conn.rollback()

    # Cleanup

    cur.close()
    conn.close()
    print(" Insert completed.")
def checkfirst():
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()
    cur.execute("SELECT * FROM staging_raw_products LIMIT 1;")
    first_col_name = cur.description[0].name
    print("First column is:", first_col_name)
    
    row = cur.fetchone()      # returns a 1‑tuple like (123, )
    if row:
        first_value = row[2]   # extract the scalar
        print(first_value)
    else:
        print("No rows found")
    cur.close()
    conn.close()

if __name__ == "__main__":
    insert_to_staging('amazon_all_categories_with_ts2.json')
    checkfirst()
