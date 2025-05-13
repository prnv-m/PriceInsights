from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi import Path
import psycopg2
import os
import logging
from dotenv import load_dotenv
from datetime import timedelta
import json

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
      p.high_res_image_url,
      p.image_url,
      p.category,
      p.availability,
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

@app.get("/products/{asin}")
def get_product_details(asin: str = Path(..., description="ASIN of the product")):
    try:
        logger.info("Connecting to DB...")
        conn = get_conn()  # Use the existing connection function
        cur = conn.cursor()

        # Fetch product info from `products` table
        cur.execute("""
            SELECT asin, title, high_res_image_url, category, availability
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
            ORDER BY ts ASC -- Ensure chronological order for the chart
        """, (asin,))
        
        all_rows = cur.fetchall()
        
        product_data = {
            "asin": product_row[0],
            "title": product_row[1],
            "image_url": product_row[2],
            "category": product_row[3],
            "availability": product_row[4],
            "price_history": [
                {
                    "raw_price": row[0],
                    "raw_discount": row[1],
                    "timestamp": row[2].isoformat()  # Use consistent key name with frontend
                } for row in all_rows # <-- Use all_rows directly
            ]
        }

        cur.close()
        conn.close()
        logger.info(f"Fetched product {asin} with {len(all_rows)} price records (full history).") # Updated log message
        return JSONResponse(content=product_data)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return JSONResponse(
            content={"error": "An unexpected error occurred", "details": str(e)},
            status_code=500
        )

@app.get("/api/search-suggest")
def suggest(q: str = Query(...)):
    """
    Provides search suggestions based on user input.
    Returns top 5 matching product titles.
    """
    if not q or len(q.strip()) < 2:
        return []
    
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Get top 5 unique suggestions (titles or categories) based on query relevance.
            # Prioritize prefix matches in title, then general title matches, then category matches.
            cur.execute("""
                SELECT value
                FROM (
                    SELECT title AS value, 1 AS priority FROM products WHERE title ILIKE %s
                    UNION ALL
                    SELECT title AS value, 2 AS priority FROM products WHERE title ILIKE %s AND title NOT ILIKE %s -- Avoid duplicating prefix matches
                    UNION ALL
                    SELECT category AS value, 3 AS priority FROM products WHERE category ILIKE %s
                ) AS suggestions
                WHERE value IS NOT NULL AND value != ''
                GROUP BY value
                ORDER BY MIN(priority), value -- Order by best priority, then alphabetically
                LIMIT 5
            """, (f"{q}%", f"%{q}%", f"{q}%", f"%{q}%")) # Pass q% twice for the NOT ILIKE condition
            
            return [row[0] for row in cur.fetchall()]
    
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        return []
    finally:
        conn.close()

@app.get("/api/search")
def search(q: str = Query(...)):
    """
    Performs an enhanced product search based on user query,
    with improved handling for typos, missing spaces, and partial matches.
    """
    conn = get_conn()
    results = []
    
    try:
        with conn.cursor() as cur:
            # Parse the query to extract any special filters
            price_under = None
            
            # Check for "under $X" pattern
            import re
            price_match = re.search(r'under\s*\$?(\d+)', q.lower())
            if price_match:
                price_under = int(price_match.group(1))
            
            # Extract base search term (removing filters)
            base_term = re.sub(r'under\s*\$?\d+', '', q.lower()).strip()
            
            # Preprocessing search term
            # 1. Remove special characters
            clean_term = re.sub(r'[^\w\s]', '', base_term)
            # 2. Transform hyphenated terms to both hyphenated and non-hyphenated versions
            search_variants = [clean_term]
            
            # Handle hyphenation: "tp-link" should find "tplink" and vice versa
            if '-' in clean_term:
                search_variants.append(clean_term.replace('-', ''))
            else:
                # Find possible hyphenation points in compound words
                # Look for common brand patterns like "tplink" -> "tp-link"
                common_prefixes = ['tp', 'wi', 'dl', 'net', 'web', 'air', 'my', 'home', 'smart', 'blue', 'fire']
                for prefix in common_prefixes:
                    if clean_term.startswith(prefix) and len(clean_term) > len(prefix):
                        hyphenated_variant = f"{prefix}-{clean_term[len(prefix):]}"
                        search_variants.append(hyphenated_variant)
            
            # 3. Split into words to search for each word individually
            words = clean_term.split()
            
            # Build the query with all necessary product details and improved search logic
            query = """
                SELECT 
                    p.asin,
                    p.title,
                    p.high_res_image_url,
                    p.image_url,
                    p.category,
                    p.availability,
                    ph.raw_price,
                    ph.raw_discount,
                    ph.ts AS last_scraped,
                    similarity(p.title, %s) as title_similarity
                FROM products p
                LEFT JOIN LATERAL (
                    SELECT raw_price, raw_discount, ts
                    FROM price_history
                    WHERE asin = p.asin
                    ORDER BY ts DESC
                    LIMIT 1
                ) ph ON TRUE
                WHERE 1=1
            """
            
            # Start with params containing the full query for similarity calculation
            params = [base_term]
            
            # Build a complex WHERE clause that matches any of our variants
            where_clauses = []
            
            # 1. Add full term matching (both original and variants)
            for variant in search_variants:
                where_clauses.append("p.title ILIKE %s")
                params.append(f"%{variant}%")
            
            # 2. Add category matching
            where_clauses.append("p.category ILIKE %s")
            params.append(f"%{clean_term}%")
            
            # 3. Match individual words (if there are multiple)
            if len(words) > 1:
                word_conditions = []
                for word in words:
                    if len(word) >= 3:  # Only consider words of significant length
                        where_clauses.append("p.title ILIKE %s")
                        params.append(f"%{word}%")
            
            # 4. Use trigram similarity for fuzzy matching (helps with typos)
            # Only apply this for terms that are long enough
            if len(clean_term) >= 4:
                where_clauses.append("similarity(p.title, %s) > 0.3")
                params.append(clean_term)
            
            # Combine all WHERE conditions with OR
            if where_clauses:
                query += " AND (" + " OR ".join(where_clauses) + ")"
            
            # 5. Add price filter if specified
            if price_under:
                query += " AND CAST(REGEXP_REPLACE(COALESCE(ph.raw_price, '0'), '[^0-9.]', '', 'g') AS DECIMAL) < %s"
                params.append(price_under)
            
            # Improved ordering to prioritize best matches
            query += """
                ORDER BY 
                    CASE WHEN p.title ILIKE %s THEN 100 ELSE 0 END +  -- Exact match
                    CASE WHEN p.title ILIKE %s THEN 50 ELSE 0 END +   -- Starts with match
                    similarity(p.title, %s) * 30 +                     -- Overall similarity
                    CASE 
                        WHEN p.title ~* %s THEN 25                     -- Regex pattern match
                        ELSE 0 
                    END DESC,
                    ph.ts DESC NULLS LAST
                LIMIT 30
            """
            
            # Add parameters for the ORDER BY clause
            params.append(f"{clean_term}")        # Exact match
            params.append(f"{clean_term}%")       # Starts with
            params.append(clean_term)             # For similarity
            
            # Regex pattern to find words that might be split or joined incorrectly
            # e.g., "tplink" should match "tp-link" and vice versa
            pattern = '|'.join([re.escape(w) for w in words if len(w) >= 2])
            if pattern:
                params.append(pattern)
            else:
                params.append(clean_term)  # Fallback if no words to create pattern
            
            cur.execute(query, tuple(params))
            cols = [desc[0] for desc in cur.description]
            
            for row in cur.fetchall():
                result_dict = dict(zip(cols, row))
                # Remove the similarity score before returning to client
                if 'title_similarity' in result_dict:
                    del result_dict['title_similarity']
                results.append(result_dict)
    
    except Exception as e:
        logger.error(f"Error searching products: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to search products", "details": str(e)}
        )
    finally:
        conn.close()
    
    return JSONResponse(content=jsonable_encoder({"results": results, "query": q}))

@app.get("/api/products/trending")
def get_trending_products():
    """
    Returns top 10 products with the most unique raw_price changes.
    """
    sql = """
    WITH TrendingASINs AS (
        SELECT
          ph.asin,
          COUNT(DISTINCT ph.raw_price) AS unique_price_changes
        FROM price_history ph
        WHERE ph.raw_price IS NOT NULL AND ph.raw_price <> ''
        GROUP BY ph.asin
        ORDER BY unique_price_changes DESC
        LIMIT 12
    )
    SELECT
      p.asin,
      p.title,
      p.high_res_image_url,
      p.image_url,
      p.category,
      p.availability,
      ph_latest.raw_price,
      ph_latest.raw_discount,
      ph_latest.ts AS last_scraped,
      ta.unique_price_changes
    FROM products p
    JOIN TrendingASINs ta ON p.asin = ta.asin
    LEFT JOIN LATERAL (
      SELECT raw_price, raw_discount, ts
      FROM price_history
      WHERE asin = p.asin
      ORDER BY ts DESC
      LIMIT 1
    ) ph_latest ON TRUE
    ORDER BY ta.unique_price_changes DESC;
    """
    try:
        logger.info("Connecting to DB for trending products...")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(sql)
        cols = [c.name for c in cur.description]
        rows = cur.fetchall()
        cur.close()
        conn.close()

        data = [dict(zip(cols, row)) for row in rows]
        logger.info(f"Fetched {len(data)} trending products")
        return JSONResponse(content=jsonable_encoder(data))

    except psycopg2.OperationalError as e:
        logger.error(f"DB connection failed for trending products: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Database connection failed", "details": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching trending products: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "An unexpected error occurred", "details": str(e)}
        )

@app.get("/api/products/deals")
def get_todays_deals():
    """
    Returns top 10 products with the most significant recent price drops (last 2 days).
    """
    sql = """
    WITH NumericPriceHistory AS (
        SELECT
            asin,
            ts,
            raw_price AS original_raw_price, -- Keep original for display
            raw_discount,
            -- Attempt to convert raw_price to numeric, handling potential errors by returning NULL
            CASE
                WHEN raw_price ~ E'^[^0-9]*[0-9]+([,.][0-9]+)?[^0-9]*$'
                THEN CAST(REGEXP_REPLACE(raw_price, '[^0-9.]', '', 'g') AS DECIMAL(12,2))
                ELSE NULL
            END AS numeric_price
        FROM price_history
        WHERE raw_price IS NOT NULL AND raw_price <> ''
    ),
    RankedPriceHistory AS (
        SELECT
            nph.asin,
            nph.numeric_price,
            nph.original_raw_price,
            nph.raw_discount,
            nph.ts,
            LAG(nph.numeric_price, 1, NULL) OVER (PARTITION BY nph.asin ORDER BY nph.ts ASC) AS previous_numeric_price,
            ROW_NUMBER() OVER (PARTITION BY nph.asin ORDER BY nph.ts DESC) as rn
        FROM NumericPriceHistory nph
        WHERE nph.numeric_price IS NOT NULL -- Only consider entries where conversion was successful
    ),
    RecentPriceDrops AS (
        SELECT
            rph.asin,
            p.title,
            p.high_res_image_url,
            p.image_url,
            p.category,
            p.availability,
            rph.numeric_price AS current_numeric_price,
            rph.previous_numeric_price,
            ph_latest.raw_price AS current_raw_price_display, -- For displaying the current price string
            ph_latest.raw_discount AS current_raw_discount_display, -- For displaying current discount
            rph.ts AS price_update_ts
        FROM RankedPriceHistory rph
        JOIN products p ON rph.asin = p.asin
        LEFT JOIN LATERAL ( -- To get the latest raw_price and raw_discount string for the product
          SELECT raw_price, raw_discount, ts
          FROM price_history
          WHERE asin = p.asin
          ORDER BY ts DESC
          LIMIT 1
        ) ph_latest ON TRUE
        WHERE rph.rn = 1 -- Only the latest processed record for each product
          AND rph.previous_numeric_price IS NOT NULL -- Ensure there's a previous price to compare
          AND rph.numeric_price < rph.previous_numeric_price
          AND rph.ts >= NOW() - INTERVAL '2 days' -- The price drop observation is recent
    )
    SELECT
        rd.asin,
        rd.title,
        rd.high_res_image_url,
        rd.image_url,
        rd.category,
        rd.availability,
        rd.current_raw_price_display AS raw_price,    -- Consistent naming for frontend
        rd.current_raw_discount_display AS raw_discount, -- Consistent naming for frontend
        rd.price_update_ts AS last_scraped,       -- Timestamp of the price drop
        rd.current_numeric_price,
        rd.previous_numeric_price,
        ( (rd.previous_numeric_price - rd.current_numeric_price) / rd.previous_numeric_price ) * 100 AS discount_percentage -- Calculate percentage
    FROM RecentPriceDrops rd
    WHERE rd.previous_numeric_price > 0 -- Avoid division by zero
    ORDER BY discount_percentage DESC, rd.price_update_ts DESC
    LIMIT 12;
    """
    try:
        logger.info("Connecting to DB for today's deals...")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(sql)
        cols = [c.name for c in cur.description]
        rows = cur.fetchall()
        cur.close()
        conn.close()

        data = [dict(zip(cols, row)) for row in rows]
        logger.info(f"Fetched {len(data)} products for today's deals")
        return JSONResponse(content=jsonable_encoder(data))

    except psycopg2.OperationalError as e:
        logger.error(f"DB connection failed for today's deals: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Database connection failed", "details": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching today's deals: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "An unexpected error occurred", "details": str(e)}
        )

@app.get("/api/products/bestsellers")
def get_bestseller_products():
    """
    Returns top 10 products with the largest percentage discount 
    from their highest historical price to their current price.
    """
    sql = """
    WITH NumericPriceHistory AS (
        -- Convert raw_price to numeric, handling potential errors
        SELECT
            asin,
            ts,
            raw_price AS original_raw_price,
            raw_discount,
            CASE
                WHEN raw_price ~ E'^[^0-9]*[0-9]+([,.][0-9]+)?[^0-9]*$'
                THEN CAST(REGEXP_REPLACE(raw_price, '[^0-9.]', '', 'g') AS DECIMAL(12,2))
                ELSE NULL
            END AS numeric_price
        FROM price_history
        WHERE raw_price IS NOT NULL AND raw_price <> ''
    ),
    ProductPriceStats AS (
        -- Get current price and max historical price for each product
        SELECT 
            nph.asin,
            (array_agg(nph.numeric_price ORDER BY nph.ts DESC))[1] AS current_numeric_price,
            (array_agg(nph.original_raw_price ORDER BY nph.ts DESC))[1] AS current_raw_price_display,
            (array_agg(nph.raw_discount ORDER BY nph.ts DESC))[1] AS current_raw_discount_display,
            MAX(nph.numeric_price) AS max_historic_price_numeric,
            (array_agg(nph.ts ORDER BY nph.ts DESC))[1] AS last_scraped_ts
        FROM NumericPriceHistory nph
        WHERE nph.numeric_price IS NOT NULL
        GROUP BY nph.asin
    ),
    BestsellerCandidates AS (
        -- Calculate effective discount percentage
        SELECT
            pps.*,
            p.title,
            p.high_res_image_url,
            p.image_url,
            p.category,
            p.availability,
            CASE
                WHEN pps.max_historic_price_numeric > 0 AND pps.max_historic_price_numeric > pps.current_numeric_price
                THEN ((pps.max_historic_price_numeric - pps.current_numeric_price) / pps.max_historic_price_numeric) * 100
                ELSE 0
            END AS effective_discount_percentage
        FROM ProductPriceStats pps
        JOIN products p ON pps.asin = p.asin
        WHERE p.availability = TRUE -- Only consider available products
          AND pps.current_numeric_price IS NOT NULL
          AND pps.max_historic_price_numeric > 0
    )
    SELECT 
        bc.asin,
        bc.title,
        bc.high_res_image_url,
        bc.image_url, -- Keep this for consistency, even if high_res is preferred
        bc.category,
        bc.availability,
        bc.current_raw_price_display AS raw_price, -- Frontend expects raw_price
        bc.current_raw_discount_display AS raw_discount, -- Frontend expects raw_discount
        bc.last_scraped_ts AS last_scraped,
        bc.current_numeric_price,
        bc.max_historic_price_numeric,
        bc.effective_discount_percentage
    FROM BestsellerCandidates bc
    WHERE bc.effective_discount_percentage > 5 -- Arbitrary threshold for a meaningful discount
    ORDER BY bc.effective_discount_percentage DESC
    LIMIT 12;
    """
    try:
        logger.info("Connecting to DB for bestseller products...")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(sql)
        cols = [c.name for c in cur.description]
        rows = cur.fetchall()
        cur.close()
        conn.close()

        data = [dict(zip(cols, row)) for row in rows]
        logger.info(f"Fetched {len(data)} bestseller products")
        return JSONResponse(content=jsonable_encoder(data))

    except psycopg2.OperationalError as e:
        logger.error(f"DB connection failed for bestseller products: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Database connection failed", "details": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching bestseller products: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "An unexpected error occurred", "details": str(e)}
        )
