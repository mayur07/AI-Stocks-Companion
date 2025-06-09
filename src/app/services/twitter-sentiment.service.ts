import { Injectable } from '@angular/core';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { SentimentScore } from '../models/sentiment.model';
import { Tweet } from './twitter.service';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

interface SentimentResult {
  score: number;
  label: string;
  confidence: number;
  aspects: {
    market: number;
    company: number;
    technical: number;
    fundamental: number;
  };
}

// Extend the Tweet interface to include aspects in sentiment
interface TweetWithAspects extends Tweet {
  sentiment: SentimentResult;
  impactScore: number;
}

@Injectable({
  providedIn: 'root'
})
export class TwitterSentimentService {
  private readonly SENTIMENT_THRESHOLDS = {
    STRONG_POSITIVE: 0.6,
    POSITIVE: 0.2,
    NEUTRAL: -0.2,
    NEGATIVE: -0.6
  };

  private readonly KEYWORDS = {
    market: ['market', 'trading', 'investing', 'portfolio', 'bullish', 'bearish'],
    company: ['earnings', 'revenue', 'growth', 'management', 'CEO', 'CFO'],
    technical: ['support', 'resistance', 'trend', 'chart', 'pattern', 'indicator'],
    fundamental: ['valuation', 'P/E', 'dividend', 'balance sheet', 'cash flow']
  };

  constructor(private sentimentAnalysisService: SentimentAnalysisService) {}

  analyzeTweetSentiment(tweet: Tweet): Observable<TweetWithAspects> {
    return from(this.sentimentAnalysisService.analyzeText(tweet.text)).pipe(
      map((sentiment: SentimentScore) => ({
        ...tweet,
        sentiment: {
          score: sentiment.overall,
          label: this.getSentimentLabel(sentiment.overall),
          confidence: sentiment.confidence,
          aspects: {
            market: this.extractMarketSentiment(tweet.text),
            company: this.extractCompanySentiment(tweet.text),
            technical: this.extractTechnicalSentiment(tweet.text),
            fundamental: this.extractFundamentalSentiment(tweet.text)
          }
        },
        impactScore: this.calculateImpactScore(tweet)
      }))
    );
  }

  private getSentimentLabel(score: number): string {
    if (score > 0.6) return 'positive';
    if (score < 0.4) return 'negative';
    return 'neutral';
  }

  analyzeTweetBatch(tweets: Tweet[]): Observable<TweetWithAspects[]> {
    return from(Promise.all(
      tweets.map(tweet => this.analyzeTweetSentiment(tweet).toPromise())
    )).pipe(
      map(analyzedTweets => 
        analyzedTweets.filter((tweet): tweet is TweetWithAspects => tweet !== undefined)
          .map(tweet => ({
            ...tweet,
            impactScore: this.calculateImpactScore(tweet)
          }))
      )
    );
  }

  private extractMarketSentiment(text: string): number {
    // Implement market sentiment analysis
    return 0;
  }

  private extractCompanySentiment(text: string): number {
    // Implement company sentiment analysis
    return 0;
  }

  private extractTechnicalSentiment(text: string): number {
    // Implement technical sentiment analysis
    return 0;
  }

  private extractFundamentalSentiment(text: string): number {
    // Implement fundamental sentiment analysis
    return 0;
  }

  private calculateImpactScore(tweet: Tweet): number {
    let score = 1;
    
    // Calculate based on metrics
    score *= (1 + (tweet.metrics.likes / 1000));
    score *= (1 + (tweet.metrics.retweets / 500));
    score *= (1 + (tweet.metrics.replies / 100));

    // Calculate based on author influence
    score *= this.calculateAuthorScore(tweet.author);

    return Math.min(score, 10); // Cap at 10
  }

  private calculateAuthorScore(author: Tweet['author']): number {
    let score = 1;
    
    // Add more author scoring factors here
    // e.g., follower count, account age, etc.

    return score;
  }

  private analyzeAspects(text: string): SentimentResult['aspects'] {
    const aspects: { [key: string]: number } = {};
    
    Object.entries(this.KEYWORDS).forEach(([aspect, keywords]) => {
      const matches = keywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      aspects[aspect] = matches / keywords.length;
    });

    return {
      market: aspects['market'] || 0,
      company: aspects['company'] || 0,
      technical: aspects['technical'] || 0,
      fundamental: aspects['fundamental'] || 0
    };
  }

  private enhanceSentiment(
    baseSentiment: SentimentScore,
    aspects: SentimentResult['aspects']
  ): SentimentResult {
    const aspectWeights = {
      market: 0.4,
      company: 0.3,
      technical: 0.2,
      fundamental: 0.1
    };

    const weightedScore = Object.entries(aspects).reduce(
      (score, [aspect, value]) => score + (value * aspectWeights[aspect as keyof typeof aspectWeights]),
      baseSentiment.overall
    );

    const confidence = this.calculateConfidence(baseSentiment.confidence, aspects);
    const label = this.determineSentimentLabel(weightedScore);

    return {
      score: weightedScore,
      label,
      confidence,
      aspects
    };
  }

  private calculateConfidence(
    baseScore: number,
    aspects: SentimentResult['aspects']
  ): number {
    const aspectConfidence = Object.values(aspects).reduce((sum, value) => sum + value, 0) / 
      Object.keys(aspects).length;
    
    return (Math.abs(baseScore) + aspectConfidence) / 2;
  }

  private determineSentimentLabel(score: number): string {
    if (score >= this.SENTIMENT_THRESHOLDS.STRONG_POSITIVE) {
      return 'Strongly Positive';
    } else if (score >= this.SENTIMENT_THRESHOLDS.POSITIVE) {
      return 'Positive';
    } else if (score >= this.SENTIMENT_THRESHOLDS.NEUTRAL) {
      return 'Neutral';
    } else if (score >= this.SENTIMENT_THRESHOLDS.NEGATIVE) {
      return 'Negative';
    } else {
      return 'Strongly Negative';
    }
  }
} 