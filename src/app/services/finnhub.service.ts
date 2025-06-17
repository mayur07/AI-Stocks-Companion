import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap } from 'rxjs/operators';
import { BaseCacheService, CACHE_PREFIX } from './base-cache.service';

@Injectable({
  providedIn: 'root',
  useFactory: (http: HttpClient) => new FinnhubService(http),
  deps: [HttpClient]
})
export class FinnhubService extends BaseCacheService {
  private baseUrl = 'https://finnhub.io/api/v1';

  constructor(private http: HttpClient) {
    super('finnhub_');
  }

  getCompanyProfile(symbol: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}profile_${symbol}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/stock/profile2`, {
      params: {
        symbol,
        token: environment.finnhubApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching company profile:', error);
        return throwError(() => error);
      })
    );
  }

  getMarketNews(category: string = 'general'): Observable<any> {
    const cacheKey = `${this.cachePrefix}news_${category}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/news`, {
      params: {
        category,
        token: environment.finnhubApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching market news:', error);
        return throwError(() => error);
      })
    );
  }

  getCompanyNews(symbol: string, from: string, to: string): Observable<any> {
    const cacheKey = `${this.cachePrefix}company_news_${symbol}_${from}_${to}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get(`${this.baseUrl}/company-news`, {
      params: {
        symbol,
        from,
        to,
        token: environment.finnhubApiKey
      }
    }).pipe(
      tap(data => this.cacheData(cacheKey, data)),
      catchError(error => {
        console.error('Error fetching company news:', error);
        return throwError(() => error);
      })
    );
  }
} 