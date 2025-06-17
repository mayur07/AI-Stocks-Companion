import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap } from 'rxjs/operators';
import { BaseCacheService, CACHE_PREFIX } from './base-cache.service';

@Injectable({
  providedIn: 'root',
  useFactory: (http: HttpClient) => new AlphaVantageService(http),
  deps: [HttpClient]
})
export class AlphaVantageService extends BaseCacheService {
  private baseUrl = 'https://www.alphavantage.co/query';

  constructor(private http: HttpClient) {
    super('alphavantage_');
  }

  getStockQuote(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}quote_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(this.baseUrl, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: environment.alphaVantageApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching stock quote:', error);
        return throwError(() => error);
      })
    );
  }

  getCompanyOverview(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}overview_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(this.baseUrl, {
      params: {
        function: 'OVERVIEW',
        symbol,
        apikey: environment.alphaVantageApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching company overview:', error);
        return throwError(() => error);
      })
    );
  }

  getTimeSeriesDaily(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}timeseries_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(this.baseUrl, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol,
        apikey: environment.alphaVantageApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching time series:', error);
        return throwError(() => error);
      })
    );
  }
} 