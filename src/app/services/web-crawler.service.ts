import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: {
    score: number;
    label: string;
  };
  impactScore?: number;
}

export interface CrawlerConfig {
  maxDepth: number;
  maxPages: number;
  allowedDomains: string[];
  excludedPaths: string[];
  crawlDelay: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebCrawlerService {
  private readonly API_URL = environment.webCrawler.apiUrl;
  private readonly API_KEY = environment.webCrawler.apiKey;
  private readonly headers = {
    'Authorization': `Bearer ${this.API_KEY}`,
    'Content-Type': 'application/json'
  };

  constructor(private http: HttpClient) {}

  // Crawl news sources for stock-related content
  crawlNewsSources(symbols: string[]): Observable<NewsArticle[]> {
    const params = {
      symbols: symbols.join(','),
      maxDepth: environment.webCrawler.maxDepth,
      maxPages: environment.webCrawler.maxPages
    };

    return this.http.post<{ articles: NewsArticle[] }>(
      `${this.API_URL}/crawl/news`,
      params,
      { headers: this.headers }
    ).pipe(
      map(response => response.articles),
      catchError(this.handleError)
    );
  }

  // Crawl specific URL for content
  crawlUrl(url: string, config: Partial<CrawlerConfig> = {}): Observable<NewsArticle> {
    const defaultConfig: CrawlerConfig = {
      maxDepth: environment.webCrawler.maxDepth,
      maxPages: environment.webCrawler.maxPages,
      allowedDomains: environment.webCrawler.allowedDomains,
      excludedPaths: environment.webCrawler.excludedPaths,
      crawlDelay: environment.webCrawler.crawlDelay
    };

    const finalConfig = { ...defaultConfig, ...config };

    return this.http.post<{ article: NewsArticle }>(
      `${this.API_URL}/crawl/url`,
      { url, config: finalConfig },
      { headers: this.headers }
    ).pipe(
      map(response => response.article),
      catchError(this.handleError)
    );
  }

  // Get historical articles for analysis
  getHistoricalArticles(symbol: string, startDate: Date, endDate: Date): Observable<NewsArticle[]> {
    const params: Record<string, string> = {
      symbol,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    return this.http.get<{ articles: NewsArticle[] }>(
      `${this.API_URL}/articles/historical`,
      {
        headers: this.headers,
        params
      }
    ).pipe(
      map(response => response.articles),
      catchError(this.handleError)
    );
  }

  // Update article metrics
  updateArticleMetrics(articleId: string): Observable<any> {
    return this.http.get<{ metrics: any }>(
      `${this.API_URL}/articles/${articleId}/metrics`,
      { headers: this.headers }
    ).pipe(
      map(response => response.metrics),
      catchError(this.handleError)
    );
  }

  // Extract key information from article
  extractKeyInformation(article: NewsArticle): Observable<{
    keyPoints: string[];
    entities: string[];
    sentiment: { score: number; label: string };
  }> {
    return this.http.post<{
      keyPoints: string[];
      entities: string[];
      sentiment: { score: number; label: string };
    }>(
      `${this.API_URL}/articles/analyze`,
      { article },
      { headers: this.headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('Web Crawler API Error:', error);
    return throwError(() => new Error(error.message || 'An error occurred with the Web Crawler API'));
  }
} 