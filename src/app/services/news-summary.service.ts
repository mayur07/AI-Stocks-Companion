import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ModelLoaderService } from './model-loader.service';

export interface NewsSummary {
  title: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: number;
  source: string;
  url: string;
  publishedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NewsSummaryService {
  private readonly POLYGON_BASE_URL = 'https://api.polygon.io/v2';
  private readonly API_KEY = environment.polygonApiKey;
  private modelInitialized = false;

  constructor(
    private http: HttpClient,
    private modelLoader: ModelLoaderService
  ) {}

  getNewsSummaries(symbol: string): Observable<NewsSummary[]> {
    console.log('Fetching news summaries for symbol:', symbol);
    return this.http.get<any>(`${this.POLYGON_BASE_URL}/reference/news`, {
      params: {
        ticker: symbol,
        apiKey: this.API_KEY
      }
    }).pipe(
      tap(response => console.log('Received news response:', response)),
      map(response => {
        if (!response || !response.results) {
          console.warn('No news results found for symbol:', symbol);
          return [];
        }
        return response.results.map((item: any) => ({
          title: item.title,
          summary: item.description,
          keyPoints: this.extractKeyPoints(item.description),
          sentiment: this.analyzeSentiment(item.title + ' ' + item.description),
          relevance: this.calculateRelevance(item),
          source: item.publisher.name,
          url: item.article_url,
          publishedAt: new Date(item.published_utc)
        }));
      }),
      tap(summaries => console.log('Processed news summaries:', summaries)),
      catchError(error => {
        console.error('Error fetching news summaries:', error);
        return of([]);
      })
    );
  }

  private extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const wordFrequencies = this.calculateWordFrequencies(content);
    
    return sentences
      .map(sentence => {
        const words = sentence.toLowerCase().split(/\s+/);
        const score = words.reduce((sum, word) => sum + (wordFrequencies[word] || 0), 0) / words.length;
        return { sentence, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ sentence }) => sentence.trim());
  }

  private calculateWordFrequencies(text: string): { [key: string]: number } {
    const words = text.toLowerCase().split(/\s+/);
    const frequencies: { [key: string]: number } = {};
    
    words.forEach(word => {
      frequencies[word] = (frequencies[word] || 0) + 1;
    });

    return frequencies;
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['up', 'rise', 'gain', 'positive', 'growth', 'bullish', 'surge', 'rally', 'increase', 'profit'];
    const negativeWords = ['down', 'fall', 'loss', 'negative', 'decline', 'bearish', 'plunge', 'drop', 'decrease', 'loss'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateRelevance(item: any): number {
    let relevance = 0.5; // Base relevance
    
    // Recency factor
    const now = new Date();
    const publishedDate = new Date(item.published_utc);
    const hoursSincePublished = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60);
    relevance += Math.max(0, 0.3 * (1 - hoursSincePublished / 24));
    
    // Content length factor
    const contentLength = item.description.length;
    relevance += Math.min(0.2, contentLength / 10000);
    
    // Source credibility factor
    const credibleSources = ['Reuters', 'Bloomberg', 'Financial Times', 'Wall Street Journal'];
    if (credibleSources.includes(item.publisher.name)) {
      relevance += 0.2;
    }
    
    return Math.min(1, relevance);
  }
} 