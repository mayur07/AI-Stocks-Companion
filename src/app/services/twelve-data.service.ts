import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap, map } from 'rxjs/operators';
import { BaseCacheService, CACHE_PREFIX } from './base-cache.service';

@Injectable({
  providedIn: 'root',
  useFactory: (http: HttpClient) => new TwelveDataService(http),
  deps: [HttpClient]
})
export class TwelveDataService extends BaseCacheService {
  private baseUrl = 'https://api.twelvedata.com';
  private readonly DEFAULT_INTERVAL = '1day';

  constructor(private http: HttpClient) {
    super('twelvedata_');
  }

  getRealTimeQuotes(symbols: string[]): Observable<any> {
    const cacheKey = `${this.cachePrefix}quotes_${symbols.join('_')}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/quote`, {
      params: {
        symbol: symbols.join(','),
        apikey: environment.twelveDataApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching real-time quotes:', error);
        return throwError(() => error);
      })
    );
  }

  getTechnicalIndicators(symbol: string, interval: string = this.DEFAULT_INTERVAL): Observable<any> {
    const cacheKey = `${this.cachePrefix}indicators_${symbol}_${interval}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return forkJoin({
      rsi: this.getIndicator(symbol, 'rsi', interval),
      macd: this.getIndicator(symbol, 'macd', interval),
      sma: this.getIndicator(symbol, 'sma', interval, { time_period: 20 }),
      ema: this.getIndicator(symbol, 'ema', interval, { time_period: 20 })
    }).pipe(
      map(data => {
        // Extract the latest values from each indicator
        const indicators = {
          rsi: this.extractLatestValue(data.rsi),
          macd: {
            signal: this.extractLatestValue(data.macd, 'signal'),
            histogram: this.extractLatestValue(data.macd, 'histogram')
          },
          sma20: this.extractLatestValue(data.sma),
          ema20: this.extractLatestValue(data.ema)
        };
        return indicators;
      }),
      tap(data => {
        console.log('Processed technical indicators:', data);
        this.cacheData(cacheKey, data);
      }),
      catchError(error => {
        console.error('Error fetching technical indicators:', error);
        return throwError(() => error);
      })
    );
  }

  getFundamentalData(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}fundamentals_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/profile`, {
      params: {
        symbol,
        apikey: environment.twelveDataApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching fundamental data:', error);
        return throwError(() => error);
      })
    );
  }

  private getIndicator(symbol: string, indicator: string, interval: string = this.DEFAULT_INTERVAL, additionalParams: any = {}): Observable<any> {
    const cacheKey = `${this.cachePrefix}${indicator}_${symbol}_${interval}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/${indicator}`, {
      params: {
        symbol,
        interval,
        apikey: environment.twelveDataApiKey,
        ...additionalParams
      }
    }).pipe(
      tap(data => {
        console.log(`Raw ${indicator} data:`, data);
        this.cacheData(cacheKey, data);
      }),
      catchError(error => {
        console.error(`Error fetching ${indicator} indicator:`, error);
        return throwError(() => error);
      })
    );
  }

  private extractLatestValue(data: any, field?: string): number {
    if (!data || !data.values || !Array.isArray(data.values) || data.values.length === 0) {
      console.warn('No values found in indicator data:', data);
      return 0;
    }

    // Sort values by datetime in descending order
    const sortedValues = [...data.values].sort((a, b) => 
      new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );

    const latestValue = sortedValues[0];
    
    if (field) {
      return Number(latestValue[field]) || 0;
    }
    
    return Number(latestValue.value) || 0;
  }
} 