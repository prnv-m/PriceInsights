# PriceInsights
PriceInsights is a comprehensive full-stack price tracking solution that monitors product prices across multiple e-commerce platforms, including Blinkit, Zepto, and Amazon. Our intelligent system helps users make informed purchasing decisions, find the best deals, and save money.

## Ensure the following are installed:
- Python 3.9+
- PostgreSQL or your chosen database (configured in your pipeline)
- Node.js & npm (for frontend)
- Uvicorn (for API server)

## Scraping pipelines
### Step 1: Scrape New Products
Run the scraper to collect popular Amazon CD listings and populate the staging table.

```
python scrapepopular.py

```

### Step 2: Upsert into Production Tables
Insert or update the scraped products into the main product and price history tables without creating conflicts.
```
python upsert_production_pricehistory.py
```
### Step 3: Update Price Instances & Availability
Find new price instances for existing products and mark items as unavailable if they no longer appear in the listings.

```
python find_new_priceinstance.py
```

## Run frontend with all features initialized
Ensure FastAPI is initialized 
```
uvicorn api:app --host 0.0.0.0 --port 8000
```

## Run the Backend API
Navigate to the frontend project folder and run the dev server:
```
cd frontend_pricetracker
npm run dev
```

## Run frontend with all features initialized
Ensure FastAPI is initialized 
```
uvicorn api:app --host 0.0.0.0 --port 8000
```
## Sample screenshots:
### Homepage with products
![image](https://github.com/user-attachments/assets/342cbc9b-9ae3-4c62-b399-fce757d8d10f)

### Product page
![image](https://github.com/user-attachments/assets/893854c5-9d37-4cb3-bd05-40dc2a9d323f)

### Product price history graph
![image](https://github.com/user-attachments/assets/99bbf624-1c16-4b81-b808-b4710413bf71)

## Current features with features in development
 ✅**-Cross-Platform Price Monitoring:**   Track prices across 5+ major e-commerce platforms<br />
**-Real-time Price Alerts: Receive**   notifications when prices drop or match your target price<br />
 ✅**-Price History Visualization:**   View historical price trends and patterns<br />
 ✅**-Predictive Analytics:**   ML-powered price forecasting to identify the best time to buy<br />
 ✅**-Product Comparison:**   Compare prices across different platforms in one view<br />
**-Customizable Watchlists:**   Create and manage lists of products you're interested in<br />
**-Browser Extension**:   See competitive pricing while browsing your favorite stores<br />
 ✅**-Intelligent Scraping:**   Compliant web scraping with rate limiting and anti-detection measures<br />

