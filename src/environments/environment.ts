// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export interface Environment {
  production: boolean;
  apiUrl: string;
  alphaVantageApiKey: string;
  finnhubApiKey: string;
  polygonApiKey: string;
  twelveDataApiKey: string;
  twitter: {
    apiUrl: string;
    bearerToken: string;
    streamRules: {
      defaultRules: Array<{
        value: string;
        tag: string;
      }>;
    };
    rateLimits: {
      tweetsPerRequest: number;
      maxRequestsPer15Min: number;
    };
  };
  webCrawler: {
    apiUrl: string;
    apiKey: string;
    maxDepth: number;
    maxPages: number;
    allowedDomains: string[];
    excludedPaths: string[];
    crawlDelay: number;
  };
}

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  alphaVantageApiKey: 'RX4FNXAVLO2H3UCR',
  finnhubApiKey: 'd0oftnhr01qsib2cdtigd0oftnhr01qsib2cdtj0',
  polygonApiKey: 's4uQDirUb_r2ZamS1IxNgWzaY2BxIYSl',
  twelveDataApiKey: '8d2721bb6182468b8e492c0c64e85269',
  
  // Twitter API Configuration
  twitter: {
    apiUrl: 'https://api.twitter.com/2',
    bearerToken: 'AAAAAAAAAAAAAAAAAAAAAGY62QEAAAAApDf%2F7552epJuiAY8BD4WNoFmsDM%3Dos7SLyMHzNCD27Hf0Rg9iilFRUF0rG2mDRx1edDQZCumYn899t',
    streamRules: {
      defaultRules: [
        { value: '(stock market OR stocks) -is:retweet lang:en', tag: 'stock_market' },
        { value: '(crypto OR cryptocurrency) -is:retweet lang:en', tag: 'crypto' },
        { value: '(trading OR trader) -is:retweet lang:en', tag: 'trading' },
        { value: '(investing OR investment) -is:retweet lang:en', tag: 'investing' }
      ]
    },
    rateLimits: {
      tweetsPerRequest: 100,
      maxRequestsPer15Min: 450
    }
  },

  // Web Crawler Configuration
  webCrawler: {
    apiUrl: 'http://localhost:3000/crawler',
    apiKey: 'YOUR_CRAWLER_API_KEY',
    maxDepth: 3,
    maxPages: 100,
    allowedDomains: ['finance.yahoo.com', 'bloomberg.com', 'reuters.com'],
    excludedPaths: ['/login', '/signup', '/admin'],
    crawlDelay: 1000 // Delay between requests in milliseconds
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
