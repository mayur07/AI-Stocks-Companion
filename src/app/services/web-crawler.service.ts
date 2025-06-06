import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, catchError, mergeMap, toArray, flatMap } from 'rxjs/operators';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { environment } from '../../environments/environment';

export interface CrawledData {
  source: string;
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedStocks: string[];
}

@Injectable({
  providedIn: 'root'
})
export class WebCrawlerService {
  private readonly sources = [
    {
      name: 'Reuters',
      url: 'https://www.reuters.com/markets/',
      selector: {
        articles: 'article',
        title: 'h3',
        content: 'p',
        link: 'a'
      }
    },
    {
      name: 'Bloomberg',
      url: 'https://www.bloomberg.com/markets',
      selector: {
        articles: '.story-list-story',
        title: '.headline__text',
        content: '.summary__text',
        link: 'a'
      }
    },
    {
      name: 'CNBC',
      url: 'https://www.cnbc.com/markets/',
      selector: {
        articles: '.Card',
        title: '.Card-title',
        content: '.Card-description',
        link: 'a'
      }
    },
    {
      name: 'MarketWatch',
      url: 'https://www.marketwatch.com/markets',
      selector: {
        articles: '.article__content',
        title: '.article__headline',
        content: '.article__summary',
        link: 'a'
      }
    },
    {
      name: 'Financial Times',
      url: 'https://www.ft.com/markets',
      selector: {
        articles: '.js-teaser',
        title: '.js-teaser-heading-link',
        content: '.js-teaser-standfirst',
        link: 'a'
      }
    }
  ];

  private readonly sentimentDictionary = {
    positive: [
      'up', 'rise', 'gain', 'positive', 'growth', 'bullish', 'surge', 'rally', 'increase',
      'profit', 'success', 'opportunity', 'breakthrough', 'innovation', 'strong', 'robust',
      'outperform', 'beat', 'exceed', 'outpace', 'accelerate', 'expand', 'thrive', 'boom'
    ],
    negative: [
      'down', 'fall', 'loss', 'negative', 'decline', 'bearish', 'plunge', 'drop', 'decrease',
      'risk', 'concern', 'worry', 'caution', 'volatile', 'uncertain', 'weak', 'struggle',
      'underperform', 'miss', 'disappoint', 'slow', 'contract', 'decline', 'crash', 'plunge'
    ],
    neutral: [
      'maintain', 'stable', 'steady', 'unchanged', 'flat', 'hold', 'neutral', 'mixed',
      'balance', 'adjust', 'moderate', 'average', 'normal', 'typical', 'standard'
    ]
  };

  constructor(private http: HttpClient) {}

  crawlFinancialNews(): Observable<CrawledData[]> {
    return from(this.sources).pipe(
      mergeMap(source => this.crawlWebsite(source)),
      flatMap(articles => articles),
      toArray(),
      catchError(error => {
        console.error('Error crawling news:', error);
        return of([]);
      })
    );
  }

  private async crawlWebsite(source: any): Promise<CrawledData[]> {
    try {
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      const articles: CrawledData[] = [];

      $(source.selector.articles).each((_, element) => {
        const title = $(element).find(source.selector.title).text().trim();
        const content = $(element).find(source.selector.content).text().trim();
        const url = $(element).find(source.selector.link).attr('href');

        if (title && content && url) {
          const fullUrl = url.startsWith('http') ? url : new URL(url, source.url).toString();
          articles.push({
            source: source.name,
            url: fullUrl,
            title,
            content,
            timestamp: new Date(),
            sentiment: this.analyzeSentiment(title + ' ' + content),
            relatedStocks: this.extractStockSymbols(title + ' ' + content)
          });
        }
      });

      return articles;
    } catch (error) {
      console.error(`Error crawling ${source.name}:`, error);
      return [];
    }
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;

    words.forEach(word => {
      if (this.sentimentDictionary.positive.includes(word)) positiveScore += 1;
      if (this.sentimentDictionary.negative.includes(word)) negativeScore += 1;
      if (this.sentimentDictionary.neutral.includes(word)) neutralScore += 1;
    });

    // Calculate weighted scores
    const totalScore = positiveScore + negativeScore + neutralScore;
    if (totalScore === 0) return 'neutral';

    const positiveRatio = positiveScore / totalScore;
    const negativeRatio = negativeScore / totalScore;

    if (positiveRatio > 0.4) return 'positive';
    if (negativeRatio > 0.4) return 'negative';
    return 'neutral';
  }

  private extractStockSymbols(text: string): string[] {
    // Enhanced stock symbol extraction
    const patterns = [
      /\$[A-Z]{1,5}/g,  // $AAPL format
      /[A-Z]{1,5}\s*\([A-Z]{1,5}\)/g,  // AAPL (Apple) format
      /\b[A-Z]{1,5}\b/g  // Standalone symbols
    ];

    const symbols = new Set<string>();
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        // Clean up the symbol
        let symbol = match.replace(/[^A-Z]/g, '');
        if (symbol.length >= 1 && symbol.length <= 5) {
          symbols.add(symbol);
        }
      });
    });

    return Array.from(symbols);
  }
} 