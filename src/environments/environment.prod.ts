export const environment = {
  production: true,
  apiUrl: 'https://ai-stocks-companion.onrender.com/', // Replace with your actual production API URL
  alphaVantageApiKey: 'RX4FNXAVLO2H3UCR',
  finnhubApiKey: 'd0oftnhr01qsib2cdtigd0oftnhr01qsib2cdtj0',
  polygonApiKey: 's4uQDirUb_r2ZamS1IxNgWzaY2BxIYSl',
  twelveDataApiKey: '8d2721bb6182468b8e492c0c64e85269',
  
  // Web Crawler Configuration
  webCrawler: {
    apiUrl: 'https://api.example.com/crawler', // Replace with your actual production crawler API URL
    apiKey: 'YOUR_CRAWLER_API_KEY',
    maxDepth: 3,
    maxPages: 100,
    allowedDomains: ['finance.yahoo.com', 'bloomberg.com', 'reuters.com'],
    excludedPaths: ['/login', '/signup', '/admin'],
    crawlDelay: 1000 // Delay between requests in milliseconds
  }
};
