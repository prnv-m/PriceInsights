import scrapy
from urllib.parse import urlencode
import os
class AmazonSpider(scrapy.Spider):
    name = 'amazon'
    allowed_domains = ['api.scraperapi.com']
    scraperapi_endpoint = 'https://api.scraperapi.com/'
    API_KEY = os.getenv("API_KEY_SCRAPY")
    # list your categories here
    categories = [
        'mobile', 'laptop', 'headphones', 'watch', 
        'camera', 'television', 'speaker', 'printer'
    ]

    def start_requests(self):
        for cat in self.categories:
            amazon_search = f'https://www.amazon.in/s?k={cat}'
            params = {
                'api_key': self.settings.get(API_KEY),
                'url': amazon_search,
                'render': 'true',
                'autoparse': 'false',
                'country_code': 'in',
                'device_type': 'desktop',
            }
            url = f"{self.scraperapi_endpoint}?{urlencode(params)}"
            yield scrapy.Request(
                url,
                callback=self.parse_search,
                meta={'category': cat}
            )

    def parse_search(self, response):
        category = response.meta['category']
        # select all product containers (may need tweaking if Amazon layout changes)
        products = response.css('div.s-main-slot div.s-result-item')

        for product in products:
            name = product.css('div[data-testid="product-name"] div::text').get()
            price = product.css('div[data-testid="product-price"] span::text').get()
            mrp = product.css('div[data-testid="product-mrp"] span::text').get()
            qty = product.css('div[data-testid="product-qty"]::text').get()
            rel_link = product.css('a::attr(href)').get()
            image = product.css('img::attr(src)').get()

            if name:
                yield {
                    'category': category,
                    'name': name.strip(),
                    'price': price.strip() if price else None,
                    'quantity': qty.strip() if qty else None,
                    'link': response.urljoin(rel_link) if rel_link else None,
                    'image': image,
                }

        # simple pagination: look for “Next” link and follow
        next_page = response.css('ul.a-pagination li.a-last a::attr(href)').get()
        if next_page:
            next_url = response.urljoin(next_page)
            params = {
                'api_key': self.settings.get('SCRAPERAPI_KEY'),
                'url': next_url,
                'render': 'true',
                'autoparse': 'false',
                'country_code': 'in',
                'device_type': 'desktop',
            }
            paged_url = f"{self.scraperapi_endpoint}?{urlencode(params)}"
            yield scrapy.Request(
                paged_url,
                callback=self.parse_search,
                meta={'category': category}
            )
