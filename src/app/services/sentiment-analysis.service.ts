import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import * as tf from '@tensorflow/tfjs';
import { pipeline } from '@xenova/transformers';
import { SentimentAnalysis, SentimentScore, Keyword, Entity, TrendPoint, NewsSentiment } from '../models/sentiment.model';

@Injectable({
  providedIn: 'root'
})
export class SentimentAnalysisService {
  private model: any = null;
  private modelLoaded = false;
  private readonly CACHE_DURATION = 3600000; // 1 hour
  private sentimentCache = new Map<string, { data: SentimentAnalysis, timestamp: number }>();

  constructor(private http: HttpClient) {
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      // Load the financial sentiment analysis model
      this.model = await pipeline('sentiment-analysis', 'ProsusAI/finbert');
      this.modelLoaded = true;
    } catch (error) {
      console.error('Error loading sentiment model:', error);
    }
  }

  async analyzeText(text: string): Promise<SentimentScore> {
    if (!this.modelLoaded) {
      await this.initializeModel();
    }

    try {
      const result = await this.model(text);
      
      // Convert the model output to our SentimentScore format
      const score = this.normalizeScore(result[0].score);
      const components = this.calculateComponents(result);
      const keywords = this.extractKeywords(text).map(k => ({
        ...k,
        topic: k.category // Use category as topic for now
      }));
      const topics = this.extractTopics(text);
      
      return {
        overall: score,
        confidence: result[0].score,
        components,
        keywords,
        topics,
        entities: [],
        trend: []
      };
    } catch (error) {
      console.error('Error analyzing text:', error);
      return {
        overall: 0,
        confidence: 0,
        components: { positive: 0, negative: 0, neutral: 0 },
        keywords: [],
        topics: [],
        entities: [],
        trend: []
      };
    }
  }

  private normalizeScore(score: number): number {
    // Convert the model's score to a -1 to 1 scale
    return (score - 0.5) * 2;
  }

  private calculateComponents(result: any) {
    // Calculate positive, negative, and neutral components
    return {
      positive: result.find((r: any) => r.label === 'positive')?.score || 0,
      negative: result.find((r: any) => r.label === 'negative')?.score || 0,
      neutral: result.find((r: any) => r.label === 'neutral')?.score || 0
    };
  }

  private extractKeywords(text: string) {
    const words = text.toLowerCase().split(/\W+/);
    const keywordScores = new Map<string, number>();
    
    // Enhanced financial keywords with sentiment weights
    const financialKeywords = {
      positive: [
        // Market Performance
        'bullish', 'outperform', 'growth', 'profit', 'gain', 'increase', 'surge', 'rally', 'upside',
        'breakthrough', 'milestone', 'record', 'peak', 'soar', 'jump', 'leap', 'spike',
        // Financial Health
        'dividend', 'yield', 'revenue', 'earnings', 'margin', 'cashflow', 'liquidity', 'solvency',
        'profitability', 'efficiency', 'optimization', 'synergy', 'acquisition', 'merger',
        // Market Position
        'leadership', 'dominance', 'market share', 'competitive', 'advantage', 'innovation',
        'breakthrough', 'pioneer', 'revolutionary', 'disruptive',
        // Growth Indicators
        'expansion', 'scaling', 'opportunity', 'potential', 'prospect', 'outlook', 'forecast',
        'guidance', 'target', 'objective', 'strategy', 'initiative'
      ],
      negative: [
        // Market Performance
        'bearish', 'underperform', 'loss', 'decline', 'decrease', 'plunge', 'crash', 'downturn',
        'correction', 'volatility', 'risk', 'uncertainty', 'concern', 'worry', 'fear',
        // Financial Health
        'debt', 'leverage', 'default', 'bankruptcy', 'insolvency', 'liquidation', 'write-off',
        'impairment', 'downgrade', 'downturn', 'recession', 'depression',
        // Market Position
        'competition', 'threat', 'challenge', 'pressure', 'headwind', 'obstacle', 'barrier',
        'setback', 'failure', 'disappointment', 'miss', 'shortfall',
        // Risk Factors
        'volatility', 'uncertainty', 'risk', 'exposure', 'vulnerability', 'weakness', 'deficiency',
        'concern', 'issue', 'problem', 'challenge', 'threat'
      ],
      neutral: [
        // Market Terms
        'market', 'stock', 'price', 'trading', 'volume', 'liquidity', 'volatility', 'trend',
        'pattern', 'indicator', 'index', 'benchmark', 'sector', 'industry',
        // Financial Terms
        'revenue', 'earnings', 'profit', 'loss', 'margin', 'ratio', 'multiple', 'valuation',
        'capital', 'asset', 'liability', 'equity', 'debt', 'cash',
        // Time Periods
        'quarter', 'annual', 'fiscal', 'year', 'period', 'term', 'duration', 'cycle',
        // Analysis Terms
        'analysis', 'report', 'forecast', 'projection', 'estimate', 'target', 'guidance',
        'outlook', 'perspective', 'view', 'opinion', 'assessment'
      ]
    };

    // Add sentiment weights for financial metrics
    const metricPatterns = [
      { pattern: /(\d+(?:\.\d+)?)\s*%?\s*(?:increase|growth|gain|up)/i, weight: 1 },
      { pattern: /(\d+(?:\.\d+)?)\s*%?\s*(?:decrease|decline|loss|down)/i, weight: -1 },
      { pattern: /(\d+(?:\.\d+)?)\s*%?\s*(?:above|exceed|beat)/i, weight: 1 },
      { pattern: /(\d+(?:\.\d+)?)\s*%?\s*(?:below|miss|under)/i, weight: -1 }
    ];

    // Process words for sentiment
    words.forEach(word => {
      if (financialKeywords.positive.includes(word)) {
        keywordScores.set(word, 1);
      } else if (financialKeywords.negative.includes(word)) {
        keywordScores.set(word, -1);
      } else if (financialKeywords.neutral.includes(word)) {
        keywordScores.set(word, 0);
      }
    });

    // Process text for financial metrics
    metricPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        const metric = matches[0];
        keywordScores.set(metric, weight);
      }
    });

    // Add entity recognition for company names and financial terms
    const entities = this.extractEntities(text);
    entities.forEach(entity => {
      if (!keywordScores.has(entity)) {
        keywordScores.set(entity, 0);
      }
    });

    return Array.from(keywordScores.entries())
      .map(([word, score]) => ({
        word,
        score,
        category: this.categorizeKeyword(word)
      }))
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }

  private extractEntities(text: string): string[] {
    // Simple entity recognition for company names and financial terms
    const entities: string[] = [];
    
    // Company name patterns (e.g., "Company Inc.", "Corp.", "Ltd.")
    const companyPatterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc\.|Corp\.|Ltd\.|LLC|PLC)\b/g,
      /\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g  // Acronyms
    ];

    // Financial term patterns
    const financialPatterns = [
      /\b(?:EPS|P\/E|ROE|ROI|EBITDA|PEG|DCF|WACC)\b/g,
      /\b(?:NASDAQ|NYSE|S&P|DJIA|FTSE|DAX)\b/g
    ];

    // Extract entities using patterns
    [...companyPatterns, ...financialPatterns].forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    });

    return [...new Set(entities)]; // Remove duplicates
  }

  private categorizeKeyword(word: string): string {
    if (word.match(/^(?:Inc\.|Corp\.|Ltd\.|LLC|PLC)$/)) return 'company';
    if (word.match(/^(?:EPS|P\/E|ROE|ROI|EBITDA|PEG|DCF|WACC)$/)) return 'metric';
    if (word.match(/^(?:NASDAQ|NYSE|S&P|DJIA|FTSE|DAX)$/)) return 'market';
    if (word.match(/^\d+(?:\.\d+)?%?$/)) return 'number';
    return 'term';
  }

  // Add topic modeling
  private extractTopics(text: string): string[] {
    const topics = new Set<string>();
    
    // Topic categories and their keywords
    const topicCategories = {
      earnings: ['earnings', 'revenue', 'profit', 'income', 'margin', 'eps'],
      market: ['market', 'stock', 'price', 'trading', 'volume', 'liquidity'],
      economy: ['economy', 'inflation', 'interest', 'rate', 'growth', 'gdp'],
      industry: ['sector', 'industry', 'competition', 'market share', 'position'],
      risk: ['risk', 'volatility', 'uncertainty', 'exposure', 'threat', 'challenge']
    };

    // Check text against topic categories
    Object.entries(topicCategories).forEach(([category, keywords]) => {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        topics.add(category);
      }
    });

    return Array.from(topics);
  }

  getSentimentAnalysis(symbol: string): Observable<SentimentAnalysis> {
    const now = Date.now();
    const cachedData = this.sentimentCache.get(symbol);

    if (cachedData && (now - cachedData.timestamp) < this.CACHE_DURATION) {
      return of(cachedData.data);
    }

    return this.http.get<any>(`${environment.apiUrl}/news/${symbol}`).pipe(
      switchMap(async news => {
        const newsSentiment = await Promise.all(
          news.map(async (item: any) => {
            const score = await this.analyzeText(item.title + ' ' + item.content);
            return {
              title: item.title,
              content: item.content,
              sentiment: this.getSentimentLabel(score.overall),
              score,
              publishedAt: new Date(item.publishedAt)
            };
          })
        );

        // Calculate overall sentiment
        const overallScore = this.calculateOverallSentiment(newsSentiment);
        
        // Generate sentiment trend
        const trend = this.generateSentimentTrend(newsSentiment);

        const analysis: SentimentAnalysis = {
          sentimentScore: {
            overall: overallScore,
            confidence: this.calculateConfidence(newsSentiment),
            components: this.calculateOverallComponents(newsSentiment),
            keywords: this.aggregateKeywords(newsSentiment),
            topics: this.extractTopics(newsSentiment.map(item => item.content).join(' ')),
            entities: [],
            trend: []
          },
          newsSentiment
        };

        // Cache the results
        this.sentimentCache.set(symbol, { data: analysis, timestamp: now });
        
        return analysis;
      }),
      catchError(error => {
        console.error('Error in sentiment analysis:', error);
        return of({
          sentimentScore: {
            overall: 0,
            confidence: 0,
            components: { positive: 0, negative: 0, neutral: 0 },
            keywords: [],
            topics: [],
            entities: [],
            trend: []
          },
          newsSentiment: []
        });
      })
    );
  }

  private getSentimentLabel(score: number): 'positive' | 'negative' | 'neutral' {
    if (score > 0.2) return 'positive';
    if (score < -0.2) return 'negative';
    return 'neutral';
  }

  private calculateOverallSentiment(newsSentiment: any[]): number {
    if (newsSentiment.length === 0) return 0;
    
    const totalScore = newsSentiment.reduce((sum, item) => sum + item.score.overall, 0);
    return totalScore / newsSentiment.length;
  }

  private calculateConfidence(newsSentiment: any[]): number {
    if (newsSentiment.length === 0) return 0;
    
    const totalConfidence = newsSentiment.reduce((sum, item) => sum + item.score.confidence, 0);
    return totalConfidence / newsSentiment.length;
  }

  private calculateOverallComponents(newsSentiment: any[]) {
    return newsSentiment.reduce((components, item) => ({
      positive: components.positive + item.score.components.positive,
      negative: components.negative + item.score.components.negative,
      neutral: components.neutral + item.score.components.neutral
    }), { positive: 0, negative: 0, neutral: 0 });
  }

  private aggregateKeywords(newsSentiment: NewsSentiment[]): Keyword[] {
    const keywordMap = new Map<string, { score: number; topic: string; category: string }>();
    
    newsSentiment.forEach(item => {
      item.score.keywords.forEach(keyword => {
        if (keywordMap.has(keyword.word)) {
          const existing = keywordMap.get(keyword.word)!;
          existing.score = (existing.score + keyword.score) / 2;
        } else {
          keywordMap.set(keyword.word, {
            score: keyword.score,
            topic: keyword.topic,
            category: keyword.category
          });
        }
      });
    });

    return Array.from(keywordMap.entries()).map(([word, data]) => ({
      word,
      score: data.score,
      topic: data.topic,
      category: data.category
    }));
  }

  private generateSentimentTrend(newsSentiment: any[]) {
    // Group news by date and calculate average sentiment
    const dailyScores = new Map<string, number[]>();
    
    newsSentiment.forEach(item => {
      const date = item.publishedAt.toISOString().split('T')[0];
      const scores = dailyScores.get(date) || [];
      scores.push(item.score.overall);
      dailyScores.set(date, scores);
    });

    return Array.from(dailyScores.entries())
      .map(([date, scores]) => ({
        date: new Date(date),
        score: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  getNewsSentiment(symbol: string): Observable<SentimentAnalysis> {
    return this.http.get<any>(`${environment.apiUrl}/news/${symbol}`).pipe(
      map(response => {
        const sentiment = response.sentiment;
        return {
          sentimentScore: {
            overall: sentiment.sentimentScore.overall,
            confidence: sentiment.sentimentScore.confidence,
            components: sentiment.sentimentScore.components,
            keywords: (sentiment.sentimentScore.keywords || []).map((k: any) => ({
              word: k.word,
              score: k.score,
              topic: k.topic || '',
              category: k.category
            })),
            entities: (sentiment.sentimentScore.entities || []).map((e: any) => ({
              word: e.word,
              category: e.category,
              relevance: e.relevance
            })),
            topics: sentiment.sentimentScore.topics || [],
            trend: (sentiment.sentimentScore.trend || []).map((t: any) => ({
              timestamp: t.timestamp,
              score: t.score
            }))
          },
          newsSentiment: (sentiment.newsSentiment || []).map((item: any) => ({
            title: item.title,
            publishedAt: item.publishedAt,
            sentiment: this.normalizeSentiment(item.sentiment),
            score: {
              overall: item.score.overall,
              topics: item.score.topics || [],
              keywords: (item.score.keywords || []).map((k: any) => ({
                word: k.word,
                score: k.score,
                topic: k.topic || '',
                category: k.category
              }))
            }
          }))
        };
      }),
      catchError(error => {
        console.error('Error fetching news sentiment:', error);
        return of({
          sentimentScore: {
            overall: 0,
            confidence: 0,
            components: { positive: 0, neutral: 0, negative: 0 },
            keywords: [],
            entities: [],
            topics: [],
            trend: []
          },
          newsSentiment: []
        });
      })
    );
  }

  private normalizeSentiment(sentiment: string): 'positive' | 'negative' | 'neutral' {
    const normalized = sentiment.toLowerCase();
    if (normalized === 'positive' || normalized === 'negative' || normalized === 'neutral') {
      return normalized;
    }
    return 'neutral';
  }
} 