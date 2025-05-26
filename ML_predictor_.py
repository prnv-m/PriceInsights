import psycopg2
import pandas as pd
from statsmodels.tsa.api import Holt # Import Holt's Linear Trend
import os
import logging
from dotenv import load_dotenv
import numpy as np # For checking NaN/inf if needed

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DB_NAME     = os.getenv("DB_NAME", "staging") # Allow override from .env, default to "staging"
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("PG_PASSWORD")
DB_HOST     = os.getenv("PG_HOST")
DB_PORT     = os.getenv("PG_PORT")

def get_conn():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )

def predict_price_drop_holt(asin: str, forecast_days: int = 30):
    """
    Predicts price changes (drops, increases, or stability) using Holt's Linear Trend method
    and returns a detailed message.
    """
    conn = None
    cur = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        logger.info(f"HOLT: Fetching price history for ASIN: {asin}")
        cur.execute("""
            SELECT ts, price
            FROM price_history
            WHERE asin = %s
            ORDER BY ts ASC
        """, (asin,))
        rows = cur.fetchall()

        # Need at least 2 data points for Holt's method to estimate initial trend
        if not rows or len(rows) < 2:
            logger.warning(f"HOLT: Not enough price history for ASIN {asin} (found {len(rows)}, requires at least 2).")
            return (f"Not enough price history data for ASIN {asin} to make a prediction with Holt's method. "
                    f"Found {len(rows)} data points, but requires at least 2.")

        df = pd.DataFrame(rows, columns=['ds', 'y'])
        df['ds'] = pd.to_datetime(df['ds'])

        if df['ds'].dt.tz is not None:
            logger.info(f"HOLT: Timezone found in 'ds' for ASIN {asin}, converting to UTC and removing.")
            df['ds'] = df['ds'].dt.tz_convert('UTC').dt.tz_localize(None)

        df['y'] = df['y'].astype(float)

        if df['y'].isnull().any() or np.isinf(df['y']).any():
            logger.error(f"HOLT: NaN or Inf values found in 'y' column for ASIN {asin} after processing.")
            return f"Invalid price data (NaN or Inf values) encountered for ASIN {asin}, cannot proceed with Holt's prediction."

        df_holt = df.drop_duplicates(subset=['ds'], keep='last').set_index('ds')['y']

        if len(df_holt) < 2:
            logger.warning(f"HOLT: Not enough unique time-stamped data points for ASIN {asin} (found {len(df_holt)} after deduplication).")
            return (f"Not enough unique time-stamped data points for ASIN {asin} (found {len(df_holt)} after deduplication, requires at least 2) "
                    "for Holt's method prediction.")

        logger.info(f"HOLT: Fitting model for ASIN: {asin} with {len(df_holt)} data points.")
        model = Holt(df_holt, initialization_method="estimated", exponential=False, damped_trend=True)
        fit = model.fit()

        logger.info(f"HOLT: Making forecast for ASIN: {asin} for {forecast_days} days.")
        forecast_values = fit.forecast(steps=forecast_days)

        last_known_price = df_holt.iloc[-1]
        significance_threshold_factor = 0.01 # 1% change
        
        # Ensure last_known_price is not zero to avoid issues with percentage calculation if it were a divisor (though here it's a multiplier)
        # and to make thresholds meaningful.
        if last_known_price <= 0: # Prices are typically positive
             logger.warning(f"HOLT: Last known price for ASIN {asin} is {last_known_price:.2f}. Significance thresholds might be misleading.")
             # Proceed, but the interpretation of "significant" might be odd if price is zero or negative.
        
        significant_drop_value = last_known_price * (1 - significance_threshold_factor)
        significant_increase_value = last_known_price * (1 + significance_threshold_factor)

        min_forecasted_price = forecast_values.min()
        max_forecasted_price = forecast_values.max()

        # Common header for all prediction messages
        prediction_header = f"Holt's Linear Trend Price Prediction for ASIN {asin} (next {forecast_days} days):\n"

        # Check for significant drop
        if min_forecasted_price < significant_drop_value and last_known_price > 0 : # last_known_price > 0 for meaningful drop
            overall_drop_amount = round(last_known_price - min_forecasted_price, 2)
            days_to_drop = -1
            for i in range(len(forecast_values)):
                if forecast_values.iloc[i] < significant_drop_value:
                    days_to_drop = i + 1 
                    break
            
            if days_to_drop > 0:
                message = (
                    f"{prediction_header}"
                    f"STATUS: Significant PRICE DROP Anticipated.\n"
                    f"DETAILS:\n"
                    f"  Current Price: ₹{last_known_price:.2f}\n"
                    f"  The price is forecast to fall below a significant threshold of approximately ₹{significant_drop_value:.2f} (a {significance_threshold_factor*100:.1f}% decrease from current).\n"
                    f"  This initial significant drop is predicted to occur within {days_to_drop} days.\n"
                    f"  The lowest price forecasted during the {forecast_days}-day period is ₹{min_forecasted_price:.2f}.\n"
                    f"  This represents a potential maximum decrease of ₹{overall_drop_amount:.2f} from the current price."
                )
                return message
            else: # Safeguard: min_forecasted_price met condition, but loop didn't find a day
                return (
                    f"{prediction_header}"
                    f"STATUS: Potential Price Drop Indicated - Timing Unclear.\n"
                    f"DETAILS:\n"
                    f"  Current Price: ₹{last_known_price:.2f}\n"
                    f"  The forecast suggests the price might reach a low of ₹{min_forecasted_price:.2f}, which is below the significance threshold of ~₹{significant_drop_value:.2f}.\n"
                    f"  However, the exact timing for the price to first cross this threshold within the {forecast_days}-day forecast period could not be pinpointed.\n"
                    f"  This situation is uncommon if a drop below the threshold was indeed forecasted. Further analysis might be needed."
                )

        # Check for significant increase (if no significant drop was found)
        elif max_forecasted_price > significant_increase_value:
            overall_increase_amount = round(max_forecasted_price - last_known_price, 2)
            days_to_increase = -1
            for i in range(len(forecast_values)):
                if forecast_values.iloc[i] > significant_increase_value:
                    days_to_increase = i + 1
                    break

            if days_to_increase > 0:
                message = (
                    f"{prediction_header}"
                    f"STATUS: Significant PRICE INCREASE Anticipated.\n"
                    f"DETAILS:\n"
                    f"  Current Price: ₹{last_known_price:.2f}\n"
                    f"  The price is forecast to rise above a significant threshold of approximately ₹{significant_increase_value:.2f} (a {significance_threshold_factor*100:.1f}% increase from current).\n"
                    f"  This initial significant increase is predicted to occur within {days_to_increase} days.\n"
                    f"  The highest price forecasted during the {forecast_days}-day period is ₹{max_forecasted_price:.2f}.\n"
                    f"  This represents a potential maximum increase of ₹{overall_increase_amount:.2f} from the current price."
                )
                return message
            else: # Safeguard: max_forecasted_price met condition, but loop didn't find a day
                return (
                    f"{prediction_header}"
                    f"STATUS: Potential Price Increase Indicated - Timing Unclear.\n"
                    f"DETAILS:\n"
                    f"  Current Price: ₹{last_known_price:.2f}\n"
                    f"  The forecast suggests the price might reach a high of ₹{max_forecasted_price:.2f}, which is above the significance threshold of ~₹{significant_increase_value:.2f}.\n"
                    f"  However, the exact timing for the price to first cross this threshold within the {forecast_days}-day forecast period could not be pinpointed.\n"
                    f"  This situation is uncommon if an increase above the threshold was indeed forecasted. Further analysis might be needed."
                )
        
        # No significant change
        else:
            message = (
                f"{prediction_header}"
                f"STATUS: Price Expected to Remain RELATIVELY STABLE.\n"
                f"DETAILS:\n"
                f"  Current Price: ₹{last_known_price:.2f}\n"
                f"  No significant price changes (drops below ~₹{significant_drop_value:.2f} or increases above ~₹{significant_increase_value:.2f}) are predicted based on a {significance_threshold_factor*100:.1f}% threshold.\n"
                f"  The price is forecast to fluctuate, with an expected range between ₹{min_forecasted_price:.2f} and ₹{max_forecasted_price:.2f} over the next {forecast_days} days."
            )
            return message

    except Exception as e:
        logger.error(f"HOLT: Error predicting price for {asin}: {str(e)}", exc_info=True)
        return f"Unable to generate price prediction for ASIN {asin} due to an internal error (Holt's method): {str(e)}"
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
        logger.info(f"HOLT: Finished prediction attempt for ASIN: {asin}")

