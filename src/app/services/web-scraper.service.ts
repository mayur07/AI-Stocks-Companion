import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, forkJoin, timer } from 'rxjs';
import { map, catchError, shareReplay, delay, concatMap, retry } from 'rxjs/operators';
import { ScrapedStockData, ScrapedNewsItem } from '../models/stock.model';

@Injectable({
  providedIn: 'root'
})
export class WebScraperService {
  private readonly YAHOO_FINANCE_BASE_URL = 'https://finance.yahoo.com/quote/';
  private readonly MARKETWATCH_BASE_URL = 'https://www.marketwatch.com/investing/stock/';
  private readonly CNBC_BASE_URL = 'https://www.cnbc.com/quotes/';
  private readonly CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/'
  ];
  private currentProxyIndex = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
  private readonly MAX_RETRIES = 3;
  private cache: Map<string, { data: ScrapedStockData; timestamp: number }> = new Map();

  constructor(private http: HttpClient) {}

  private getWithProxy(url: string): Observable<string> {
    const proxyUrl = `${this.CORS_PROXIES[this.currentProxyIndex]}${encodeURIComponent(url)}`;
    return this.http.get(proxyUrl, { 
      responseType: 'text' as const
    }).pipe(
      retry({
        count: this.MAX_RETRIES,
        delay: (error, retryCount) => {
          if (error.status === 429) {
            // If rate limited, wait longer
            return timer(Math.pow(2, retryCount) * 1000);
          }
          // For other errors, try next proxy
          this.currentProxyIndex = (this.currentProxyIndex + 1) % this.CORS_PROXIES.length;
          return timer(1000);
        }
      }),
      catchError(error => {
        console.error(`Proxy error with ${this.CORS_PROXIES[this.currentProxyIndex]}:`, error);
        // Try next proxy
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.CORS_PROXIES.length;
        if (this.currentProxyIndex === 0) {
          // If we've tried all proxies, return empty string
          return of('');
        }
        // Retry with next proxy
        return this.getWithProxy(url);
      })
    );
  }

  getStockData(symbol: string): Observable<ScrapedStockData> {
    // Check cache first
    debugger;
    const cachedData = this.getFromCache(symbol);
    if (cachedData) {
      return of(cachedData);
    }

    // Try Yahoo Finance first
    return this.scrapeStockData(symbol).pipe(
      catchError(() => {
        debugger;
        // If Yahoo fails, try MarketWatch
        return this.scrapeMarketWatch(symbol).pipe(
          catchError(() => {
            // If MarketWatch fails, try CNBC
            return this.scrapeCNBC(symbol);
          })
        );
      }),
      map(data => {
        debugger;
        // Cache the successful response
        this.addToCache(symbol, data);
        return data;
      }),
      shareReplay(1)
    );
  }

  private getFromCache(symbol: string): ScrapedStockData | null {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private addToCache(symbol: string, data: ScrapedStockData): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  scrapeStockData(symbol: string): Observable<ScrapedStockData> {
    debugger;
    // Try Yahoo Finance first
    return this.scrapeYahooFinance(symbol).pipe(
      catchError(() => this.scrapeMarketWatch(symbol)),
      catchError(() => this.scrapeCNBC(symbol)),
      catchError(() => {
        // Return a default object instead of null
        return of({
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          marketCap: 0,
          source: 'Unknown',
          lastUpdated: new Date()
        });
      })
    );
  }

  private scrapeYahooFinance(symbol: string): Observable<ScrapedStockData> {
    debugger;
    return this.scrapeYahooFinanceNews(symbol).pipe(
      map(data => {
        debugger;
        return {
          symbol,
          name: data[0].title,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          marketCap: 0,
          peRatio: 0,
          eps: 0,
          dividendYield: 0,
          beta: 0,
          fiftyTwoWeekHigh: 0,
          fiftyTwoWeekLow: 0,
          avgVolume: 0,
          sector: '',
          industry: '',
          source: 'Yahoo Finance',
          lastUpdated: new Date()
        };
      })
    );
  }

  private scrapeMarketWatch(symbol: string): Observable<ScrapedStockData> {
    return this.http.get(`${this.MARKETWATCH_BASE_URL}${symbol}`, { responseType: 'text' }).pipe(
      map(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        return {
          symbol,
          name: this.extractText(doc, 'h1.company__name'),
          price: this.extractNumber(doc, 'span.value'),
          change: this.extractNumber(doc, 'span.change--percent--q'),
          changePercent: this.extractNumber(doc, 'span.change--percent--q'),
          volume: this.extractNumber(doc, 'span.volume'),
          marketCap: this.extractMarketCap(doc),
          peRatio: this.extractNumber(doc, 'li[data-field="pe-ratio"] .primary'),
          eps: this.extractNumber(doc, 'li[data-field="eps"] .primary'),
          dividendYield: this.extractNumber(doc, 'li[data-field="dividend-yield"] .primary'),
          beta: this.extractNumber(doc, 'li[data-field="beta"] .primary'),
          fiftyTwoWeekHigh: this.extractNumber(doc, 'li[data-field="52-week-high"] .primary'),
          fiftyTwoWeekLow: this.extractNumber(doc, 'li[data-field="52-week-low"] .primary'),
          avgVolume: this.extractNumber(doc, 'li[data-field="avg-volume"] .primary'),
          sector: this.extractText(doc, 'li[data-field="sector"] .primary'),
          industry: this.extractText(doc, 'li[data-field="industry"] .primary'),
          source: 'MarketWatch',
          lastUpdated: new Date()
        };
      })
    );
  }

  private scrapeCNBC(symbol: string): Observable<ScrapedStockData> {
    return this.http.get(`${this.CNBC_BASE_URL}${symbol}`, { responseType: 'text' }).pipe(
      map(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        return {
          symbol,
          name: this.extractText(doc, 'h1.quote-header__name'),
          price: this.extractNumber(doc, 'span.quote-price'),
          change: this.extractNumber(doc, 'span.quote-price-change'),
          changePercent: this.extractNumber(doc, 'span.quote-price-change-percent'),
          volume: this.extractNumber(doc, 'span.quote-volume'),
          marketCap: this.extractMarketCap(doc),
          peRatio: this.extractNumber(doc, 'td[data-field="pe-ratio"]'),
          eps: this.extractNumber(doc, 'td[data-field="eps"]'),
          dividendYield: this.extractNumber(doc, 'td[data-field="dividend-yield"]'),
          beta: this.extractNumber(doc, 'td[data-field="beta"]'),
          fiftyTwoWeekHigh: this.extractNumber(doc, 'td[data-field="52-week-high"]'),
          fiftyTwoWeekLow: this.extractNumber(doc, 'td[data-field="52-week-low"]'),
          avgVolume: this.extractNumber(doc, 'td[data-field="avg-volume"]'),
          sector: this.extractText(doc, 'td[data-field="sector"]'),
          industry: this.extractText(doc, 'td[data-field="industry"]'),
          source: 'CNBC',
          lastUpdated: new Date()
        };
      })
    );
  }

  private extractText(doc: Document, selector: string): string {
    const element = doc.querySelector(selector);
    return element?.textContent?.trim() || '';
  }

  private extractNumber(doc: Document, selector: string): number {
    const element = doc.querySelector(selector);
    if (!element?.textContent) return 0;
    const text = element.textContent.trim();
    return parseFloat(text.replace(/[^0-9.-]+/g, '')) || 0;
  }

  private extractMarketCap(doc: Document): number {
    const element = doc.querySelector('[data-field="market-cap"]');
    if (!element?.textContent) return 0;
    const text = element.textContent.trim();
    const value = parseFloat(text.replace(/[^0-9.-]+/g, ''));
    const multiplier = text.includes('B') ? 1000000000 : text.includes('M') ? 1000000 : 1;
    return value * multiplier;
  }

  getMultipleStocks(symbols: string[]): Observable<ScrapedStockData[]> {
    // Create a sequence of requests with exponential backoff
    const requests = symbols.map((symbol, index) => 
      timer(index * this.RATE_LIMIT_DELAY).pipe(
        concatMap(() => this.getStockData(symbol))
      )
    );

    return forkJoin(requests).pipe(
      map(results => results.filter((result): result is ScrapedStockData => result !== null)),
      catchError(error => {
        console.error('Error fetching multiple stocks:', error);
        return of([]);
      })
    );
  }

  getStockNews(symbol: string): Observable<ScrapedNewsItem[]> {
    // Create a sequence of requests with exponential backoff
    const requests = [
      this.scrapeYahooFinanceNews(symbol),
      timer(this.RATE_LIMIT_DELAY).pipe(
        concatMap(() => this.scrapeMarketWatchNews(symbol))
      ),
      timer(this.RATE_LIMIT_DELAY * 2).pipe(
        concatMap(() => this.scrapeCNBCNews(symbol))
      )
    ];

    return forkJoin(requests).pipe(
      map(([yahoo, marketwatch, cnbc]) => {
        const allNews = [...yahoo, ...marketwatch, ...cnbc];
        return allNews.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      }),
      catchError(error => {
        console.error('Error fetching news:', error);
        return of([]);
      })
    );
  }

  private scrapeYahooFinanceNews(symbol: string): Observable<ScrapedNewsItem[]> {
    return this.getWithProxy(`${this.YAHOO_FINANCE_BASE_URL}${symbol}`).pipe(
      map(html => {
        if (!html) {
          console.warn(`No content received for ${symbol} from Yahoo Finance`);
          return [];
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newsItems: ScrapedNewsItem[] = [];

        const newsElements = doc.querySelectorAll('div[data-test="content-list"] article');
        newsElements.forEach(element => {
          const titleElement = element.querySelector('h3');
          const linkElement = element.querySelector('a');
          const timeElement = element.querySelector('time');
          
          if (titleElement && linkElement) {
            newsItems.push({
              title: titleElement.textContent?.trim() || '',
              content: element.querySelector('p')?.textContent?.trim() || '',
              url: linkElement.getAttribute('href') || '',
              publishedAt: timeElement ? new Date(timeElement.getAttribute('datetime') || '') : new Date(),
              source: 'Yahoo Finance',
              relatedStocks: [symbol]
            });
          }
        });

        return newsItems;
      }),
      catchError(error => {
        console.error(`Error scraping Yahoo Finance news for ${symbol}:`, error);
        return of([]);
      })
    );
  }

  private scrapeMarketWatchNews(symbol: string): Observable<ScrapedNewsItem[]> {
    return this.getWithProxy(`${this.MARKETWATCH_BASE_URL}${symbol}`).pipe(
      map(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newsItems: ScrapedNewsItem[] = [];

        const newsElements = doc.querySelectorAll('div.article__content');
        newsElements.forEach(element => {
          const titleElement = element.querySelector('h3.article__headline');
          const linkElement = element.querySelector('a.article__headline');
          const timeElement = element.querySelector('span.article__timestamp');
          
          if (titleElement && linkElement) {
            newsItems.push({
              title: titleElement.textContent?.trim() || '',
              content: element.querySelector('p.article__summary')?.textContent?.trim() || '',
              url: linkElement.getAttribute('href') || '',
              publishedAt: timeElement ? new Date(timeElement.getAttribute('data-est') || '') : new Date(),
              source: 'MarketWatch',
              relatedStocks: [symbol]
            });
          }
        });

        return newsItems;
      }),
      catchError(() => of([]))
    );
  }

  private scrapeCNBCNews(symbol: string): Observable<ScrapedNewsItem[]> {
    return this.getWithProxy(`${this.CNBC_BASE_URL}${symbol}`).pipe(
      map(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newsItems: ScrapedNewsItem[] = [];

        const newsElements = doc.querySelectorAll('div.quote-news-headlines__item');
        newsElements.forEach(element => {
          const titleElement = element.querySelector('a.quote-news-headlines__link');
          const timeElement = element.querySelector('span.quote-news-headlines__date');
          
          if (titleElement) {
            newsItems.push({
              title: titleElement.textContent?.trim() || '',
              content: element.querySelector('p.quote-news-headlines__summary')?.textContent?.trim() || '',
              url: titleElement.getAttribute('href') || '',
              publishedAt: timeElement ? new Date(timeElement.textContent?.trim() || '') : new Date(),
              source: 'CNBC',
              relatedStocks: [symbol]
            });
          }
        });

        return newsItems;
      }),
      catchError(() => of([]))
    );
  }
} 