import { Injectable } from '@angular/core';
import { Tweet } from './twitter.service';
import { StockMarketService, TechnicalIndicators } from './stock-market.service';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface TradingSignal {
  id: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  sourceTweet: Tweet;
  explanation: string;
  timestamp: Date;
  asset: {
    symbol: string;
    type: 'STOCK' | 'CRYPTO';
  };
  technicalIndicators?: {
    name: string;
    value: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class TwitterSignalService {
  constructor(private stockMarketService: StockMarketService) {}

  generateSignal(tweet: Tweet): Observable<TradingSignal | null> {
    return from(Promise.all([
      this.analyzeSentiment(tweet),
      this.analyzeTechnicalIndicators(tweet)
    ])).pipe(
      map(([sentiment, technicalIndicators]) => {
        if (!sentiment) return null;
        const signalType = this.determineSignalType(sentiment);
        const confidence = this.calculateConfidence(sentiment);
        return {
          id: uuidv4(),
          type: signalType,
          confidence,
          sourceTweet: tweet,
          explanation: this.generateExplanation(sentiment, technicalIndicators),
          timestamp: new Date(),
          asset: {
            symbol: this.extractSymbol(tweet.text),
            type: 'STOCK'
          },
          technicalIndicators: technicalIndicators.map((indicator: { name: string; value: number }) => ({
            name: indicator.name,
            value: indicator.value
          }))
        };
      })
    );
  }

  private analyzeSentiment(tweet: Tweet): Promise<{ type: 'BUY' | 'SELL' | 'HOLD'; confidence: number }> {
    // Implement sentiment analysis logic here
    return Promise.resolve({ type: 'HOLD', confidence: 0.5 });
  }

  private analyzeTechnicalIndicators(tweet: Tweet): Promise<Array<{ name: string; value: number }>> {
    // Implement technical indicators analysis logic here
    return Promise.resolve([]);
  }

  private determineSignalType(sentiment: { type: 'BUY' | 'SELL' | 'HOLD'; confidence: number }): 'BUY' | 'SELL' | 'HOLD' {
    return sentiment.type;
  }

  private calculateConfidence(sentiment: { type: 'BUY' | 'SELL' | 'HOLD'; confidence: number }): number {
    return sentiment.confidence;
  }

  private generateExplanation(sentiment: { type: 'BUY' | 'SELL' | 'HOLD'; confidence: number }, technicalIndicators: Array<{ name: string; value: number }>): string {
    // Implement explanation generation logic here
    return 'No explanation available.';
  }

  private extractSymbol(text: string): string {
    // Implement symbol extraction logic here
    return 'AAPL';
  }

  private analyzeTweetForSignal(tweet: Tweet): Observable<TradingSignal | null> {
    // Extract asset symbols from tweet
    const symbols = this.extractSymbols(tweet.text);
    if (symbols.length === 0) return from(Promise.resolve(null));

    return from(Promise.all(
      symbols.map(symbol => this.stockMarketService.getTechnicalIndicators(symbol).toPromise())
    )).pipe(
      map(indicators => {
        const sentiment = { type: 'HOLD' as const, confidence: 0.5 };
        const signalType = this.determineSignalType(sentiment);
        const confidence = this.calculateConfidence(sentiment);

        return {
          id: `signal_${Date.now()}`,
          type: signalType,
          confidence,
          sourceTweet: tweet,
          explanation: this.generateExplanation(sentiment, []),
          timestamp: new Date(),
          asset: {
            symbol: symbols[0],
            type: this.determineAssetType(symbols[0])
          },
          technicalIndicators: indicators?.filter(Boolean).map(indicator => [
            { name: 'SMA20', value: (indicator as TechnicalIndicators).sma20 },
            { name: 'EMA20', value: (indicator as TechnicalIndicators).ema20 },
            { name: 'RSI', value: (indicator as TechnicalIndicators).rsi },
            { name: 'MACD Signal', value: (indicator as TechnicalIndicators).macd.signal },
            { name: 'MACD Histogram', value: (indicator as TechnicalIndicators).macd.histogram }
          ]).flat() || []
        };
      })
    );
  }

  private extractSymbols(text: string): string[] {
    // Implement symbol extraction logic here
    return ['AAPL'];
  }

  private determineAssetType(symbol: string): 'STOCK' | 'CRYPTO' {
    // Implement asset type determination logic here
    return 'STOCK';
  }

  private validateSignal(signal: TradingSignal): Observable<boolean> {
    // Implementation to validate signal against historical performance
    // This is a placeholder - actual implementation will use ML model
    return from(Promise.resolve(true));
  }
} 