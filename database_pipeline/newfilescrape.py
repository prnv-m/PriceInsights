import stealth_requests as requests
import json
import re

# Add more patterns to filter out
dont_include = {
    "Off on Exchange", "Coming Soon", "Currently unavailable", 
    "Become a Seller", "", "Mobiles & Accessories",
}

def should_skip_div(div, text):
    """Helper function to determine if a div should be skipped"""
    # Skip if it's a filter section
    if div.select_one('section[data-testid="filter-container"]'):
        return True
        
    # Skip if it contains "Reviews for Popular" in text
    if "Reviews for Popular" in text:
        return True
        
    # Skip navigation/pagination sections
    if div.select_one('nav'):
        return True
        
    # Skip filter sections (usually have these classes)
    filter_classes = {'_2gmUFU', '_3FPh42', '_2kHMtA'}
    if any(cls in div.get('class', []) for cls in filter_classes):
        return True
        
    return False

def scrape_flipkart_products(search_query, category="tablet", max_pages=3):
    products = []
    
    for page in range(1, max_pages + 1):
        url = f'https://www.flipkart.com/search?q={search_query}&page={page}'
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.flipkart.com/',
            'Cache-Control': 'max-age=0'
        }
        
        resp = requests.get(url, headers=headers)
        soup = resp.soup()
        
        # Look for product containers
        all_divs = soup.select('div')
        
        for div in all_divs:
            # Skip very small elements
            if len(str(div)) < 100:
                continue
            
            text = div.get_text()
            
            # Use helper function to filter out unwanted sections
            if should_skip_div(div, text):
                continue
                
            # Check if this div contains price-like text
            if '₹' in text and re.search(r'₹[\d,]+', text):
                title_candidates = div.find_all(['a', 'div', 'span', 'h3', 'h2'], text=True)
                title_candidates = [c for c in title_candidates if len(c.get_text(strip=True)) > 10]
                
                price_match = re.search(r'₹[\d,]+', text)
                image_elem = div.select_one('img')
                
                # Find discount percentage
                discount_match = re.search(r'(\d+)%\s*off', text, re.IGNORECASE)
                discount = discount_match.group(1) + "% off" if discount_match else False
                
                if title_candidates and price_match:
                    title = title_candidates[0].get_text(strip=True)
                    price = price_match.group(0)
                    image_url = None
                    
                    if image_elem:
                        image_url = (image_elem.get('src') or 
                                   image_elem.get('data-src') or 
                                   image_elem.get('srcset'))
                                   
                    if title not in dont_include:
                        products.append({
                            "title": title,
                            "price": price,
                            "image_url": image_url,
                            "discount": discount,
                            "category": category
                        })
    
    return products

if __name__ == "__main__":
    search_query = "samsung+galaxy+tab+with+stylus"
    products = scrape_flipkart_products(search_query)
    
    print(json.dumps(products, indent=4, ensure_ascii=False))
    
    with open('samsung_tablets.json', 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=4, ensure_ascii=False)
    
    print(f"\nFound {len(products)} products")
    print(f"Results saved to samsung_tablets.json")