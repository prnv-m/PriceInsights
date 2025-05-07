from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi import Path
import psycopg2
import os
import logging
from dotenv import load_dotenv
from datetime import timedelta
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME     = "staging"
DB_USER     = "postgres"
DB_PASSWORD = os.getenv("PG_PASSWORD")
DB_HOST     = os.getenv("PG_HOST")
DB_PORT     = os.getenv("PG_PORT")

if not all([DB_PASSWORD, DB_HOST, DB_PORT]):
    logger.error("Missing required environment variables")
    raise RuntimeError("PG_PASSWORD, PG_HOST and PG_PORT must all be set")

def get_conn():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )

@app.get("/products/")
def get_products():
    """
    Return all products along with their latest raw_price & raw_discount.
    Datetimes are JSON-encoded automatically.
    """
    sql = """
    SELECT
      p.asin,
      p.title,
      p.image_url,
      p.category,
      ph.raw_price,
      ph.raw_discount,
      ph.ts AS last_scraped
    FROM products p
    LEFT JOIN LATERAL (
      SELECT raw_price, raw_discount, ts
      FROM price_history
      WHERE asin = p.asin
      ORDER BY ts DESC
      LIMIT 1
    ) ph ON TRUE
    ORDER BY p.title;
    """

    try:
        logger.info("Connecting to DB…")
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute(sql)
        cols = [c.name for c in cur.description]
        rows = cur.fetchall()
        cur.close()
        conn.close()

        data = [dict(zip(cols, row)) for row in rows]
        logger.info(f"Fetched {len(data)} products")

        # use jsonable_encoder to turn datetime into ISO strings
        return JSONResponse(content=jsonable_encoder(data))

    except psycopg2.OperationalError as e:
        logger.error(f"DB connection failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Database connection failed", "details": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "An unexpected error occurred", "details": str(e)}
        )
from datetime import timedelta

@app.get("/products/{asin}")
def get_product_details(asin: str = Path(..., description="ASIN of the product")):
    try:
        logger.info("Connecting to DB...")
        conn = get_conn()  # Use the existing connection function
        cur = conn.cursor()

        # Fetch product info from `products` table
        cur.execute("""
            SELECT asin, title, image_url, category
            FROM products
            WHERE asin = %s
        """, (asin,))
        product_row = cur.fetchone()

        if not product_row:
            return JSONResponse(content={"error": "Product not found"}, status_code=404)

        # Get all price history records
        cur.execute("""
            SELECT raw_price, raw_discount, ts
            FROM price_history
            WHERE asin = %s
            ORDER BY ts ASC
        """, (asin,))
        
        all_rows = cur.fetchall()
        
        # Custom filtering logic - only keep entries where price or discount changes
        filtered_rows = []
        last_price = None
        last_discount = None
        
        for row in all_rows:
            price, discount, timestamp = row
            
            # Always include the first entry
            if last_price is None and last_discount is None:
                filtered_rows.append(row)
                last_price = price
                last_discount = discount
                continue
                
            # Only include if price or discount has changed
            if price != last_price or discount != last_discount:
                filtered_rows.append(row)
                last_price = price
                last_discount = discount

        product_data = {
            "asin": product_row[0],
            "title": product_row[1],
            "image_url": product_row[2],
            "category": product_row[3],
            "price_history": [
                {
                    "raw_price": row[0],
                    "raw_discount": row[1],
                    "timestamp": row[2].isoformat()  # Use consistent key name with frontend
                } for row in filtered_rows
            ]
        }

        cur.close()
        conn.close()
        logger.info(f"Fetched product {asin} with {len(filtered_rows)} filtered price records.")
        return JSONResponse(content=product_data)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return JSONResponse(
            content={"error": "An unexpected error occurred", "details": str(e)},
            status_code=500
        )