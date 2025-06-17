import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap } from 'rxjs/operators';
import { BaseCacheService, CACHE_PREFIX } from './base-cache.service';

@Injectable({
  providedIn: 'root',
  useFactory: (http: HttpClient) => new PolygonService(http),
  deps: [HttpClient]
})
export class PolygonService extends BaseCacheService {
  private baseUrl = 'https://api.polygon.io/v2';

  constructor(private http: HttpClient) {
    super('polygon_');
  }

  getStockDetails(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}details_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/reference/tickers/${symbol}`, {
      params: {
        apiKey: environment.polygonApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching stock details:', error);
        return throwError(() => error);
      })
    );
  }

  getMarketStatus(): Observable<any> {
    const cacheKey = `${this.cachePrefix}market_status`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/market/status/now`, {
      params: {
        apiKey: environment.polygonApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching market status:', error);
        return throwError(() => error);
      })
    );
  }

  getStockFinancials(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}financials_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/reference/financials/${symbol}`, {
      params: {
        apiKey: environment.polygonApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching stock financials:', error);
        return throwError(() => error);
      })
    );
  }
} 