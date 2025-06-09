import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, forkJoin, BehaviorSubject, timer } from 'rxjs';
import { map, catchError, tap, switchMap, shareReplay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Define the correct environment type
interface StockMarketEnvironment {
  polygonApiKey: string;
  alphaVantageApiKey: string;
  finnhubApiKey: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  lastUpdated: Date;
  peRatio?: number;
  dividendYield?: number;
  eps?: number;
  beta?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  avgVolume?: number;
  sector?: string;
  industry?: string;
  source?: string;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedStocks: string[];
}

export interface MarketOverview {
  marketStatus: 'open' | 'closed';
  topGainers: any[];
  topLosers: any[];
  mostActive: any[];
  lastUpdated: string;
}

export interface TechnicalIndicators {
  sma20: number;
  ema20: number;
  rsi: number;
  macd: {
    signal: number;
    histogram: number;
  };
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

export interface ForexData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: Date;
}

export interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
}

export interface ConsensusStock {
  symbol: string;
  averagePrice: number;
  averageChange: number;
  consensus: 'positive' | 'negative' | 'neutral';
  dataQuality: number;
  lastUpdated: Date;
}

interface PolygonTicker {
  ticker: string;
  name: string;
  lastTrade: {
    p: number;
  };
  todaysChange: number;
  todaysChangePerc: number;
  todaysVolume: number;
  market: {
    cap: number;
    sector?: string;
    industry?: string;
    pe?: number;
    eps?: number;
    dividendYield?: number;
    beta?: number;
    high52w?: number;
    low52w?: number;
    avgVolume?: number;
  };
}

export interface PolygonNewsResponse {
  results: Array<{
    title: string;
    description: string;
    article_url: string;
    publisher: { name: string };
    published_utc: string;
    tickers: string[];
  }>;
}

interface PolygonResponse {
  results: Array<{
    title: string;
    description: string;
    publisher: { name: string };
    published_utc: string;
    article_url: string;
    tickers: string[];
  }>;
}

interface AlphaVantageResponse {
  feed: Array<{
    title: string;
    summary: string;
    source: string;
    time_published: string;
    url: string;
    overall_sentiment_score: number;
    ticker_sentiment: Array<{ ticker: string }>;
  }>;
}

interface AlphaVantageGlobalQuote {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}

interface AlphaVantageCompanyOverview {
  Symbol: string;
  Name: string;
  Description: string;
  Sector: string;
  Industry: string;
  MarketCapitalization: string;
  PERatio: string;
  EPS: string;
  DividendYield: string;
  Beta: string;
  '52WeekHigh': string;
  '52WeekLow': string;
}

interface AlphaVantageForexRate {
  'Realtime Currency Exchange Rate': {
    '1. From_Currency Code': string;
    '2. From_Currency Name': string;
    '3. To_Currency Code': string;
    '4. To_Currency Name': string;
    '5. Exchange Rate': string;
    '6. Last Refreshed': string;
    '7. Time Zone': string;
    '8. Bid Price': string;
    '9. Ask Price': string;
  };
}

interface AlphaVantageCryptoData {
  'Meta Data': {
    '1. Digital Currency Code': string;
    '2. Digital Currency Name': string;
    '3. Market Code': string;
    '4. Market Name': string;
    '5. Last Refreshed': string;
    '6. Time Zone': string;
  };
  'Time Series (Digital Currency Daily)': {
    [date: string]: {
      '1a. open (USD)': string;
      '1b. open (USD)': string;
      '2a. high (USD)': string;
      '2b. high (USD)': string;
      '3a. low (USD)': string;
      '3b. low (USD)': string;
      '4a. close (USD)': string;
      '4b. close (USD)': string;
      '5. volume': string;
      '6. market cap (USD)': string;
    };
  };
}

interface AlphaVantageError {
  'Error Message'?: string;
  'Note'?: string;
}

type AlphaVantageApiResponse = 
  | AlphaVantageGlobalQuote 
  | AlphaVantageCompanyOverview 
  | AlphaVantageForexRate 
  | AlphaVantageCryptoData 
  | AlphaVantageError;

export interface StockSuggestion {
  symbol: string;
  name: string;
  exchange: string;
}

@Injectable({
  providedIn: 'root'
})
export class StockMarketService {
  private polygonBaseUrl = 'https://api.polygon.io/v2';
  private alphaVantageBaseUrl = 'https://www.alphavantage.co/query';
  private finnhubBaseUrl = 'https://finnhub.io/api/v1';
  private apiKey = (environment as StockMarketEnvironment).polygonApiKey;
  private alphaVantageApiKey = (environment as StockMarketEnvironment).alphaVantageApiKey;
  private finnhubApiKey = (environment as StockMarketEnvironment).finnhubApiKey;
  private baseUrl = 'https://api.polygon.io';

  // Cache for market status
  private marketStatusCache$ = new BehaviorSubject<MarketOverview | null>(null);
  private lastMarketStatusUpdate = 0;
  private readonly MARKET_STATUS_CACHE_DURATION = 60000; // 1 minute cache

  // Cache for stock data
  private stockDataCache = new Map<string, { data: any, timestamp: number }>();
  private readonly STOCK_DATA_CACHE_DURATION = 300000; // 5 minutes cache

  // Cache for news data
  private newsCache = new Map<string, { data: any, timestamp: number }>();
  private readonly NEWS_CACHE_DURATION = 900000; // 15 minutes cache

  // Add cache for technical indicators
  private technicalIndicatorsCache = new Map<string, { data: TechnicalIndicators, timestamp: number }>();
  private readonly TECHNICAL_INDICATORS_CACHE_DURATION = 300000; // 5 minutes cache

  // Cache for stock search results
  private searchCache = new Map<string, { data: StockSuggestion[], timestamp: number }>();
  private readonly SEARCH_CACHE_DURATION = 3600000; // 1 hour cache

  private readonly CACHE_DURATION = 3600000; // 1 hour
  private cache = new Map<string, { data: any; timestamp: number }>();

  // Cache for Alpha Vantage API responses
  private readonly ALPHA_VANTAGE_CACHE_PREFIX = 'alpha_vantage_';
  private readonly ALPHA_VANTAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private http: HttpClient) {}

  getMarketOverview(): Observable<MarketOverview> {
    const now = Date.now();
    
    // Return cached data if it's still valid
    if (this.marketStatusCache$.value && 
        (now - this.lastMarketStatusUpdate) < this.MARKET_STATUS_CACHE_DURATION) {
      return of(this.marketStatusCache$.value);
    }

    // Make new request if cache is invalid
    return this.http.get<MarketOverview>(`${this.baseUrl}/v2/market/status/now`, {
      params: {
        apiKey: this.apiKey
      }
    }).pipe(
      tap(data => {
        this.marketStatusCache$.next(data);
        this.lastMarketStatusUpdate = now;
      }),
      catchError(error => {
        console.error('Error fetching market status:', error);
        // Return cached data even if expired in case of error
        if (this.marketStatusCache$.value) {
          return of(this.marketStatusCache$.value);
        }
        return throwError(() => new Error('Failed to fetch market status'));
      }),
      shareReplay(1)
    );
  }

  getStockData(symbol: string): Observable<StockData> {
    const now = Date.now();
    const cachedData = this.stockDataCache.get(symbol);

    // Return cached data if it's still valid
    if (cachedData && (now - cachedData.timestamp) < this.STOCK_DATA_CACHE_DURATION) {
      return of(cachedData.data);
    }

    // Make new request if cache is invalid
    return this.http.get(`${this.polygonBaseUrl}/aggs/ticker/${symbol}/prev`, {
      params: {
        apiKey: this.apiKey
      }
    }).pipe(
      map(response => {
        const data = response as any;
        if (!data || !data.results || !data.results.length) {
          throw new Error('Invalid stock data response');
        }

        const result = data.results[0];
        const stockData: StockData = {
          symbol: symbol,
          name: symbol, // Will be updated by company overview
          price: result.c,
          change: result.c - result.o,
          changePercent: ((result.c - result.o) / result.o) * 100,
          volume: result.v,
          marketCap: 0, // Will be updated by company overview
          lastUpdated: new Date(result.t)
        };

        this.stockDataCache.set(symbol, { data: stockData, timestamp: now });
        return stockData;
      }),
      catchError(error => {
        console.error(`Error fetching stock data for ${symbol}:`, error);
        if (cachedData) {
          return of(cachedData.data);
        }
        return throwError(() => new Error('Failed to fetch stock data'));
      }),
      shareReplay(1)
    );
  }

  private getAlphaVantageData<T extends AlphaVantageApiResponse>(endpoint: string, params: any): Observable<T> {
    const cacheKey = this.ALPHA_VANTAGE_CACHE_PREFIX + endpoint + '_' + JSON.stringify(params);
    const cachedData = this.getCachedAlphaVantageData<T>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<T>(this.alphaVantageBaseUrl, { params }).pipe(
      tap(response => {
        // Check if response contains rate limit message
        if ('Note' in response && response.Note?.includes('API call frequency')) {
          // If we hit rate limit, try to use cached data
          const cachedData = this.getCachedAlphaVantageData<T>(cacheKey);
          if (cachedData) {
            return of(cachedData);
          }
        }
        // Cache successful response
        this.cacheAlphaVantageData(cacheKey, response);
        return response;
      }),
      catchError(error => {
        // On error, try to use cached data
        const cachedData = this.getCachedAlphaVantageData<T>(cacheKey);
        if (cachedData) {
          return of(cachedData);
        }
        return throwError(() => error);
      })
    );
  }

  private getCachedAlphaVantageData<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < this.ALPHA_VANTAGE_CACHE_DURATION) {
          return data as T;
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    return null;
  }

  private cacheAlphaVantageData<T>(key: string, data: T): void {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  getAlphaVantageStockData(symbol: string): Observable<any> {
    return this.getAlphaVantageData('GLOBAL_QUOTE', {
      function: 'GLOBAL_QUOTE',
      symbol,
      apikey: this.alphaVantageApiKey
    });
  }

  getFinnhubStockData(symbol: string): Observable<any> {
    return this.http.get(`${this.finnhubBaseUrl}/quote`, {
      params: {
        symbol,
        token: this.finnhubApiKey
      }
    }).pipe(
      catchError(error => {
        console.error(`Error fetching Finnhub data for ${symbol}:`, error);
        return of(null);
      })
    );
  }

  getStockNews(symbol: string): Observable<NewsItem[]> {
    const now = Date.now();
    const cacheKey = `news_${symbol}`;
    const cachedData = this.newsCache.get(cacheKey);

    // Return cached data if it's still valid
    if (cachedData && (now - cachedData.timestamp) < this.NEWS_CACHE_DURATION) {
      return of(cachedData.data);
    }

    // Make new request if cache is invalid
    return forkJoin({
      polygon: this.http.get<PolygonResponse>(`${this.polygonBaseUrl}/reference/news`, {
        params: {
          ticker: symbol,
          apiKey: this.apiKey
        }
      }).pipe(
        catchError(() => of({ results: [] }))
      ),
      alphaVantage: this.http.get<AlphaVantageResponse>(`${this.alphaVantageBaseUrl}?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${this.alphaVantageApiKey}`).pipe(
        catchError(() => of({ feed: [] }))
      )
    }).pipe(
      map(({ polygon, alphaVantage }) => {
        const newsItems: NewsItem[] = [];

        // Process Polygon news
        if (polygon.results) {
          polygon.results.forEach((item: PolygonResponse['results'][0]) => {
            newsItems.push({
              title: item.title,
              content: item.description,
              source: item.publisher.name,
              publishedAt: new Date(item.published_utc),
              url: item.article_url,
              sentiment: this.determineSentiment(item.title + ' ' + item.description),
              relatedStocks: item.tickers || []
            });
          });
        }

        // Process Alpha Vantage news
        if (alphaVantage.feed) {
          alphaVantage.feed.forEach((item: AlphaVantageResponse['feed'][0]) => {
            // Check if this news item is already included from Polygon
            const isDuplicate = newsItems.some(existing => 
              existing.title === item.title || 
              existing.url === item.url
            );

            if (!isDuplicate) {
              newsItems.push({
                title: item.title,
                content: item.summary,
                source: item.source,
                publishedAt: new Date(item.time_published),
                url: item.url,
                sentiment: this.mapSentiment(item.overall_sentiment_score),
                relatedStocks: item.ticker_sentiment?.map(t => t.ticker) || []
              });
            }
          });
        }

        // Sort by date, most recent first
        return newsItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      }),
      tap(data => {
        this.newsCache.set(cacheKey, { data, timestamp: now });
      }),
      catchError(error => {
        console.error(`Error fetching news for ${symbol}:`, error);
        // Return cached data even if expired in case of error
        if (cachedData) {
          return of(cachedData.data);
        }
        return of([]);
      }),
      shareReplay(1)
    );
  }

  private determineSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'up', 'rise', 'gain', 'positive', 'growth', 'bullish', 'surge', 'rally', 'increase', 'profit',
      'beat', 'exceed', 'outperform', 'strong', 'improve', 'recovery', 'opportunity', 'potential',
      'breakthrough', 'innovation', 'success', 'win', 'award', 'launch', 'expand'
    ];
    
    const negativeWords = [
      'down', 'fall', 'loss', 'negative', 'decline', 'bearish', 'plunge', 'drop', 'decrease', 'loss',
      'miss', 'underperform', 'weak', 'worse', 'concern', 'risk', 'warning', 'caution', 'delay',
      'cut', 'reduce', 'layoff', 'bankruptcy', 'fail', 'crash', 'plummet'
    ];
    
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = lowerText.match(regex);
      if (matches) positiveCount += matches.length;
    });
    
    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = lowerText.match(regex);
      if (matches) negativeCount += matches.length;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  getMarketNews(): Observable<PolygonNewsResponse> {
    return this.http.get<PolygonNewsResponse>(`${this.polygonBaseUrl}/reference/news`, {
      params: {
        apiKey: this.apiKey
      }
    }).pipe(
      catchError(error => {
        console.error('Error fetching market news:', error);
        return of({ results: [] });
      })
    );
  }

  getEconomicNews(): Observable<NewsItem[]> {
    return this.http.get(`${this.polygonBaseUrl}/reference/news`, {
      params: {
        topic: 'economy',
        apiKey: this.apiKey
      }
    }).pipe(
      map(response => this.transformNewsResponse(response)),
      catchError(error => {
        console.error('Error fetching economic news:', error);
        return of([]);
      })
    );
  }

  getSectorNews(): Observable<NewsItem[]> {
    return this.http.get(`${this.polygonBaseUrl}/reference/news`, {
      params: {
        topic: 'sectors',
        apiKey: this.apiKey
      }
    }).pipe(
      map(response => this.transformNewsResponse(response)),
      catchError(error => {
        console.error('Error fetching sector news:', error);
        return of([]);
      })
    );
  }

  private transformNewsResponse(response: any): NewsItem[] {
    if (!response || !response.results) return [];
    
    return response.results.map((item: any) => ({
      title: item.title,
      content: item.description,
      source: item.publisher.name,
      publishedAt: new Date(item.published_utc),
      url: item.article_url,
      sentiment: this.determineSentiment(item.title + ' ' + item.description),
      relatedStocks: item.tickers || []
    }));
  }

  getTechnicalIndicators(symbol: string): Observable<TechnicalIndicators> {
    const cacheKey = `technical_${symbol}`;
    const cachedData = this.getCachedData<TechnicalIndicators>(cacheKey);
    if (cachedData) {
      return of(cachedData);
    }

    // Get daily data for the last 30 days to calculate indicators
    return this.http.get<any>(`${this.polygonBaseUrl}/aggs/ticker/${symbol}/range/1/day/2023-01-01/2024-01-01`, {
      params: {
        apiKey: this.apiKey,
        limit: 30
      }
    }).pipe(
      map(data => {
        const prices = data.results.map((item: any) => item.c);
        const volumes = data.results.map((item: any) => item.v);
        
        // Calculate SMA20
        const sma20 = this.calculateSMA(prices, 20);
        
        // Calculate EMA20
        const ema20 = this.calculateEMA(prices, 20);
        
        // Calculate RSI
        const rsi = this.calculateRSI(prices, 14);
        
        // Calculate MACD
        const macd = this.calculateMACD(prices);

        const indicators: TechnicalIndicators = {
          sma20,
          ema20,
          rsi,
          macd
        };

        this.cacheData(cacheKey, indicators);
        return indicators;
      }),
      catchError(error => {
        console.error('Error fetching technical indicators:', error);
        return of({
          sma20: 0,
          ema20: 0,
          rsi: 0,
          macd: {
            signal: 0,
            histogram: 0
          }
        });
      })
    );
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < period + 1; i++) {
      const difference = prices[prices.length - i] - prices[prices.length - i - 1];
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { signal: number; histogram: number } {
    if (prices.length < 26) return { signal: 0, histogram: 0 };
    
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA([macdLine], 9);
    
    return {
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  getSentimentAnalysis(symbol: string): Observable<any> {
    return forkJoin({
      news: this.getStockNews(symbol),
      alphaVantage: this.http.get<any>(`${this.alphaVantageBaseUrl}?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${this.alphaVantageApiKey}`).pipe(
        catchError(() => of(null))
      )
    }).pipe(
      map(({ news, alphaVantage }) => {
        // Process news items for sentiment
        const newsSentiment = news.map(item => ({
          title: item.title,
          sentiment: item.sentiment
        }));

        // Get overall sentiment from Alpha Vantage if available
        let overallSentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (alphaVantage && alphaVantage.feed && alphaVantage.feed.length > 0) {
          const avgSentiment = alphaVantage.feed.reduce((sum: number, item: any) => 
            sum + (item.overall_sentiment_score || 0), 0) / alphaVantage.feed.length;
          
          if (avgSentiment > 0.2) overallSentiment = 'positive';
          else if (avgSentiment < -0.2) overallSentiment = 'negative';
        } else {
          // Fallback to news sentiment if Alpha Vantage data is not available
          const positiveCount = newsSentiment.filter(item => item.sentiment === 'positive').length;
          const negativeCount = newsSentiment.filter(item => item.sentiment === 'negative').length;
          
          if (positiveCount > negativeCount) overallSentiment = 'positive';
          else if (negativeCount > positiveCount) overallSentiment = 'negative';
        }

        return {
          overallSentiment,
          newsSentiment
        };
      }),
      catchError(error => {
        console.error('Error fetching sentiment analysis:', error);
        return of({
          overallSentiment: 'neutral' as const,
          newsSentiment: []
        });
      })
    );
  }

  getCompanyOverview(symbol: string): Observable<CompanyOverview> {
    return forkJoin({
      alphaVantage: this.getAlphaVantageCompanyOverview(symbol),
      finnhub: this.getFinnhubCompanyOverview(symbol)
    }).pipe(
      map(({ alphaVantage, finnhub }) => ({
        symbol: symbol,
        name: finnhub.name || alphaVantage.name,
        description: finnhub.description || alphaVantage.description,
        sector: finnhub.sector || alphaVantage.sector,
        industry: finnhub.industry || alphaVantage.industry,
        marketCap: finnhub.marketCap || alphaVantage.marketCap,
        peRatio: finnhub.peRatio || alphaVantage.peRatio,
        eps: finnhub.eps || alphaVantage.eps,
        dividendYield: finnhub.dividendYield || alphaVantage.dividendYield,
        beta: finnhub.beta || alphaVantage.beta,
        fiftyTwoWeekHigh: finnhub.fiftyTwoWeekHigh || alphaVantage.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: finnhub.fiftyTwoWeekLow || alphaVantage.fiftyTwoWeekLow
      })),
      catchError(error => {
        console.error('Error fetching company overview:', error);
        return throwError(() => new Error('Failed to fetch company overview'));
      })
    );
  }

  private getAlphaVantageCompanyOverview(symbol: string): Observable<CompanyOverview> {
    return this.getAlphaVantageData<AlphaVantageCompanyOverview>('OVERVIEW', {
      function: 'OVERVIEW',
      symbol,
      apikey: this.alphaVantageApiKey
    }).pipe(
      map(response => ({
        symbol: response.Symbol,
        name: response.Name,
        description: response.Description,
        sector: response.Sector,
        industry: response.Industry,
        marketCap: parseFloat(response.MarketCapitalization),
        peRatio: parseFloat(response.PERatio),
        eps: parseFloat(response.EPS),
        dividendYield: parseFloat(response.DividendYield),
        beta: parseFloat(response.Beta),
        fiftyTwoWeekHigh: parseFloat(response['52WeekHigh']),
        fiftyTwoWeekLow: parseFloat(response['52WeekLow'])
      }))
    );
  }

  private getFinnhubCompanyOverview(symbol: string): Observable<CompanyOverview> {
    return this.http.get<any>(`${this.finnhubBaseUrl}/stock/profile2?symbol=${symbol}&token=${this.finnhubApiKey}`).pipe(
      map(response => ({
        symbol: symbol,
        name: response.name,
        description: response.description,
        sector: response.finnhubIndustry,
        industry: response.industry,
        marketCap: response.marketCapitalization,
        peRatio: response.pe,
        eps: response.eps,
        dividendYield: response.dividend,
        beta: response.beta,
        fiftyTwoWeekHigh: response['52WeekHigh'],
        fiftyTwoWeekLow: response['52WeekLow']
      }))
    );
  }

  getForexRate(fromCurrency: string, toCurrency: string): Observable<ForexData> {
    // Only use Alpha Vantage for forex data since Finnhub requires premium access
    return this.getAlphaVantageForexRate(fromCurrency, toCurrency).pipe(
      catchError(error => {
        console.error('Error fetching forex rate:', error);
        return throwError(() => new Error('Failed to fetch forex rate. Please try again later.'));
      })
    );
  }

  private getAlphaVantageForexRate(fromCurrency: string, toCurrency: string): Observable<ForexData> {
    return this.getAlphaVantageData<AlphaVantageForexRate | AlphaVantageError>('CURRENCY_EXCHANGE_RATE', {
      function: 'CURRENCY_EXCHANGE_RATE',
      from_currency: fromCurrency,
      to_currency: toCurrency,
      apikey: this.alphaVantageApiKey
    }).pipe(
      map(response => {
        if ('Error Message' in response || 'Note' in response) {
          throw new Error(response['Error Message'] || response.Note);
        }
        if (!('Realtime Currency Exchange Rate' in response)) {
          throw new Error('Invalid forex rate response format');
        }
        const data = response['Realtime Currency Exchange Rate'];
        return {
          fromCurrency: data['1. From_Currency Code'],
          toCurrency: data['3. To_Currency Code'],
          rate: parseFloat(data['5. Exchange Rate']),
          lastUpdated: new Date(data['6. Last Refreshed'])
        };
      })
    );
  }

  getCryptoData(symbol: string): Observable<CryptoData> {
    // Only use Alpha Vantage for crypto data since Finnhub requires premium access
    return this.getAlphaVantageCryptoData(symbol).pipe(
      catchError(error => {
        console.error('Error fetching crypto data:', error);
        return throwError(() => new Error('Failed to fetch crypto data. Please try again later.'));
      })
    );
  }

  private getAlphaVantageCryptoData(symbol: string): Observable<CryptoData> {
    return this.getAlphaVantageData<AlphaVantageCryptoData | AlphaVantageError>('DIGITAL_CURRENCY_DAILY', {
      function: 'DIGITAL_CURRENCY_DAILY',
      symbol,
      market: 'USD',
      apikey: this.alphaVantageApiKey
    }).pipe(
      map(response => {
        if ('Error Message' in response || 'Note' in response) {
          throw new Error(response['Error Message'] || response.Note);
        }
        if (!('Meta Data' in response) || !('Time Series (Digital Currency Daily)' in response)) {
          throw new Error('Invalid crypto data response format');
        }

        const metadata = response['Meta Data'];
        const timeSeries = response['Time Series (Digital Currency Daily)'];
        const dates = Object.keys(timeSeries);
        
        if (!dates.length) {
          throw new Error('No crypto data available');
        }

        const latestDate = dates[0];
        const latestData = timeSeries[latestDate];
        
        return {
          symbol: metadata['1. Digital Currency Code'],
          name: metadata['2. Digital Currency Name'],
          price: parseFloat(latestData['4a. close (USD)']),
          change: parseFloat(latestData['4a. close (USD)']) - parseFloat(latestData['1a. open (USD)']),
          changePercent: ((parseFloat(latestData['4a. close (USD)']) - parseFloat(latestData['1a. open (USD)'])) / parseFloat(latestData['1a. open (USD)'])) * 100,
          marketCap: 0,
          volume24h: parseFloat(latestData['5. volume']),
          lastUpdated: new Date(metadata['5. Last Refreshed'])
        };
      })
    );
  }

  getEconomicIndicators(indicator: string): Observable<any> {
    return this.getAlphaVantageData(indicator, {
      function: indicator,
      apikey: this.alphaVantageApiKey
    });
  }

  getSectorPerformance(): Observable<any> {
    return this.getAlphaVantageData('SECTOR', {
      function: 'SECTOR',
      apikey: this.alphaVantageApiKey
    });
  }

  private mapSentiment(score: number): 'positive' | 'negative' | 'neutral' {
    if (score > 0.2) return 'positive';
    if (score < -0.2) return 'negative';
    return 'neutral';
  }

  getTopConsensusStocks(limit: number = 20): Observable<ConsensusStock[]> {
    const popularSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 'V', 'WMT', 
                          'PG', 'JNJ', 'HD', 'BAC', 'MA', 'UNH', 'XOM', 'DIS', 'NFLX', 'PYPL',
                          'INTC', 'CSCO', 'PFE', 'KO', 'PEP', 'MRK', 'ABT', 'TMO', 'VZ', 'CMCSA'];
    
    return forkJoin(
      popularSymbols.map(symbol => 
        forkJoin({
          alphaVantage: this.getAlphaVantageStockData(symbol),
          finnhub: this.getFinnhubStockData(symbol),
          sentiment: this.getSentimentAnalysis(symbol)
        }).pipe(
          map(data => {
            const prices = [];
            const changes = [];
            let dataQuality = 0;

            if (data.alphaVantage && data.alphaVantage['Global Quote']) {
              const quote = data.alphaVantage['Global Quote'];
              prices.push(parseFloat(quote['05. price']));
              changes.push(parseFloat(quote['10. change percent'].replace('%', '')));
              dataQuality += 50;
            }

            if (data.finnhub) {
              prices.push(data.finnhub.c);
              changes.push(data.finnhub.dp);
              dataQuality += 50;
            }

            const averagePrice = prices.length ? prices.reduce((a, b) => a + b) / prices.length : 0;
            const averageChange = changes.length ? changes.reduce((a, b) => a + b) / changes.length : 0;
            
            let consensus: 'positive' | 'negative' | 'neutral' = 'neutral';
            if (data.sentiment && data.sentiment.overallSentiment) {
              consensus = data.sentiment.overallSentiment;
            } else {
              consensus = averageChange > 0 ? 'positive' : averageChange < 0 ? 'negative' : 'neutral';
            }

            return {
              symbol,
              averagePrice,
              averageChange,
              consensus,
              dataQuality,
              lastUpdated: new Date()
            };
          })
        )
      )
    ).pipe(
      map(stocks => {
        return stocks
          .filter(stock => stock.dataQuality > 0)
          .sort((a, b) => {
            if (a.consensus === 'positive' && b.consensus !== 'positive') return -1;
            if (a.consensus !== 'positive' && b.consensus === 'positive') return 1;
            return b.averageChange - a.averageChange;
          })
          .slice(0, limit);
      })
    );
  }

  // Add a method to clear caches if needed
  clearCaches() {
    this.marketStatusCache$.next(null);
    this.lastMarketStatusUpdate = 0;
    this.stockDataCache.clear();
    this.newsCache.clear();
    this.technicalIndicatorsCache.clear();
  }

  searchStocks(term: string): Observable<StockSuggestion[]> {
    const now = Date.now();
    const cacheKey = `search_${term}`;
    const cachedData = this.searchCache.get(cacheKey);

    // Return cached data if it's still valid
    if (cachedData && (now - cachedData.timestamp) < this.SEARCH_CACHE_DURATION) {
      return of(cachedData.data);
    }

    // Make new request if cache is invalid
    return this.http.get<any>(`${this.baseUrl}/v3/reference/tickers`, {
      params: {
        search: term,
        apiKey: this.apiKey,
        limit: 10,
        active: true
      }
    }).pipe(
      map(response => {
        if (!response || !response.results) {
          return [];
        }

        const suggestions: StockSuggestion[] = response.results.map((item: any) => ({
          symbol: item.ticker,
          name: item.name,
          exchange: item.primary_exchange || item.market
        }));

        // Cache the results
        this.searchCache.set(cacheKey, { data: suggestions, timestamp: now });
        
        return suggestions;
      }),
      catchError(error => {
        console.error('Error searching stocks:', error);
        // Return cached data even if expired in case of error
        if (cachedData) {
          return of(cachedData.data);
        }
        return of([]);
      })
    );
  }

  searchStocksByName(term: string): Observable<StockSuggestion[]> {
    const now = Date.now();
    const cacheKey = `search_name_${term}`;
    const cachedData = this.searchCache.get(cacheKey);

    // Return cached data if it's still valid
    if (cachedData && (now - cachedData.timestamp) < this.SEARCH_CACHE_DURATION) {
      return of(cachedData.data);
    }

    // Make new request if cache is invalid
    return this.http.get<any>(`${this.baseUrl}/v3/reference/tickers`, {
      params: {
        search: term,
        apiKey: this.apiKey,
        limit: 10,
        active: true,
        sort: 'name'
      }
    }).pipe(
      map(response => {
        if (!response || !response.results) {
          return [];
        }

        const suggestions: StockSuggestion[] = response.results
          .filter((item: any) => 
            item.name.toLowerCase().includes(term.toLowerCase())
          )
          .map((item: any) => ({
            symbol: item.ticker,
            name: item.name,
            exchange: item.primary_exchange || item.market
          }));

        // Cache the results
        this.searchCache.set(cacheKey, { data: suggestions, timestamp: now });
        
        return suggestions;
      }),
      catchError(error => {
        console.error('Error searching stocks by name:', error);
        // Return cached data even if expired in case of error
        if (cachedData) {
          return of(cachedData.data);
        }
        return of([]);
      })
    );
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  private cacheData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
} 