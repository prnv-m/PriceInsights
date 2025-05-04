import scrapy

class AmazonSpider(scrapy.Spider):
    name = 'amazon'
    allowed_domains = ['amazon.in']
    start_urls = ['https://www.amazon.in/s?k=mobile']

    def start_requests(self):
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        for url in self.start_urls:
            yield scrapy.Request(url=url, headers=headers, callback=self.parse)

    def parse(self, response):
        for product in response.css('div.s-result-item'):
            title = product.css('h2 span::text').get()
            price = product.css('span.a-price-whole::text').get()
            image_url =  product.css('img::attr(src)').get() or product.css('img::attr(data-src)').get() or product.css('img::attr(data-image-src)').get()
            if title and price:
                yield {
                    'title': title.strip(),
                    'price': price.strip(),
                    'image-url': image_url.strip()
                }
