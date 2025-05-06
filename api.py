from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import psycopg2
import os
import logging
from dotenv import load_dotenv

load_dotenv()
# Set up logging
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

# Database configuration
DB_NAME = "staging"
DB_USER = "postgres"
DB_PASSWORD = os.getenv("PG_PASSWORD")
DB_HOST = os.getenv("PG_HOST")
DB_PORT = os.getenv("PG_PORT")

# Add environment variable checking
if not all([DB_PASSWORD, DB_HOST, DB_PORT]):
    logger.error("Missing required environment variables:")
    if not DB_PASSWORD: logger.error("PG_PASSWORD not set")
    if not DB_HOST: logger.error("PG_HOST not set")
    if not DB_PORT: logger.error("PG_PORT not set")

@app.get("/products/")
def get_products():
    try:
        # Log connection attempt
        logger.info(f"Attempting to connect to database at {DB_HOST}:{DB_PORT}")
        
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        
        logger.info("Database connection successful")
        
        cursor = conn.cursor()
        query = """
            SELECT raw_payload
            FROM staging_raw_products
            ORDER BY scraped_at DESC
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        data = [row[0] for row in rows]
        
        cursor.close()
        conn.close()
        
        logger.info(f"Successfully retrieved {len(data)} products")
        return JSONResponse(content=data)
        
    except psycopg2.OperationalError as e:
        logger.error(f"Database connection error: {str(e)}")
        return JSONResponse(
            content={
                "error": "Database connection failed",
                "details": str(e)
            }, 
            status_code=500
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return JSONResponse(
            content={
                "error": "An unexpected error occurred",
                "details": str(e)
            }, 
            status_code=500
        )