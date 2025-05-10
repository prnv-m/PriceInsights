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
    row = cur.fetchone()
    col_names = [desc[0] for desc in cur.description]
    if row:
        print("Column names:", col_names)
        print("First row:", row)
    else:
        print("No rows found")
    cur.close()
    conn.close()

def test_recent_insert():
    """Test if at least one row was inserted into staging_raw_products in the last 2 hours, optionally filtered by name."""
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()
    two_hours_ago = datetime.datetime.now() - datetime.timedelta(hours=2)
    # If you want to filter by name, you must extract it from the JSON column (raw_payload)
    cur.execute(
        """
        SELECT COUNT(*) FROM staging_raw_products
        WHERE scraped_at >= %s AND raw_payload->>'name' ILIKE '(Refurbished)%';
        """,
        (two_hours_ago,)
    )
    count = cur.fetchone()[0]
    if count > 0:
        print(f"PASS: {count} row(s) inserted in the last 2 hours with name starting with '(Refurbished)'.")
    else:
        print("FAIL: No rows inserted in the last 2 hours with name starting with '(Refurbished)'.")
    cur.close()
    conn.close()

def print_refurbished_asus_tuf():
    """Print all rows from products where name matches the refurbished ASUS TUF Gaming A15, AMD Ryzen 7 pattern."""
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM products WHERE title ILIKE '%(Refurbished)%ASUS TUF Gaming A15, AMD Ryzen 7%';
        """
    )
    rows = cur.fetchall()
    col_names = [desc[0] for desc in cur.description]
    print("Column names:", col_names)
    print(f"Total rows: {len(rows)}")
    for row in rows:
        print(row)
    cur.close()
    conn.close()

if __name__ == "__main__":
    print_refurbished_asus_tuf()
